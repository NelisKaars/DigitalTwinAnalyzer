/**
 * Three.js Visualization Framework Adapter
 * Adapts Three.js to work with the dashboard common interface
 */
// Register this framework in the global registry
if (!window.VisualizationFrameworks) {
    window.VisualizationFrameworks = {};
}

window.VisualizationFrameworks.threejs = {
    createInstance() {
        return new ThreeJSVisualizer();
    }
};

class ThreeJSVisualizer {
    constructor() {
        // Core Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.container = null;

        // Digital twin model components
        this.modelId = null;
        this.modelObject = null;
        this.rotatingPart = null;

        // Factory scene components - 3D models/meshes
        this.factoryScene = null;
        this.factoryEnvironment = null;
        this.cookieLines = [];
        this.mixerModels = [];
        this.selectedMixer = null;
        this.conveyors = {};

        // Tag system references
        this.tagManager = null;        // Reference to the shared tag manager
        this.tagObjects = {};          // For mapping tag IDs to 3D objects
        this.showTags = true;

        // Use the standard component structure from VisualizationComponents
        this.components = VisualizationComponents.createDefaultComponentState();

        // Effects
        this.temperatureLight = null;
        this.statusIndicator = null;

        // For textures (especially conveyor belts and plastic liner)
        this.textureOffsets = {};
        
        // For backwards compatibility during refactoring
        this.modelState = {}; 
    }

    /**
     * Initialize the Three.js visualizer
     * @param {Object} options - Initialization options
     * @param {HTMLElement} options.container - DOM element to render into
     * @param {string} options.modelId - ID of the model to load
     * @param {Function} options.onReady - Callback when ready
     */
    initialize(options) {
        this.container = options.container;
        this.modelId = 'factory'; // Always use factory model
        this.onReady = options.onReady || (() => { });

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);

        // Create camera - always use factory view settings
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        this.camera.position.set(35, 30, 100);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // Set zoom limits for factory view
        this.controls.minDistance = 5;   // Minimum zoom distance
        this.controls.maxDistance = 200; // Maximum zoom distance

        // Initialize the tag manager
        this.tagManager = new TagManager(this.container);

        // Lighting
        this.setupLighting();

        // Load factory model
        this.loadFactoryModel();

        // Setup window resize handler
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Start animation loop
        this.isInitialized = true;
        this.animate(0);
    }

    /**
     * Setup scene lighting
     */
    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // Add a point light that will change with temperature
        this.temperatureLight = new THREE.PointLight(0xffaa00, 0.5, 10);
        this.temperatureLight.position.set(0, 2, 0);
        this.scene.add(this.temperatureLight);
    }

    /**
     * Load the factory model with multiple components
     */
    async loadFactoryModel() {
        try {
            // Get paths for all models
            const paths = ModelLoader.getModelPath('threejs', 'factory');

            // Step 1: Load the scene definition JSON
            const sceneDefinition = await ModelLoader.loadSceneDefinition(paths.sceneDefinition);
            if (!sceneDefinition) {
                throw new Error("Failed to load scene definition");
            }

            // Parse scene components
            this.factoryScene = FactoryScene.parseSceneDefinition(sceneDefinition);

            // Step 2: Load environment model
            const loader = new THREE.GLTFLoader();

            // Load environment
            loader.load(paths.models.environment, (gltf) => {
                this.factoryEnvironment = gltf.scene;
                this.applyModelTransform(this.factoryEnvironment, this.factoryScene.environment);
                this.scene.add(this.factoryEnvironment);
                this.checkAllModelsLoaded();
            });

            // Load water tank
            loader.load(paths.models.waterTank, (gltf) => {
                this.components.waterTank.object3D = gltf.scene;
                this.applyModelTransform(this.components.waterTank.object3D, this.factoryScene.waterTank);
                this.scene.add(this.components.waterTank.object3D);
                this.checkAllModelsLoaded();
            });

            // Load cookie production lines
            for (let i = 0; i < this.factoryScene.cookieLines.length; i++) {
                const lineNode = this.factoryScene.cookieLines[i];
                loader.load(paths.models.line, (gltf) => {
                    const lineModel = gltf.scene.clone();
                    this.applyModelTransform(lineModel, lineNode);

                    // Add additional line components
                    this.setupProductionLineComponents(lineModel, i);

                    this.scene.add(lineModel);
                    this.cookieLines.push(lineModel);
                    this.checkAllModelsLoaded();
                });
            }

            // Load mixers - load all available mixers
            // Use the maxMixers from FactoryModelLoader configuration
            const loadingSequence = FactoryModelLoader.getLoadingSequence();
            const mixersToLoad = Math.min(loadingSequence.maxMixers, this.factoryScene.mixers.length);
            for (let i = 0; i < mixersToLoad; i++) {
                const mixerNode = this.factoryScene.mixers[i];
                loader.load(paths.models.mixer, (gltf) => {
                    const mixerModel = gltf.scene.clone();
                    mixerModel.userData.mixerIndex = i;
                    mixerModel.userData.mixerName = mixerNode.name;

                    // Apply transforms from scene definition
                    this.applyModelTransform(mixerModel, mixerNode);

                    // Find rotating part
                    mixerModel.traverse((node) => {
                        if (node.isMesh && (
                            node.name.toLowerCase().includes('mixer') ||
                            node.name.toLowerCase().includes('blade'))) {
                            node.userData.isRotatingPart = true;
                        }
                    });

                    this.scene.add(mixerModel);
                    this.mixerModels.push({
                        model: mixerModel,
                        name: mixerNode.name,
                        index: i
                    });

                    this.checkAllModelsLoaded();
                });
            }
        } catch (error) {
            console.error('Error loading factory model:', error);
        }
    }

    /**
     * Set up production line components like freezer tunnel, cookie former, etc.
     * @param {THREE.Object3D} lineModel - The line model to add components to
     * @param {number} lineIndex - Index of the line
     */
    setupProductionLineComponents(lineModel, lineIndex) {
        // Only set up components for the first line for simplicity
        if (lineIndex > 0) return;

        // Find key components and store references
        lineModel.traverse((node) => {
            if (!node.isMesh) return;

            const name = node.name.toLowerCase();

            // Freezer tunnel
            if (name.includes('freezer') || name.includes('tunnel')) {
                this.components.freezerTunnel.object3D = node;
                node.userData.type = 'freezer';
                node.material = node.material.clone(); // Clone material for individual coloring
            }
            // Plastic liner
            else if (name.includes('plastic') || name.includes('liner')) {
                this.components.plasticLiner.object3D = node;
                node.userData.type = 'liner';
                node.material = node.material.clone();

                // Create or clone material with texture for the plastic liner
                if (node.material) {
                    // Check if the material already has a texture map
                    if (!node.material.map) {
                        // Create a simple plastic liner texture
                        const textureSize = 512;
                        const canvas = document.createElement('canvas');
                        canvas.width = textureSize;
                        canvas.height = textureSize;
                        const ctx = canvas.getContext('2d');

                        // Draw a base color
                        ctx.fillStyle = '#555555';
                        ctx.fillRect(0, 0, textureSize, textureSize);

                        // Draw a pattern for the plastic liner
                        ctx.fillStyle = '#777777';
                        const lineCount = 8;
                        const lineWidth = textureSize / lineCount;

                        for (let i = 0; i < lineCount; i += 2) {
                            ctx.fillRect(i * lineWidth, 0, lineWidth, textureSize);
                        }

                        // Create texture from canvas
                        const texture = new THREE.CanvasTexture(canvas);
                        texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.repeat.set(2, 2);

                        // Apply texture to material
                        node.material.map = texture;
                    }

                    // Make sure the texture is set to repeat
                    if (node.material.map) {
                        node.material.map.wrapS = THREE.RepeatWrapping;
                        node.material.map.wrapT = THREE.RepeatWrapping;

                        // Initialize texture offset tracking for this liner
                        this.textureOffsets['plastic_liner'] = {
                            u: 0,
                            v: 0
                        };
                    }
                }
            }
            // Cookie former
            else if (name.includes('cookie') && name.includes('form')) {
                this.components.cookieFormer.object3D = node;
                node.userData.type = 'former';
                node.material = node.material.clone();
            }
            // Box sealer
            else if (name.includes('box') && (name.includes('seal') || name.includes('erect'))) {
                this.components.boxSealer.object3D = node;
                node.userData.type = 'sealer';
                node.material = node.material.clone();
            }
            // Conveyor sections
            else if (name.includes('conveyor')) {
                const conveyorId = `conveyor_${Object.keys(this.conveyors).length}`;
                this.conveyors[conveyorId] = node;
                node.userData.type = 'conveyor';
                node.userData.conveyorId = conveyorId;

                // Create or clone material with texture for the conveyor
                if (node.material) {
                    node.material = node.material.clone();

                    // Check if the material already has a texture map
                    if (!node.material.map) {
                        // Create a simple conveyor texture
                        const textureSize = 512;
                        const canvas = document.createElement('canvas');
                        canvas.width = textureSize;
                        canvas.height = textureSize;
                        const ctx = canvas.getContext('2d');

                        // Draw a repeating pattern (stripes)
                        ctx.fillStyle = '#555555';
                        ctx.fillRect(0, 0, textureSize, textureSize);

                        // Draw some stripes
                        ctx.fillStyle = '#777777';
                        const stripeCount = 10;
                        const stripeHeight = textureSize / stripeCount;

                        for (let i = 0; i < stripeCount; i += 2) {
                            ctx.fillRect(0, i * stripeHeight, textureSize, stripeHeight);
                        }

                        // Create texture from canvas
                        const texture = new THREE.CanvasTexture(canvas);
                        texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.repeat.set(2, 2);

                        // Apply texture to material
                        node.material.map = texture;
                    }

                    // Make sure the texture is set to repeat
                    if (node.material.map) {
                        node.material.map.wrapS = THREE.RepeatWrapping;
                        node.material.map.wrapT = THREE.RepeatWrapping;

                        // Initialize texture offset tracking for this conveyor
                        this.textureOffsets[conveyorId] = {
                            u: 0,
                            v: 0
                        };
                    }
                }
            }
        });
    }

    /**
     * Apply transforms from scene definition to a model - ThreeJS specific implementation
     * @param {Object} model - Three.js Object3D to transform
     * @param {Object} nodeData - Node data from scene definition
     */
    applyModelTransform(model, nodeData) {
        if (!nodeData || !nodeData.transform) return;

        const transform = nodeData.transform;

        // Apply position
        if (transform.position) {
            model.position.set(
                transform.position[0],
                transform.position[1],
                transform.position[2]
            );
        }

        // Apply rotation (convert from scene definition format)
        if (transform.rotation) {
            model.rotation.set(
                transform.rotation[0],
                transform.rotation[1],
                transform.rotation[2]
            );
        }

        // Apply scale
        if (transform.scale) {
            model.scale.set(
                transform.scale[0],
                transform.scale[1],
                transform.scale[2]
            );
        }
    }

    /**
     * Check if all factory models have been loaded
     */
    checkAllModelsLoaded() {
        // Use the shared FactoryModelLoader helper to check if all models are loaded
        const allModelsLoaded = FactoryModelLoader.checkAllFactoryModelsLoaded({
            factoryEnvironment: this.factoryEnvironment,
            waterTankObject: this.components.waterTank.object3D,
            cookieLines: this.cookieLines,
            mixerModels: this.mixerModels,
            factoryScene: this.factoryScene
        });
        
        if (allModelsLoaded) {
            console.log("All factory components loaded");
            // Create status indicators for mixers
            this.createFactoryStatusIndicators();
            // Create floating tags for all components
            this.createFloatingTags();
            // Signal that we're ready
            this.onReady();
        }
    }

    /**
     * Create status indicators for factory mixers
     */
    createFactoryStatusIndicators() {
        this.mixerModels.forEach(mixer => {
            const geometry = new THREE.SphereGeometry(0.2, 16, 16);
            const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            const indicator = new THREE.Mesh(geometry, material);

            // Position above the mixer
            indicator.position.set(0, 2.84, 0);
            mixer.model.add(indicator);
            mixer.statusIndicator = indicator;
        });
    }

    /**
     * Create floating tags for all components to display property values
     */
    createFloatingTags() {
        // Prepare the tag objects mapping that TagManager needs
        const tagObjects = {
            mixers: this.mixerModels,
            waterTank: {
                object3D: this.components.waterTank.object3D,
                offset: new THREE.Vector3(0, 5, 0)
            },
            freezerTunnel: {
                object3D: this.components.freezerTunnel.object3D,
                offset: new THREE.Vector3(0, 3, 0)
            },
            plasticLiner: {
                object3D: this.components.plasticLiner.object3D,
                offset: new THREE.Vector3(0, 2.5, 0)
            },
            cookieFormer: {
                object3D: this.components.cookieFormer.object3D,
                offset: new THREE.Vector3(0, 3, 0)
            },
            boxSealer: {
                object3D: this.components.boxSealer.object3D,
                offset: new THREE.Vector3(0, 3, 0)
            }
        };

        // Add a conveyor system reference if available
        if (Object.keys(this.conveyors).length > 0) {
            const firstConveyorId = Object.keys(this.conveyors)[0];
            tagObjects.conveyorSystem = {
                object3D: this.conveyors[firstConveyorId],
                offset: new THREE.Vector3(0, 2, 0)
            };
        }

        // Use the TagManager to create all component tags at once
        this.tagManager.createAllComponentTags(this.components, tagObjects);

        // Store references to all tag objects for positioning
        this.tagObjects = {};
        
        // Store mixer tag references
        this.mixerModels.forEach((mixer) => {
            this.tagObjects[mixer.name] = {
                object3D: mixer.model,
                offset: new THREE.Vector3(0, 3.5, 0)
            };
        });
        
        // Store other component tag references
        if (this.components.waterTank.object3D) {
            this.tagObjects['WaterTank'] = tagObjects.waterTank;
        }
        if (this.components.freezerTunnel.object3D) {
            this.tagObjects['FreezerTunnel'] = tagObjects.freezerTunnel;
        }
        if (this.components.plasticLiner.object3D) {
            this.tagObjects['PlasticLiner'] = tagObjects.plasticLiner;
        }
        if (this.components.cookieFormer.object3D) {
            this.tagObjects['CookieFormer'] = tagObjects.cookieFormer;
        }
        if (this.components.boxSealer.object3D) {
            this.tagObjects['BoxSealer'] = tagObjects.boxSealer;
        }
        if (tagObjects.conveyorSystem) {
            this.tagObjects['ConveyorSystem'] = tagObjects.conveyorSystem;
        }
    }

    /**
     * Helper method to create a tag for a component - ThreeJS specific implementation
     * that uses the common TagManager
     * @param {string} id - Tag ID
     * @param {THREE.Object3D} object - Object to attach tag to
     * @param {Object} options - Tag options
     */
    createComponentTag(id, object, options) {
        // Use the common TagManager to create the tag
        this.tagManager.createTag(id, options.content, id);
        
        // Store reference to 3D object for positioning
        const position = options.position || [0, 3, 0];
        this.tagObjects[id] = {
            object3D: object,
            offset: new THREE.Vector3(position[0], position[1], position[2])
        };
    }

    /**
     * Update floating tag positions based on 3D positions
     */
    updateTagPositions() {
        if (!this.camera || !this.renderer || !this.tagManager) return;

        // Update all tag positions
        Object.keys(this.tagObjects).forEach(tagId => {
            const tagObject = this.tagObjects[tagId];
            const position = this.getTagViewportPosition(tagObject);

            // Should the tag be displayed?
            const shouldDisplay = position.inFront && position.inBounds;

            // Update tag position in the manager, including distance information
            this.tagManager.updateTagPosition(
                tagId, 
                position.x, 
                position.y, 
                shouldDisplay && this.showTags,
                position.distance
            );
        });
    }

    /**
     * Get viewport position for a tag - ThreeJS specific implementation
     * @param {Object} tagObject - Tag object data
     * @returns {Object} - Position object with x, y, z and computed screen coordinates
     */
    getTagViewportPosition(tagObject) {
        const tempVector = new THREE.Vector3();
        const containerRect = this.container.getBoundingClientRect();

        // Get world position of object
        const objectPos = new THREE.Vector3();
        tagObject.object3D.getWorldPosition(objectPos);
        
        // Add offset if specified
        if (tagObject.offset) {
            objectPos.add(tagObject.offset);
        }

        // Calculate distance to camera
        const distance = this.camera.position.distanceTo(objectPos);

        // Project 3D position to 2D screen position
        tempVector.copy(objectPos).project(this.camera);

        // Convert to CSS coordinates
        const x = (tempVector.x * 0.5 + 0.5) * containerRect.width;
        const y = (-(tempVector.y * 0.5) + 0.5) * containerRect.height;

        // Calculate if object is in front of the camera
        const inFront = tempVector.z < 1;

        // Check if within viewport bounds with padding
        const padding = 20; // pixels
        const inBounds = (
            x >= padding && x <= (containerRect.width - padding) &&
            y >= padding && y <= (containerRect.height - padding)
        );

        return {x, y, z: tempVector.z, distance, inFront, inBounds};
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        if (!this.isInitialized) return;

        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    /**
     * Animation loop
     * @param {number} time - Current timestamp
     */
    animate(time) {
        if (!this.isInitialized) return;

        this.animationFrame = requestAnimationFrame(this.animate.bind(this));

        // Calculate delta time in seconds
        const deltaTime = (time - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = time;

        // Update controls
        this.controls.update();

        // Update factory model
        this.updateFactoryAnimation(time, deltaTime);

        // Update floating tag positions
        this.updateTagPositions();

        // Render
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Update animation for factory model
     */
    updateFactoryAnimation(time, deltaTime) {
        // Check if we need to force a visual update
        const forceUpdate = this.needsVisualUpdate || false;
        if (forceUpdate) {
            this.needsVisualUpdate = false; // Reset the flag
        }

        // Update each mixer in the factory
        this.mixerModels.forEach(mixer => {
            // PRIORITY: Use mixer-specific data if available, then fall back to global
            let temperature, rpm, status;
            
            if (mixer.data) {
                temperature = mixer.data.temperature;
                rpm = mixer.data.rpm;
                status = mixer.data.status;
            } else {
                // Fallback to global state
                temperature = this.components.mixers.temperature;
                rpm = this.components.mixers.rpm;
                status = this.components.mixers.status;
            }
            
            // Use common animation calculation for consistent mixer behavior across frameworks
            const animValues = VisualizationComponents.calculateAnimationValues('mixer', {
                rpm: rpm
            }, deltaTime);
            
            // Apply the rotation to all rotating parts
            if (animValues.rotationDelta) {
                mixer.model.traverse((node) => {
                    if (node.userData && node.userData.isRotatingPart) {
                        // Rotate around the appropriate axis (y-axis by default)
                        const axis = animValues.axis || 'y';
                        if (axis === 'y') {
                            node.rotation.y += animValues.rotationDelta;
                        } else if (axis === 'x') {
                            node.rotation.x += animValues.rotationDelta;
                        } else if (axis === 'z') {
                            node.rotation.z += animValues.rotationDelta;
                        }
                    }
                });
            }

            // Update status indicators - FORCE UPDATE when data changes
            if (mixer.statusIndicator && (forceUpdate || mixer.data)) {
                const statusMapping = DTProperties.mapAlarmStatus(status);
                mixer.statusIndicator.material.color.setHex(statusMapping.color);

                // Handle blinking if needed
                if (statusMapping.blinking) {
                    const blinkRate = Math.sin(time / 200) * 0.5 + 0.5;
                    mixer.statusIndicator.material.opacity = blinkRate;
                    mixer.statusIndicator.material.transparent = true;
                } else {
                    mixer.statusIndicator.material.opacity = 1;
                    mixer.statusIndicator.material.transparent = false;
                }
            }

            // Update tag content for this mixer using the tag manager - FORCE UPDATE when data changes
            if (this.tagManager && (forceUpdate || mixer.data)) {
                this.tagManager.updateComponentTagContent(mixer.name, {
                    temperature: temperature,
                    rpm: rpm,
                    status: status
                });
            }
        });

        // Update water tank color based on flow rate - FORCE UPDATE when data changes
        if (this.components.waterTank.object3D && (forceUpdate || this.components.waterTank.object3D)) {
            const flowRateMapping = DTProperties.mapWaterFlowRate(this.components.waterTank.flowRate);

            this.components.waterTank.object3D.traverse((node) => {
                if (node.isMesh && node.material) {
                    // Find the actual water tank body (not pipes or structure)
                    if (node.name.toLowerCase().includes('water') ||
                        node.name.toLowerCase().includes('tank') ||
                        node.name.toLowerCase().includes('liquid')) {
                        node.material.emissive = new THREE.Color(flowRateMapping.color);
                        node.material.emissiveIntensity = flowRateMapping.intensity * 0.3;
                    }
                }
            });

            // Update water tank tag content using the tag manager - FORCE UPDATE when data changes
            if (this.tagManager && forceUpdate) {
                this.tagManager.updateComponentTagContent('WaterTank', {
                    flowRate: this.components.waterTank.flowRate,
                    tankVolume: this.components.waterTank.tankVolume,
                    status: this.components.waterTank.status
                });
            }
        }

        // Update freezer tunnel - FORCE UPDATE when data changes
        if (this.components.freezerTunnel.object3D && (forceUpdate || this.components.freezerTunnel.object3D)) {
            // Update color based on temperature (blue-ish for cold)
            const freezerTemp = this.components.freezerTunnel.temperature;
            const intensity = Math.min(1.0, Math.max(0.0, (-freezerTemp + 10) / 30));
            const color = new THREE.Color(0.2, 0.4, 0.8); // Blue-ish color for freezer

            // Apply material changes to the freezer tunnel
            if (this.components.freezerTunnel.object3D.material) {
                this.components.freezerTunnel.object3D.material.emissive = color;
                this.components.freezerTunnel.object3D.material.emissiveIntensity = intensity;
            }

            // Update freezer tunnel tag content using the tag manager - FORCE UPDATE when data changes
            if (this.tagManager && forceUpdate) {
                this.tagManager.updateComponentTagContent('FreezerTunnel', {
                    temperature: this.components.freezerTunnel.temperature,
                    speed: this.components.freezerTunnel.speed,
                    status: this.components.freezerTunnel.status
                });
            }
        }

        // Update plastic liner - animate texture instead of rotating the object
        if (this.components.plasticLiner.object3D) {
            if (this.components.plasticLiner.object3D.material && this.components.plasticLiner.object3D.material.map) {
                // Get offset from our tracking object or create new
                const offset = this.textureOffsets['plastic_liner'] || { u: 0, v: 0 };
                
                // Use common animation calculation for consistent behavior across frameworks
                const animValues = VisualizationComponents.calculateAnimationValues('plasticLiner', {
                    rpm: this.components.plasticLiner.rpm
                }, deltaTime);
                
                // Apply the calculated texture offset changes
                if (animValues.textureOffsetDelta) {
                    offset.u += animValues.textureOffsetDelta.u;
                    offset.v += animValues.textureOffsetDelta.v;
                    
                    // Apply the updated offset to the texture
                    this.components.plasticLiner.object3D.material.map.offset.set(offset.u, offset.v);
                    
                    // Store updated offset
                    this.textureOffsets['plastic_liner'] = offset;
                }
            }

            // Update plastic liner tag content using the tag manager - FORCE UPDATE when data changes
            if (this.tagManager && forceUpdate) {
                this.tagManager.updateComponentTagContent('PlasticLiner', {
                    rpm: this.components.plasticLiner.rpm,
                    status: this.components.plasticLiner.status
                });
            }
        }

        // Update cookie former using the tag manager - FORCE UPDATE when data changes
        if (this.components.cookieFormer.object3D && this.tagManager && forceUpdate) {
            this.tagManager.updateComponentTagContent('CookieFormer', {
                rate: this.components.cookieFormer.rate,
                goodParts: this.components.cookieFormer.goodParts,
                status: this.components.cookieFormer.status
            });
        }

        // Update box sealer using the tag manager - FORCE UPDATE when data changes
        if (this.components.boxSealer.object3D && this.tagManager && forceUpdate) {
            this.tagManager.updateComponentTagContent('BoxSealer', {
                speed: this.components.boxSealer.speed,
                status: this.components.boxSealer.status
            });
        }

        // Update conveyor belts - animate texture instead of rotating the mesh
        Object.entries(this.conveyors).forEach(([id, conveyor]) => {
            if (conveyor.material && conveyor.material.map) {
                // Get offset from our tracking object or create new
                const offset = this.textureOffsets[id] || { u: 0, v: 0 };
                
                // Use common animation calculation for consistent behavior across frameworks
                const animValues = VisualizationComponents.calculateAnimationValues('conveyor', {
                    speed: this.components.conveyorSystem.speed
                }, deltaTime);
                
                // Apply the calculated texture offset changes
                if (animValues.textureOffsetDelta) {
                    offset.u += animValues.textureOffsetDelta.u;
                    offset.v += animValues.textureOffsetDelta.v;
                    
                    // Apply the updated offset to the texture
                    conveyor.material.map.offset.set(offset.u, offset.v);
                    
                    // Store updated offset
                    this.textureOffsets[id] = offset;
                }
            }
        });

        // Update conveyor system tag if it exists using the tag manager - FORCE UPDATE when data changes
        if (this.tagManager && forceUpdate) {
            this.tagManager.updateComponentTagContent('ConveyorSystem', {
                speed: this.components.conveyorSystem.speed,
                status: this.components.conveyorSystem.status
            });
        }
    }

    /**
     * Update the visualization from digital twin data
     * @param {Object} twinState - Digital twin state data
     */
    updateFromTwin(twinState) {
        // Use the common implementation from VisualizationComponents
        VisualizationComponents.updateFromTwin(this, twinState);
    }

    /**
     * Set camera position, target and up vector - used for automated camera control
     * @param {Array} position - [x, y, z] position coordinates
     * @param {Array} target - [x, y, z] target/lookAt coordinates
     * @param {Array} up - [x, y, z] up vector
     */
    setCameraPosition(position, target, up) {
        if (!this.camera || !this.controls) return;
        
        // Set camera position
        this.camera.position.set(position[0], position[1], position[2]);
        
        // Set target for orbit controls
        this.controls.target.set(target[0], target[1], target[2]);
        
        // Set up vector
        this.camera.up.set(up[0], up[1], up[2]);
        
        // Update controls and camera
        this.controls.update();
        this.camera.updateProjectionMatrix();
    }

    /**
     * Focus the camera on a specific mixer in the factory
     * @param {string} mixerName - Name of the mixer to focus on (e.g., "Mixer_0") or "all"
     */
    focusOnMixer(mixerName) {
        if (!this.isInitialized || this.modelId !== 'factory') return false;

        if (mixerName === 'all') {
            // Reset camera to overview position
            this.camera.position.set(35, 30, 100);
            this.controls.target.set(35, 0, 75);
            this.controls.update();
            return true;
        }

        // Find the selected mixer
        const mixer = this.mixerModels.find(m => m.name === mixerName);
        if (mixer) {
            const pos = mixer.model.position;

            // Move camera to focus on this mixer
            this.camera.position.set(pos.x, pos.y + 5, pos.z + 10);
            this.controls.target.set(pos.x, pos.y, pos.z);
            this.controls.update();

            this.selectedMixer = mixer;
            return true;
        }
        
        return false;
    }

    /**
     * Focus the camera on a specific component in the factory
     * @param {string} componentId - ID of the component to focus on (e.g., "WaterTank")
     */
    focusOnComponent(componentId) {
        // Use the common implementation from VisualizationComponents
        return VisualizationComponents.focusOnComponent(this, componentId);
    }

    /**
     * Get component object by ID - required for common focusOnComponent implementation
     * @param {string} componentId - ID of the component to get
     * @returns {Object|null} - The component object or null if not found
     */
    getComponentObject(componentId) {
        // Find the component based on its ID
        switch(componentId) {
            case 'WaterTank':
                return this.components.waterTank.object3D;
            
            case 'FreezerTunnel':
                return this.components.freezerTunnel.object3D;
            
            case 'PlasticLiner':
                return this.components.plasticLiner.object3D;
            
            case 'CookieFormer':
                return this.components.cookieFormer.object3D;
            
            case 'BoxSealer':
                return this.components.boxSealer.object3D;
            
            case 'ConveyorSystem':
                // Find a conveyor to focus on
                const conveyorIds = Object.keys(this.conveyors);
                if (conveyorIds.length > 0) {
                    return this.conveyors[conveyorIds[0]];
                }
                return null;
            
            default:
                return null;
        }
    }

    /**
     * Apply camera focus on a specific component - required for common focusOnComponent
     * @param {Object} targetObject - Object to focus on
     * @param {Object} cameraParams - Camera parameters from VisualizationComponents
     */
    applyComponentFocus(targetObject, cameraParams) {
        // Get world position of the object
        const pos = new THREE.Vector3();
        targetObject.getWorldPosition(pos);

        // Use the camera offset from the common parameters
        this.camera.position.set(
            pos.x + cameraParams.offset.camera[0],
            pos.y + cameraParams.offset.camera[1],
            pos.z + cameraParams.offset.camera[2]
        );
        
        // Look at the object position
        this.controls.target.set(
            pos.x + cameraParams.offset.target[0], 
            pos.y + cameraParams.offset.target[1], 
            pos.z + cameraParams.offset.target[2]
        );
        
        this.controls.update();
    }

    /**
     * Toggle tag visibility
     * @param {boolean} visible - Whether tags should be visible
     */
    toggleTags(visible) {
        // Use the common implementation from VisualizationComponents
        VisualizationComponents.toggleTags(this, visible);
    }

    /**
     * Clean up resources
     * @param {boolean} keepContainer - Whether to keep the container intact (for model changes)
     */
    cleanup(keepContainer = false) {
        // Use the common cleanup pattern from VisualizationComponents
        VisualizationComponents.cleanupPattern(this, keepContainer);
        
        // Three.js specific cleanup
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        // Clean up scene
        if (this.scene) {
            // Remove all objects from scene
            while (this.scene.children.length > 0) {
                const obj = this.scene.children[0];
                this.scene.remove(obj);
            }
        }

        if (!keepContainer) {
            if (this.renderer) {
                this.renderer.dispose();
                this.renderer = null;
            }

            if (this.container) {
                this.container.innerHTML = '';
            }

            window.removeEventListener('resize', this.onWindowResize);
        }
    }
}