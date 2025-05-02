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

        // Component state objects - properly structured by component
        this.components = {
            mixers: {
                status: 'NORMAL',
                temperature: 100,
                rpm: 60
            },
            waterTank: {
                object3D: null,
                flowRate: 35,
                tankVolume: 75,
                status: 'NORMAL'
            },
            freezerTunnel: {
                object3D: null,
                temperature: -15,
                speed: 0.8, // Freezer tunnel has its own speed
                status: 'NORMAL'
            },
            plasticLiner: {
                object3D: null,
                rpm: 45,
                status: 'NORMAL'
            },
            cookieFormer: {
                object3D: null,
                rate: 120,
                goodParts: 98.5,
                status: 'NORMAL'
            },
            boxSealer: {
                object3D: null,
                speed: 0.8, // Box sealer has its own speed
                status: 'NORMAL'
            },
            conveyorSystem: {
                speed: 0.8,
                status: 'NORMAL'
            }
        };

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
        // Removed tag focus/unfocus callbacks

        // Lighting
        this.setupLighting();

        // Skip ground plane for factory model as it has its own floor

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
     * Setup ground plane
     */
    setupGround() {
        // Skip ground plane for factory model as it has its own floor
        if (this.modelId === 'factory') return;

        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    /**
     * Load the factory model
     */
    loadModel() {
        // Always load factory model
        this.loadFactoryModel();
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

            // Load mixers (just a few for performance)
            // We'll limit to 6 mixers to keep performance reasonable
            const mixersToLoad = Math.min(6, this.factoryScene.mixers.length);
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
     * Apply transforms from scene definition to a model
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
        const requiredComponentCount = 2 + this.factoryScene.cookieLines.length; // Environment + WaterTank + Lines
        const expectedMixerCount = Math.min(6, this.factoryScene.mixers.length);
        const loadedComponentCount = (this.factoryEnvironment ? 1 : 0) +
            (this.components.waterTank.object3D ? 1 : 0) +
            this.cookieLines.length;

        if (loadedComponentCount >= requiredComponentCount && this.mixerModels.length >= expectedMixerCount) {
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
        // Create tags for each mixer
        this.mixerModels.forEach((mixer, index) => {
            const tagId = mixer.name;
            
            // Create tag in the manager 
            const content = `
                <div><strong>${mixer.name}</strong></div>
                <div>Temperature: ${this.components.mixers.temperature}°C</div>
                <div>RPM: ${this.components.mixers.rpm}</div>
                <div>Status: ${this.components.mixers.status}</div>
            `;
            
            this.tagManager.createTag(tagId, content, 'mixer');
            
            // Store reference to 3D object for positioning
            this.tagObjects[tagId] = {
                object3D: mixer.model,
                offset: new THREE.Vector3(0, 3.5, 0)
            };
        });

        // Create tag for water tank
        if (this.components.waterTank.object3D) {
            const tagId = 'WaterTank';
            
            // Create tag in the manager
            const content = `
                <div><strong>Water Tank</strong></div>
                <div>Flow Rate: ${this.components.waterTank.flowRate}</div>
                <div>Volume: ${this.components.waterTank.tankVolume}%</div>
                <div>Status: ${this.components.waterTank.status}</div>
            `;
            
            this.tagManager.createTag(tagId, content, 'watertank');
            
            // Store reference to 3D object for positioning
            this.tagObjects[tagId] = {
                object3D: this.components.waterTank.object3D,
                offset: new THREE.Vector3(0, 5, 0)
            };
        }

        // Create tags for additional components from CookieFactoryV3

        // Freezer Tunnel tag
        if (this.components.freezerTunnel.object3D) {
            this.createComponentTag('FreezerTunnel', this.components.freezerTunnel.object3D, {
                position: [0, 3, 0],
                content: `
                    <div><strong>Freezer Tunnel</strong></div>
                    <div>Temperature: ${this.components.freezerTunnel.temperature}°C</div>
                    <div>Speed: ${this.components.freezerTunnel.speed} m/s</div>
                    <div>Status: ${this.components.freezerTunnel.status}</div>
                `
            });
        }

        // Plastic Liner tag
        if (this.components.plasticLiner.object3D) {
            this.createComponentTag('PlasticLiner', this.components.plasticLiner.object3D, {
                position: [0, 2.5, 0],
                content: `
                    <div><strong>Plastic Liner</strong></div>
                    <div>RPM: ${this.components.plasticLiner.rpm}</div>
                    <div>Status: ${this.components.plasticLiner.status}</div>
                `
            });
        }

        // Cookie Former tag
        if (this.components.cookieFormer.object3D) {
            this.createComponentTag('CookieFormer', this.components.cookieFormer.object3D, {
                position: [0, 3, 0],
                content: `
                    <div><strong>Cookie Former</strong></div>
                    <div>Rate: ${this.components.cookieFormer.rate}/min</div>
                    <div>Good Parts: ${this.components.cookieFormer.goodParts}%</div>
                `
            });
        }

        // Box Sealer tag
        if (this.components.boxSealer.object3D) {
            this.createComponentTag('BoxSealer', this.components.boxSealer.object3D, {
                position: [0, 3, 0],
                content: `
                    <div><strong>Box Sealer</strong></div>
                    <div>Speed: ${this.components.boxSealer.speed} m/s</div>
                    <div>Status: ${this.components.boxSealer.status}</div>
                `
            });
        }

        // Add a single tag for the conveyor system
        if (Object.keys(this.conveyors).length > 0) {
            const firstConveyorId = Object.keys(this.conveyors)[0];
            const firstConveyor = this.conveyors[firstConveyorId];

            this.createComponentTag('ConveyorSystem', firstConveyor, {
                position: [0, 2, 0],
                content: `
                    <div><strong>Conveyor System</strong></div>
                    <div>Speed: ${this.components.conveyorSystem.speed} m/s</div>
                    <div>Status: ${this.components.conveyorSystem.status}</div>
                `
            });
        }
    }

    /**
     * Helper method to create a tag for a component
     * @param {string} id - Tag ID
     * @param {THREE.Object3D} object - Object to attach tag to
     * @param {Object} options - Tag options
     */
    createComponentTag(id, object, options) {
        // Create tag in the manager
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
     * Get viewport position for a tag
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

        return {
            x,
            y,
            z: tempVector.z,
            distance,
            inFront,
            inBounds
        };
    }

    /**
     * Update tag content for a specific object
     * @param {string} tagId - ID of the tag to update
     * @param {Object} data - New data to display
     */
    updateTagContent(tagId, data) {
        let content = '';
        let styles = {};

        if (tagId.startsWith('Mixer_')) {
            content = `
                <div><strong>${tagId}</strong></div>
                <div>Temperature: ${data.temperature}°C</div>
                <div>RPM: ${data.rpm}</div>
                <div>Status: ${data.status}</div>
            `;

            // Update color based on temperature
            const tempColor = this.getTemperatureColor(data.temperature);
            styles.borderLeft = `4px solid ${tempColor}`;

            // Update color based on alarm status
            if (data.status === 'ACTIVE') {
                styles.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            } else if (data.status === 'ACKNOWLEDGED') {
                styles.backgroundColor = 'rgba(255, 165, 0, 0.7)';
            } else {
                styles.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            }
        } else if (tagId === 'WaterTank') {
            content = `
                <div><strong>Water Tank</strong></div>
                <div>Flow Rate: ${data.waterFlowRate}</div>
                <div>Volume: ${data.tankVolume}%</div>
                <div>Status: ${data.status}</div>
            `;

            // Update color based on flow rate
            if (data.waterFlowRate > 70) {
                styles.borderLeft = '4px solid #ff0000'; // Red for high flow
            } else if (data.waterFlowRate > 50) {
                styles.borderLeft = '4px solid #ffaa00'; // Orange for medium flow
            } else {
                styles.borderLeft = '4px solid #00ff00'; // Green for normal flow
            }
            
            // Update color based on alarm status
            if (data.status === 'ACTIVE') {
                styles.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            } else if (data.status === 'ACKNOWLEDGED') {
                styles.backgroundColor = 'rgba(255, 165, 0, 0.7)';
            } else {
                styles.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            }
        } else if (tagId === 'FreezerTunnel') {
            content = `
                <div><strong>Freezer Tunnel</strong></div>
                <div>Temperature: ${data.freezerTemperature}°C</div>
                <div>Speed: ${data.freezerSpeed} m/s</div>
                <div>Status: ${data.status}</div>
            `;
            
            // Blue color for cold temperatures
            const freezerColor = this.getFreezerTemperatureColor(data.freezerTemperature);
            styles.borderLeft = `4px solid ${freezerColor}`;
            
            // Update color based on alarm status
            if (data.status === 'ACTIVE') {
                styles.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            } else if (data.status === 'ACKNOWLEDGED') {
                styles.backgroundColor = 'rgba(255, 165, 0, 0.7)';
            } else {
                styles.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            }
        } else if (tagId === 'PlasticLiner') {
            content = `
                <div><strong>Plastic Liner</strong></div>
                <div>RPM: ${data.linerRPM}</div>
                <div>Status: ${data.status}</div>
            `;
            
            // Color based on RPM
            if (data.linerRPM > 60) {
                styles.borderLeft = '4px solid #ff0000'; // Red for high RPM
            } else if (data.linerRPM < 30) {
                styles.borderLeft = '4px solid #ffaa00'; // Orange for low RPM
            } else {
                styles.borderLeft = '4px solid #00ff00'; // Green for normal
            }
            
            // Update color based on alarm status
            if (data.status === 'ACTIVE') {
                styles.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            } else if (data.status === 'ACKNOWLEDGED') {
                styles.backgroundColor = 'rgba(255, 165, 0, 0.7)';
            } else {
                styles.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            }
        } else if (tagId === 'CookieFormer') {
            content = `
                <div><strong>Cookie Former</strong></div>
                <div>Rate: ${data.cookieFormerRate}/min</div>
                <div>Good Parts: ${data.goodParts}%</div>
                <div>Status: ${data.status}</div>
            `;
            
            // Color based on good parts percentage
            if (data.goodParts < 95) {
                styles.borderLeft = '4px solid #ff0000'; // Red for low quality
            } else if (data.goodParts < 98) {
                styles.borderLeft = '4px solid #ffaa00'; // Orange for medium quality
            } else {
                styles.borderLeft = '4px solid #00ff00'; // Green for high quality
            }
            
            // Update color based on alarm status
            if (data.status === 'ACTIVE') {
                styles.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            } else if (data.status === 'ACKNOWLEDGED') {
                styles.backgroundColor = 'rgba(255, 165, 0, 0.7)';
            } else {
                styles.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            }
        } else if (tagId === 'BoxSealer') {
            content = `
                <div><strong>Box Sealer</strong></div>
                <div>Speed: ${data.boxSealerSpeed} m/s</div>
                <div>Status: ${data.status}</div>
            `;

            // Color based on speed
            const speed = data.boxSealerSpeed;
            if (speed > 1.5) {
                styles.borderLeft = '4px solid #ff0000'; // Red for high speed
            } else if (speed < 0.3) {
                styles.borderLeft = '4px solid #ffaa00'; // Orange for low speed
            } else {
                styles.borderLeft = '4px solid #00ff00'; // Green for normal
            }
            
            // Update color based on alarm status
            if (data.status === 'ACTIVE') {
                styles.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            } else if (data.status === 'ACKNOWLEDGED') {
                styles.backgroundColor = 'rgba(255, 165, 0, 0.7)';
            } else {
                styles.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            }
        } else if (tagId === 'ConveyorSystem') {
            content = `
                <div><strong>Conveyor System</strong></div>
                <div>Speed: ${data.conveyorSpeed} m/s</div>
                <div>Status: ${data.status}</div>
            `;
            
            // Color based on speed
            if (data.conveyorSpeed > 1.5) {
                styles.borderLeft = '4px solid #ff0000'; // Red for high speed
            } else if (data.conveyorSpeed < 0.3) {
                styles.borderLeft = '4px solid #ffaa00'; // Orange for low speed
            } else {
                styles.borderLeft = '4px solid #00ff00'; // Green for normal
            }
            
            // Update color based on alarm status
            if (data.status === 'ACTIVE') {
                styles.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            } else if (data.status === 'ACKNOWLEDGED') {
                styles.backgroundColor = 'rgba(255, 165, 0, 0.7)';
            } else {
                styles.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            }
        }

        // Update tag content and styles using the tag manager
        if (content) {
            this.tagManager.updateTagContent(tagId, content);
        }
        
        if (Object.keys(styles).length > 0) {
            this.tagManager.updateTagStyle(tagId, styles);
        }
    }

    /**
     * Get a color string based on temperature value
     * @param {number} temp - Temperature value
     * @returns {string} - CSS color string
     */
    getTemperatureColor(temp) {
        if (temp > 150) return '#ff0000'; // Hot red
        if (temp > 100) return '#ff5500'; // Very warm orange-red
        if (temp > 75) return '#ffaa00';  // Warm orange
        if (temp > 50) return '#ffff00';  // Yellow
        return '#00aaff';                 // Cool blue
    }

    /**
     * Get a color string based on freezer temperature value
     * @param {number} temp - Temperature value
     * @returns {string} - CSS color string
     */
    getFreezerTemperatureColor(temp) {
        if (temp > -5) return '#ff0000';  // Red - too warm for freezer
        if (temp > -10) return '#ffaa00'; // Orange - slightly warm
        if (temp > -15) return '#00aaff'; // Light blue - cool
        if (temp > -20) return '#0055ff'; // Medium blue - cold
        return '#0000ff';                 // Deep blue - very cold
    }

    /**
     * Toggle tag visibility
     * @param {boolean} visible - Whether tags should be visible
     */
    toggleTags(visible) {
        this.showTags = visible !== undefined ? visible : !this.showTags;
        this.tagManager.toggleTags(this.showTags);
    }

    /**
     * Handle single model loaded event
     * @param {Object} gltf - The loaded GLTF model
     */
    onModelLoaded(gltf) {
        this.modelObject = gltf.scene;

        // Apply shadows to all meshes
        this.modelObject.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }

            // Identify the rotating part based on name
            if (node.isMesh && (
                node.name.toLowerCase().includes('mixer') ||
                node.name.toLowerCase().includes('blade'))) {
                this.rotatingPart = node;
                console.log("Found rotating part:", node.name);
            }
        });

        // Position the model
        this.modelObject.position.y = 0;
        this.scene.add(this.modelObject);

        // If we couldn't find the rotating part, use the first mesh
        if (!this.rotatingPart && this.modelObject) {
            console.log("No specific rotating part found, using first mesh");
            this.modelObject.traverse((node) => {
                if (!this.rotatingPart && node.isMesh) {
                    this.rotatingPart = node;
                }
            });
        }

        // Create status indicator
        this.createStatusIndicator();

        // Signal that we're ready
        this.onReady();
    }

    /**
     * Create a status indicator object for single model
     */
    createStatusIndicator() {
        const geometry = new THREE.SphereGeometry(0.2, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.statusIndicator = new THREE.Mesh(geometry, material);
        this.statusIndicator.position.y = 3; // Position above the model
        this.scene.add(this.statusIndicator);
    }

    /**
     * Handle load progress
     * @param {Object} xhr - The XMLHttpRequest progress event
     */
    onLoadProgress(xhr) {
        const percent = (xhr.loaded / xhr.total * 100).toFixed(0);
        console.log(`Loading model: ${percent}%`);
    }

    /**
     * Handle load error
     * @param {Error} error - The error object
     */
    onLoadError(error) {
        console.error('Error loading model:', error);
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
     * Update animation for single mixer model
     */
    updateMixerAnimation(time, deltaTime) {
        // Rotate the mixer part based on RPM
        if (this.rotatingPart) {
            // Convert RPM to radians per second
            const radiansPerSecond = (this.components.mixers.rpm / 60) * Math.PI * 2;
            this.rotatingPart.rotation.y += radiansPerSecond * deltaTime;
        }

        // Update temperature visual effects
        if (this.temperatureLight) {
            const tempMapping = DTProperties.mapTemperature(this.components.mixers.temperature);
            this.temperatureLight.color.setHex(tempMapping.color);
            this.temperatureLight.intensity = tempMapping.intensity;
        }

        // Update status indicator
        if (this.statusIndicator) {
            const statusMapping = DTProperties.mapAlarmStatus(this.components.mixers.status);
            this.statusIndicator.material.color.setHex(statusMapping.color);

            // Handle blinking if needed
            if (statusMapping.blinking) {
                const blinkRate = Math.sin(time / 200) * 0.5 + 0.5;
                this.statusIndicator.material.opacity = blinkRate;
                this.statusIndicator.material.transparent = true;
            } else {
                this.statusIndicator.material.opacity = 1;
                this.statusIndicator.material.transparent = false;
            }
        }
    }

    /**
     * Update animation for factory model
     */
    updateFactoryAnimation(time, deltaTime) {
        // Update each mixer in the factory
        this.mixerModels.forEach(mixer => {
            // Get mixer-specific data if available, otherwise use global modelState
            const mixerData = mixer.data || {};
            const temperature = mixerData.temperature !== undefined ? mixerData.temperature : this.components.mixers.temperature;
            const rpm = mixerData.rpm !== undefined ? mixerData.rpm : this.components.mixers.rpm;
            const status = mixerData.status !== undefined ? mixerData.status : this.components.mixers.status;
            
            // Find the rotating parts and rotate them
            const rotationSpeed = (rpm / 60) * Math.PI * 2;

            mixer.model.traverse((node) => {
                if (node.userData && node.userData.isRotatingPart) {
                    node.rotation.y += rotationSpeed * deltaTime;
                }
            });

            // Update status indicators
            if (mixer.statusIndicator) {
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

            // Update tag content for this mixer using the tag manager
            if (this.tagManager) {
                this.updateTagContent(mixer.name, {
                    temperature: temperature,
                    rpm: rpm,
                    status: status
                });
            }
        });

        // Update water tank color based on flow rate
        if (this.components.waterTank.object3D) {
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

            // Update water tank tag content using the tag manager
            if (this.tagManager) {
                this.updateTagContent('WaterTank', {
                    waterFlowRate: this.components.waterTank.flowRate,
                    tankVolume: this.components.waterTank.tankVolume,
                    status: this.components.waterTank.status
                });
            }
        }

        // Update freezer tunnel 
        if (this.components.freezerTunnel.object3D) {
            // Update color based on temperature (blue-ish for cold)
            const freezerTemp = this.components.freezerTunnel.temperature;
            const intensity = Math.min(1.0, Math.max(0.0, (-freezerTemp + 10) / 30));
            const color = new THREE.Color(0.2, 0.4, 0.8); // Blue-ish color for freezer

            // Apply material changes to the freezer tunnel
            if (this.components.freezerTunnel.object3D.material) {
                this.components.freezerTunnel.object3D.material.emissive = color;
                this.components.freezerTunnel.object3D.material.emissiveIntensity = intensity;
            }

            // Update freezer tunnel tag content using the tag manager
            if (this.tagManager) {
                this.updateTagContent('FreezerTunnel', {
                    freezerTemperature: this.components.freezerTunnel.temperature,
                    freezerSpeed: this.components.freezerTunnel.speed,
                    status: this.components.freezerTunnel.status
                });
            }
        }

        // Update plastic liner - animate texture instead of rotating the object
        if (this.components.plasticLiner.object3D) {
            if (this.components.plasticLiner.object3D.material && this.components.plasticLiner.object3D.material.map) {
                // Update texture offset based on liner RPM
                // This creates the illusion of a rotating liner without rotating the mesh
                const offset = this.textureOffsets['plastic_liner'] || { u: 0, v: 0 };

                // The RPM determines how fast the texture rotates
                // Convert RPM to radians per second, then scale for texture movement
                const linerRotationSpeed = (this.components.plasticLiner.rpm / 60) * Math.PI * 2;
                const textureSpeed = linerRotationSpeed / (Math.PI * 2) * deltaTime;

                // In this case, we want to animate horizontally (u-direction)
                offset.u -= textureSpeed;

                // Apply the updated offset to the texture
                this.components.plasticLiner.object3D.material.map.offset.set(offset.u, offset.v);

                // Store updated offset
                this.textureOffsets['plastic_liner'] = offset;
            }

            // Update plastic liner tag content using the tag manager
            if (this.tagManager) {
                this.updateTagContent('PlasticLiner', {
                    linerRPM: this.components.plasticLiner.rpm,
                    status: this.components.plasticLiner.status
                });
            }
        }

        // Update cookie former using the tag manager
        if (this.components.cookieFormer.object3D && this.tagManager) {
            this.updateTagContent('CookieFormer', {
                cookieFormerRate: this.components.cookieFormer.rate,
                goodParts: this.components.cookieFormer.goodParts,
                status: this.components.cookieFormer.status
            });
        }

        // Update box sealer using the tag manager
        if (this.components.boxSealer.object3D && this.tagManager) {
            this.updateTagContent('BoxSealer', {
                boxSealerSpeed: this.components.boxSealer.speed,
                status: this.components.boxSealer.status
            });
        }

        // Update conveyor belts - animate texture instead of rotating the mesh
        Object.entries(this.conveyors).forEach(([id, conveyor]) => {
            if (conveyor.material && conveyor.material.map) {
                // Update texture offset based on conveyor speed
                // This creates the illusion of a moving belt without rotating the mesh
                const offset = this.textureOffsets[id] || { u: 0, v: 0 };

                // Advance texture in the v-direction (along the conveyor)
                // The speed factor controls how fast the texture moves
                offset.v -= this.components.conveyorSystem.speed * deltaTime * 0.5;

                // Apply the updated offset to the texture
                conveyor.material.map.offset.set(offset.u, offset.v);

                // Store updated offset
                this.textureOffsets[id] = offset;
            }
        });

        // Update conveyor system tag if it exists using the tag manager
        if (this.tagManager) {
            this.updateTagContent('ConveyorSystem', {
                conveyorSpeed: this.components.conveyorSystem.speed,
                status: this.components.conveyorSystem.status
            });
        }
    }

    /**
     * Update the visualization from digital twin data
     * @param {Object} twinState - Digital twin state data
     */
    updateFromTwin(twinState) {
        // Always use factory model update
        this.updateFactoryFromTwin(twinState);
    }

    /**
     * Update single mixer from twin data
     */
    updateMixerFromTwin(twinState) {
        // Update temperature if available
        if (twinState.features?.Mixer?.properties?.Temperature !== undefined) {
            const temp = parseFloat(twinState.features.Mixer.properties.Temperature);
            if (!isNaN(temp)) {
                this.components.mixers.temperature = temp;
            }
        }

        // Update RPM if available
        if (twinState.features?.Mixer?.properties?.RPM !== undefined) {
            const rpm = parseFloat(twinState.features.Mixer.properties.RPM);
            if (!isNaN(rpm)) {
                this.components.mixers.rpm = rpm;
            }
        }

        // Update status if available
        if (twinState.features?.Alarm?.properties?.alarm_status !== undefined) {
            this.components.mixers.status = twinState.features.Alarm.properties.alarm_status;
        }
    }

    /**
     * Update factory model from twin data
     */
    updateFactoryFromTwin(twinState) {
        const dashboardState = window.dashboardState || { selectedMixer: 'all' };
        const selectedMixerName = dashboardState.selectedMixer;
        
        // Check if we have any mixer data
        for (let i = 0; i < 6; i++) {
            const mixerKey = `Mixer_${i}`;
            
            // Update temperature 
            if (twinState.features?.[mixerKey]?.properties?.Temperature !== undefined) {
                const temp = parseFloat(twinState.features[mixerKey].properties.Temperature);
                if (!isNaN(temp)) {
                    // Store temperature in the mixer model if available
                    const mixer = this.mixerModels.find(m => m.name === mixerKey);
                    if (mixer) {
                        mixer.data = mixer.data || {};
                        mixer.data.temperature = temp;
                        
                        // Update tag if it exists using tagManager instead of this.tags
                        if (this.tagManager) {
                            this.updateTagContent(mixerKey, {
                                temperature: temp,
                                rpm: mixer.data.rpm || this.components.mixers.rpm,
                                status: mixer.data.status || this.components.mixers.status
                            });
                        }
                    }
                    
                    // Update global state if this is the selected mixer or if 'all' is selected
                    if (selectedMixerName === mixerKey || selectedMixerName === 'all') {
                        this.components.mixers.temperature = temp;
                    }
                }
            }
            
            // Update RPM
            if (twinState.features?.[mixerKey]?.properties?.RPM !== undefined) {
                const rpm = parseFloat(twinState.features[mixerKey].properties.RPM);
                if (!isNaN(rpm)) {
                    // Store RPM in the mixer model if available
                    const mixer = this.mixerModels.find(m => m.name === mixerKey);
                    if (mixer) {
                        mixer.data = mixer.data || {};
                        mixer.data.rpm = rpm;
                        
                        // Update tag if it exists using tagManager instead of this.tags
                        if (this.tagManager) {
                            this.updateTagContent(mixerKey, {
                                temperature: mixer.data.temperature || this.components.mixers.temperature,
                                rpm: rpm,
                                status: mixer.data.status || this.components.mixers.status
                            });
                        }
                    }
                    
                    // Update global state if this is the selected mixer or if 'all' is selected
                    if (selectedMixerName === mixerKey || selectedMixerName === 'all') {
                        this.components.mixers.rpm = rpm;
                    }
                }
            }
            
            // Update alarm status
            const alarmKey = `${mixerKey}_AlarmComponent`;
            if (twinState.features?.[alarmKey]?.properties?.alarm_status !== undefined) {
                const status = twinState.features[alarmKey].properties.alarm_status;
                
                // Store status in the mixer model if available
                const mixer = this.mixerModels.find(m => m.name === mixerKey);
                if (mixer) {
                    mixer.data = mixer.data || {};
                    mixer.data.status = status;
                    
                    // Update tag immediately with the new status using tagManager instead of this.tags
                    if (this.tagManager) {
                        this.updateTagContent(mixerKey, {
                            temperature: mixer.data.temperature || this.components.mixers.temperature,
                            rpm: mixer.data.rpm || this.components.mixers.rpm,
                            status: status  // Use the status directly from the backend
                        });
                    }
                }
                
                // Update global state if this is the selected mixer or if 'all' is selected
                if (selectedMixerName === mixerKey || selectedMixerName === 'all') {
                    this.components.mixers.status = status;
                }
            }
        }
        
        // Update water tank flow rate
        if (twinState.features?.WaterTank?.properties?.flowRate1 !== undefined) {
            const flowRate = parseFloat(twinState.features.WaterTank.properties.flowRate1);
            if (!isNaN(flowRate)) {
                this.components.waterTank.flowRate = flowRate;
                
                // Update tag content for water tank using tagManager instead of this.tags
                if (this.tagManager) {
                    this.updateTagContent('WaterTank', {
                        waterFlowRate: flowRate,
                        tankVolume: this.components.waterTank.tankVolume,
                        status: this.components.waterTank.status
                    });
                }
            }
        }
        
        // Update water tank volume (if available)
        if (twinState.features?.WaterTank?.properties?.tankVolume1 !== undefined) {
            const tankVolume = parseFloat(twinState.features.WaterTank.properties.tankVolume1);
            if (!isNaN(tankVolume)) {
                this.components.waterTank.tankVolume = tankVolume;
                
                // Update tag content for water tank using tagManager instead of this.tags
                if (this.tagManager) {
                    this.updateTagContent('WaterTank', {
                        waterFlowRate: this.components.waterTank.flowRate,
                        tankVolume: tankVolume,
                        status: this.components.waterTank.status
                    });
                }
            }
        }
        
        // Update water tank status
        if (twinState.features?.WaterTank?.properties?.Status !== undefined) {
            const waterTankStatus = twinState.features.WaterTank.properties.Status;
            
            // Store the status in the model state for use in animation updates
            this.components.waterTank.status = waterTankStatus;
            
            // Update tag content for water tank with the status directly from the backend using tagManager instead of this.tags
            if (this.tagManager) {
                this.updateTagContent('WaterTank', {
                    waterFlowRate: this.components.waterTank.flowRate,
                    tankVolume: this.components.waterTank.tankVolume,
                    status: waterTankStatus
                });
            }
        }
        
        // Update freezer tunnel temperature
        if (twinState.features?.FreezerTunnel?.properties?.Temperature !== undefined) {
            const freezerTemp = parseFloat(twinState.features.FreezerTunnel.properties.Temperature);
            if (!isNaN(freezerTemp)) {
                this.components.freezerTunnel.temperature = freezerTemp;
                
                // Apply visual changes directly to the freezer tunnel
                if (this.components.freezerTunnel.object3D && this.components.freezerTunnel.object3D.material) {
                    const intensity = Math.min(1.0, Math.max(0.0, (-freezerTemp + 10) / 30));
                    const color = new THREE.Color(0.2, 0.4, 0.8); // Blue-ish color for freezer
                    this.components.freezerTunnel.object3D.material.emissive = color;
                    this.components.freezerTunnel.object3D.material.emissiveIntensity = intensity;
                }
                
                // Update freezer tunnel tag using tagManager instead of this.tags
                if (this.tagManager) {
                    const state = twinState.features.FreezerTunnel.properties.Status || 'RUNNING';
                    this.updateTagContent('FreezerTunnel', {
                        freezerTemperature: freezerTemp,
                        freezerSpeed: this.components.freezerTunnel.speed,
                        status: state
                    });
                }
            }
        }
        
        // Update freezer tunnel state - changed from State to Status for consistency
        if (twinState.features?.FreezerTunnel?.properties?.Status !== undefined) {
            const freezerStatus = twinState.features.FreezerTunnel.properties.Status;
            
            // Store the status in the model state for use in animation updates
            this.components.freezerTunnel.status = freezerStatus;

            // Update freezer tunnel tag with the status directly from the backend using tagManager instead of this.tags
            if (this.tagManager) {
                this.updateTagContent('FreezerTunnel', {
                    freezerTemperature: this.components.freezerTunnel.temperature,
                    freezerSpeed: this.components.freezerTunnel.speed,
                    status: freezerStatus // Use the status directly from the backend
                });
            }
        }
        
        // Update plastic liner RPM
        if (twinState.features?.PlasticLiner?.properties?.RPM !== undefined) {
            const linerRPM = parseFloat(twinState.features.PlasticLiner.properties.RPM);
            if (!isNaN(linerRPM)) {
                this.components.plasticLiner.rpm = linerRPM;
                
                // Update plastic liner texture animation speed immediately
                if (this.components.plasticLiner.object3D && this.components.plasticLiner.object3D.material && this.components.plasticLiner.object3D.material.map) {
                    // Store the updated RPM to be used in animation
                    this.components.plasticLiner.rpm = linerRPM;
                }
                
                // Get the latest status directly from the backend
                const linerStatus = twinState.features.PlasticLiner?.properties?.Status || 'NORMAL';
                
                // Update tag content for plastic liner with the latest status using tagManager instead of this.tags
                if (this.tagManager) {
                    this.updateTagContent('PlasticLiner', {
                        linerRPM: linerRPM,
                        status: linerStatus
                    });
                }
            }
        }
        
        // Update plastic liner status
        if (twinState.features?.PlasticLiner?.properties?.Status !== undefined) {
            const linerStatus = twinState.features.PlasticLiner.properties.Status;
            
            // Store the status in the model state for use in animation updates
            this.components.plasticLiner.status = linerStatus;
            
            // Update tag content for plastic liner with the status directly from the backend using tagManager instead of this.tags
            if (this.tagManager) {
                this.updateTagContent('PlasticLiner', {
                    linerRPM: this.components.plasticLiner.rpm,
                    status: linerStatus // Use the status directly from the backend
                });
            }
        }
        
        // Update cookie former rate
        if (twinState.features?.CookieFormer?.properties?.Rate !== undefined) {
            const formerRate = parseFloat(twinState.features.CookieFormer.properties.Rate);
            if (!isNaN(formerRate)) {
                this.components.cookieFormer.rate = formerRate;
                
                // Get the latest status directly from the backend
                const formerStatus = twinState.features.CookieFormer?.properties?.Status || 'OPERATIONAL';
                
                // Update tag content for cookie former using tagManager instead of this.tags
                if (this.tagManager) {
                    this.updateTagContent('CookieFormer', {
                        cookieFormerRate: formerRate,
                        goodParts: this.components.cookieFormer.goodParts,
                        status: formerStatus
                    });
                }
            }
        }
        
        // Update cookie former good parts percentage
        if (twinState.features?.CookieFormer?.properties?.GoodParts !== undefined) {
            const goodParts = parseFloat(twinState.features.CookieFormer.properties.GoodParts);
            if (!isNaN(goodParts)) {
                this.components.cookieFormer.goodParts = goodParts;
                
                // Get the latest status directly from the backend
                const formerStatus = twinState.features.CookieFormer?.properties?.Status || 'OPERATIONAL';
                
                // Update tag content for cookie former using tagManager instead of this.tags
                if (this.tagManager) {
                    this.updateTagContent('CookieFormer', {
                        cookieFormerRate: this.components.cookieFormer.rate,
                        goodParts: goodParts,
                        status: formerStatus
                    });
                }
            }
        }
        
        // Update cookie former status
        if (twinState.features?.CookieFormer?.properties?.Status !== undefined) {
            const formerStatus = twinState.features.CookieFormer.properties.Status;
            
            // Store the status in the model state for use in animation updates
            this.components.cookieFormer.status = formerStatus;
            
            // Update tag content for cookie former with the status directly from the backend using tagManager instead of this.tags
            if (this.tagManager) {
                this.updateTagContent('CookieFormer', {
                    cookieFormerRate: this.components.cookieFormer.rate,
                    goodParts: this.components.cookieFormer.goodParts,
                    status: formerStatus // Use the status directly from the backend
                });
            }
        }
        
        // Update box sealer speed
        if (twinState.features?.BoxSealer?.properties?.Speed !== undefined) {
            const boxSealerSpeed = parseFloat(twinState.features.BoxSealer.properties.Speed);
            if (!isNaN(boxSealerSpeed)) {
                // Store the box sealer speed separately
                this.components.boxSealer.speed = boxSealerSpeed;
                
                // Get the latest status directly from the backend
                const boxSealerStatus = twinState.features.BoxSealer?.properties?.Status || 'OPERATIONAL';
                
                // Update tag content for box sealer using tagManager instead of this.tags
                if (this.tagManager) {
                    this.updateTagContent('BoxSealer', {
                        boxSealerSpeed: boxSealerSpeed,
                        status: boxSealerStatus
                    });
                }
            }
        }
        
        // Update box sealer status
        if (twinState.features?.BoxSealer?.properties?.Status !== undefined) {
            const boxSealerStatus = twinState.features.BoxSealer.properties.Status;
            
            // Store the status in the model state for use in animation updates
            this.components.boxSealer.status = boxSealerStatus;
            
            // Update tag content for box sealer with the status directly from the backend using tagManager instead of this.tags
            if (this.tagManager) {
                this.updateTagContent('BoxSealer', {
                    boxSealerSpeed: this.components.boxSealer.speed,
                    status: boxSealerStatus // Use the status directly from the backend
                });
            }
        }
        
        // Update conveyor speed
        if (twinState.features?.Conveyor?.properties?.Speed !== undefined) {
            const conveyorSpeed = parseFloat(twinState.features.Conveyor.properties.Speed);
            if (!isNaN(conveyorSpeed)) {
                this.components.conveyorSystem.speed = conveyorSpeed;
                
                // Get the latest status directly from the backend
                const conveyorStatus = twinState.features.Conveyor?.properties?.Status || 'RUNNING';
                
                // Update conveyor system tag using tagManager instead of this.tags
                if (this.tagManager) {
                    this.updateTagContent('ConveyorSystem', {
                        conveyorSpeed: conveyorSpeed,
                        status: conveyorStatus
                    });
                }
            }
        }
        
        // Update conveyor status
        if (twinState.features?.Conveyor?.properties?.Status !== undefined) {
            const conveyorStatus = twinState.features.Conveyor.properties.Status;
            
            // Store the status in the model state for use in animation updates
            this.components.conveyorSystem.status = conveyorStatus;
            
            // Update conveyor system tag with the status directly from the backend using tagManager instead of this.tags
            if (this.tagManager) {
                this.updateTagContent('ConveyorSystem', {
                    conveyorSpeed: this.components.conveyorSystem.speed,
                    status: conveyorStatus // Use the status directly from the backend
                });
            }
        }
    }

    /**
     * Focus the camera on a specific mixer in the factory
     * @param {string} mixerName - Name of the mixer to focus on (e.g., "Mixer_0") or "all"
     */
    focusOnMixer(mixerName) {
        if (!this.isInitialized || this.modelId !== 'factory') return;

        if (mixerName === 'all') {
            // Reset camera to overview position
            this.camera.position.set(35, 30, 100);
            this.controls.target.set(35, 0, 75);
            this.controls.update();

            // Reset focused tag
            if (this.focusedTag) {
                const wasHovered = this.hoveredTag === this.focusedTag;
                this.focusedTag = null;

                // Reset all tags to base or hovered state
                Object.keys(this.tags).forEach(tagId => {
                    this.updateTagVisualState(tagId, tagId === this.hoveredTag);
                });
            }
            return;
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

            // Focus on this mixer's tag
            if (this.focusedTag && this.focusedTag !== mixerName) {
                // Unfocus previous tag
                this.updateTagVisualState(this.focusedTag, this.hoveredTag === this.focusedTag);
            }

            this.focusedTag = mixerName;
            this.updateTagVisualState(mixerName, true);
        }
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
     * Change the current model
     * @param {string} modelId - ID of the new model to load
     */
    changeModel(modelId) {
        this.modelId = modelId;

        // Clean up current models
        this.cleanup(true); // true = keep container

        // Reset camera position based on model type
        if (modelId === 'factory') {
            this.camera.position.set(35, 30, 100);
        } else {
            this.camera.position.set(0, 2, 5);
        }
        this.controls.update();

        // Load the new model
        this.loadModel();
    }

    /**
     * Clean up resources
     * @param {boolean} keepContainer - Whether to keep the container intact (for model changes)
     */
    cleanup(keepContainer = false) {
        // Clear tag management
        if (this.tagManager) {
            this.tagManager.cleanup();
            this.tagManager = null;
        }
        
        this.tagObjects = {};
        
        // Reset texture offsets
        this.textureOffsets = {};

        // Existing cleanup code...
        this.isInitialized = false;

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

        // Reset references to models
        this.modelObject = null;
        this.rotatingPart = null;
        this.factoryScene = null;
        this.mixerModels = [];
        this.factoryEnvironment = null;
        this.components.waterTank.object3D = null;
        this.cookieLines = [];
        this.selectedMixer = null;
        this.statusIndicator = null;
        this.components.freezerTunnel.object3D = null;
        this.components.plasticLiner.object3D = null;
        this.components.cookieFormer.object3D = null;
        this.components.boxSealer.object3D = null;
        this.conveyors = {};

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

    /**
     * Update component tag content based on full state data
     * @param {string} tagId - ID of the component tag
     * @param {Object} twinState - Full digital twin state data
     */
    updateComponentTagContent(tagId, twinState) {
        if (!this.tags[tagId]) return;
        
        switch(tagId) {
            case 'FreezerTunnel':
                if (twinState.features && twinState.features.FreezerTunnel) {
                    const freezerData = twinState.features.FreezerTunnel.properties;
                    this.updateTagContent('FreezerTunnel', {
                        freezerTemperature: parseFloat(freezerData.Temperature || this.components.freezerTunnel.temperature),
                        freezerSpeed: parseFloat(freezerData.Speed || this.components.freezerTunnel.speed),
                        status: freezerData.Status
                    });
                }
                break;
                
            case 'PlasticLiner':
                if (twinState.features && twinState.features.PlasticLiner) {
                    const linerData = twinState.features.PlasticLiner.properties;
                    this.updateTagContent('PlasticLiner', {
                        linerRPM: parseFloat(linerData.RPM || this.components.plasticLiner.rpm),
                        status: linerData.Status
                    });
                }
                break;
                
            case 'CookieFormer':
                if (twinState.features && twinState.features.CookieFormer) {
                    const formerData = twinState.features.CookieFormer.properties;
                    this.updateTagContent('CookieFormer', {
                        cookieFormerRate: parseFloat(formerData.Rate || this.components.cookieFormer.rate),
                        goodParts: parseFloat(formerData.GoodParts || this.components.cookieFormer.goodParts),
                        status: formerData.Status
                    });
                }
                break;
                
            case 'BoxSealer':
                if (twinState.features && twinState.features.BoxSealer) {
                    const sealerData = twinState.features.BoxSealer.properties;
                    this.updateTagContent('BoxSealer', {
                        conveyorSpeed: parseFloat(sealerData.Speed || this.components.boxSealer.speed || this.components.conveyorSystem.speed),
                        status: sealerData.Status
                    });
                }
                break;
                
            case 'ConveyorSystem':
                if (twinState.features && twinState.features.Conveyor) {
                    const conveyorData = twinState.features.Conveyor.properties;
                    this.updateTagContent('ConveyorSystem', {
                        conveyorSpeed: parseFloat(conveyorData.Speed || this.components.conveyorSystem.speed),
                        status: conveyorData.Status
                    });
                }
                break;
                
            case 'WaterTank':
                if (twinState.features && twinState.features.WaterTank) {
                    const tankData = twinState.features.WaterTank.properties;
                    this.updateTagContent('WaterTank', {
                        waterFlowRate: parseFloat(tankData.flowRate1 || this.components.waterTank.flowRate),
                        tankVolume: parseFloat(tankData.tankVolume1 || this.components.waterTank.tankVolume),
                        status: tankData.Status
                    });
                }
                break;
        }
    }
}