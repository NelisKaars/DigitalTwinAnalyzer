/**
 * PlayCanvas Visualization Framework Adapter
 * Adapts PlayCanvas to work with the dashboard common interface
 */
// Register this framework in the global registry
if (!window.VisualizationFrameworks) {
    window.VisualizationFrameworks = {};
}

window.VisualizationFrameworks.playcanvas = {
    createInstance() {
        return new PlayCanvasVisualizer();
    }
};

class PlayCanvasVisualizer {
    constructor() {
        // Core PlayCanvas components
        this.app = null;
        this.scene = null;
        this.camera = null;
        this.cameraEntity = null;
        this.container = null;
        this.canvas = null;

        // Digital twin model components
        this.modelId = null;
        this.factoryRoot = null;
        this.environmentRoot = null;
        this.componentsRoot = null;

        // Factory scene components - 3D models/meshes
        this.factoryEnvironment = null;
        this.cookieLines = [];
        this.mixerModels = [];
        this.selectedMixer = null;
        this.conveyors = {};

        // Loading state tracking
        this.loadingState = {
            environment: false,
            waterTank: false,
            cookieLines: 0,
            mixers: 0,
            requiredLineCount: 1,
            maxMixerCount: 6
        };

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
        
        // Performance tracking
        this.lastUpdateTime = 0;
        
        // Camera control variables
        this.cameraOrbit = {
            distance: 200,
            yaw: 0,
            pitch: 0.5,
            targetPosition: new pc.Vec3(35, 0, 75),
            minPitch: -0.5,
            maxPitch: 0.9,
            minDistance: 5,
            maxDistance: 500,
            damping: 0.05
        };
        
        // Input tracking for mouse/touch interaction
        this.input = {
            mouse: {
                isDown: false,
                lastX: 0,
                lastY: 0,
                isPanning: false
            },
            touch: {
                isDown: false,
                lastX: 0,
                lastY: 0
            }
        };
    }

    /**
     * Initialize the PlayCanvas visualizer
     * @param {Object} options - Initialization options
     * @param {HTMLElement} options.container - DOM element to render into
     * @param {string} options.modelId - ID of the model to load
     * @param {Function} options.onReady - Callback when ready
     */
    initialize(options) {
        this.container = options.container;
        this.modelId = 'factory'; // Always use factory model
        this.onReady = options.onReady || (() => { });

        // Create canvas for PlayCanvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        this.canvas.style.position = 'absolute'; // Changed from relative to absolute
        this.container.appendChild(this.canvas);

        // Create PlayCanvas application
        this.app = new pc.Application(this.canvas, {
            mouse: new pc.Mouse(this.canvas),
            keyboard: new pc.Keyboard(window),
            touch: new pc.TouchDevice(this.canvas)
        });
        this.app.start();

        // Set canvas to match container size exactly
        this.app.setCanvasFillMode(pc.FILLMODE_NONE);
        this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
        
        // Set canvas size to match container
        const resizeCanvas = () => {
            const rect = this.container.getBoundingClientRect();
            this.app.resizeCanvas(rect.width, rect.height);
        };
        
        // Initial size
        resizeCanvas();
        
        // Listen for container resize
        window.addEventListener('resize', resizeCanvas);

        // Create scene
        this.scene = this.app.scene;
        this.scene.ambientLight = new pc.Color(0.95, 0.95, 0.95);

        // Create camera - always use factory view settings
        this.cameraEntity = new pc.Entity("camera");
        this.cameraEntity.addComponent("camera", {
            clearColor: new pc.Color(0.95, 0.95, 0.95),
            nearClip: 0.1,
            farClip: 1000
        });
        this.camera = this.cameraEntity.camera;
        
        // Initialize camera position
        this.cameraEntity.setPosition(35, 30, 100);
        this.updateCameraTransform();
        
        // Add camera to scene
        this.app.root.addChild(this.cameraEntity);
        
        // Setup mouse and touch input for camera control
        const mouse = this.app.mouse;
        const touch = this.app.touch;
        
        mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
        mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
        mouse.on(pc.EVENT_MOUSEUP, this.onMouseUp, this);
        mouse.on(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);
        
        touch.on(pc.EVENT_TOUCHSTART, this.onTouchStart, this);
        touch.on(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
        touch.on(pc.EVENT_TOUCHEND, this.onTouchEnd, this);
        touch.on(pc.EVENT_TOUCHCANCEL, this.onTouchEnd, this);

        // Initialize the tag manager
        this.tagManager = new TagManager(this.container);

        // Lighting
        this.setupLighting();

        // Load factory model
        this.loadFactoryModel();

        // Setup window resize handler
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Start update loop
        this.isInitialized = true;
        this.app.on('update', this.update.bind(this));
    }
    
    /**
     * Update camera position and rotation based on orbit parameters
     */
    updateCameraTransform() {
        // Calculate camera position based on spherical coordinates
        const orbit = this.cameraOrbit;
        const sinYaw = Math.sin(orbit.yaw);
        const cosYaw = Math.cos(orbit.yaw);
        const sinPitch = Math.sin(orbit.pitch);
        const cosPitch = Math.cos(orbit.pitch);
        
        // Calculate camera position in spherical coordinates
        const x = orbit.targetPosition.x + orbit.distance * cosPitch * sinYaw;
        const y = orbit.targetPosition.y + orbit.distance * sinPitch;
        const z = orbit.targetPosition.z + orbit.distance * cosPitch * cosYaw;
        
        // Set camera position
        this.cameraEntity.setPosition(x, y, z);
        
        // Make camera look at target position
        this.cameraEntity.lookAt(orbit.targetPosition);
    }
    
    /**
     * Handler for mouse down events
     * @param {Object} event - Mouse event
     */
    onMouseDown(event) {
        // Left mouse button (for rotation)
        if (event.button === 0) {
            this.input.mouse.isDown = true;
            this.input.mouse.lastX = event.x;
            this.input.mouse.lastY = event.y;
            
            // Prevent default to avoid text selection
            event.event.preventDefault();
        }
        // Middle mouse button (for panning)
        else if (event.button === 2) {
            this.input.mouse.isPanning = true;
            this.input.mouse.lastX = event.x;
            this.input.mouse.lastY = event.y;
            
            event.event.preventDefault();
        }
    }
    
    /**
     * Handler for mouse move events
     * @param {Object} event - Mouse event
     */
    onMouseMove(event) {
        // Handle rotation with left mouse button
        if (this.input.mouse.isDown) {
            // Calculate mouse movement deltas
            const dx = event.x - this.input.mouse.lastX;
            const dy = event.y - this.input.mouse.lastY;
            this.input.mouse.lastX = event.x;
            this.input.mouse.lastY = event.y;
            
            // Rotate camera based on mouse movement
            this.cameraOrbit.yaw -= dx * 0.003;
            this.cameraOrbit.pitch += dy * 0.003;
            
            // Clamp pitch to avoid camera flipping
            this.cameraOrbit.pitch = Math.max(this.cameraOrbit.minPitch, 
                                              Math.min(this.cameraOrbit.pitch, this.cameraOrbit.maxPitch));
            
            // Update camera position
            this.updateCameraTransform();
            
            // Prevent default to avoid text selection
            event.event.preventDefault();
        }
        // Handle panning with right mouse button
        else if (this.input.mouse.isPanning) {
            // Calculate mouse movement deltas
            const dx = event.x - this.input.mouse.lastX;
            const dy = event.y - this.input.mouse.lastY;
            this.input.mouse.lastX = event.x;
            this.input.mouse.lastY = event.y;
            
            // Get camera right and up vectors
            const right = this.cameraEntity.right;
            const up = this.cameraEntity.up;
            
            // Scale movement speed based on distance (faster when zoomed out)
            const panSpeed = this.cameraOrbit.distance * 0.005;
            
            // Calculate the pan amount in world space
            const panX = right.x * dx * panSpeed;
            const panY = up.y * dy * panSpeed;
            const panZ = right.z * dx * panSpeed + up.z * dy * panSpeed;
            
            // Update the target position
            this.cameraOrbit.targetPosition.x -= panX;
            this.cameraOrbit.targetPosition.y -= panY;
            this.cameraOrbit.targetPosition.z -= panZ;
            
            // Update camera position
            this.updateCameraTransform();
            
            event.event.preventDefault();
        }
    }
    
    /**
     * Handler for mouse up events
     * @param {Object} event - Mouse event
     */
    onMouseUp(event) {
        // Left mouse button (rotation)
        if (event.button === 0) {
            this.input.mouse.isDown = false;
        }
        // Right mouse button (panning)
        else if (event.button === 2) {
            this.input.mouse.isPanning = false;
        }
    }
    
    /**
     * Handler for mouse wheel events
     * @param {Object} event - Mouse wheel event
     */
    onMouseWheel(event) {
        // Adjust camera distance based on wheel delta
        const wheelDelta = event.wheelDelta;
        this.cameraOrbit.distance += wheelDelta * 5;
        
        // Clamp distance
        this.cameraOrbit.distance = Math.max(this.cameraOrbit.minDistance, 
                                           Math.min(this.cameraOrbit.distance, this.cameraOrbit.maxDistance));
        
        // Update camera position
        this.updateCameraTransform();
    }
    
    /**
     * Handler for touch start events
     * @param {Object} event - Touch event
     */
    onTouchStart(event) {
        // Single touch for rotation
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.input.touch.isDown = true;
            this.input.touch.lastX = touch.x;
            this.input.touch.lastY = touch.y;
            
            // Prevent default to avoid scrolling
            event.event.preventDefault();
        }
    }
    
    /**
     * Handler for touch move events
     * @param {Object} event - Touch event
     */
    onTouchMove(event) {
        // Single touch for rotation
        if (event.touches.length === 1 && this.input.touch.isDown) {
            const touch = event.touches[0];
            
            // Calculate touch movement deltas
            const dx = touch.x - this.input.touch.lastX;
            const dy = touch.y - this.input.touch.lastY;
            this.input.touch.lastX = touch.x;
            this.input.touch.lastY = touch.y;
            
            // Rotate camera based on touch movement
            this.cameraOrbit.yaw += dx * 0.003;
            this.cameraOrbit.pitch -= dy * 0.003;
            
            // Clamp pitch to avoid camera flipping
            this.cameraOrbit.pitch = Math.max(this.cameraOrbit.minPitch, 
                                              Math.min(this.cameraOrbit.pitch, this.cameraOrbit.maxPitch));
            
            // Update camera position
            this.updateCameraTransform();
            
            // Prevent default to avoid scrolling
            event.event.preventDefault();
        }
        
        // Two-finger pinch for zooming
        else if (event.touches.length === 2) {
            // Implementation for pinch zoom would go here
            // This would calculate the distance between two touches
            // and adjust camera distance accordingly
        }
    }
    
    /**
     * Handler for touch end events
     * @param {Object} event - Touch event
     */
    onTouchEnd(event) {
        this.input.touch.isDown = false;
    }

    /**
     * Update function called every frame
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        if (!this.isInitialized) return;
        
        // Get current time
        const time = performance.now();
        
        // Update factory model
        this.updateFactoryAnimation(time, dt);
        
        // Update floating tag positions
        this.updateTagPositions();
    }

    /**
     * Setup scene lighting
     */
    setupLighting() {
        // Add ambient light
        const ambientLight = new pc.Entity("ambientLight");
        ambientLight.addComponent("light", {
            type: pc.LIGHTTYPE_AMBIENT,
            color: new pc.Color(1, 1, 1),
            intensity: 0.5
        });
        this.app.root.addChild(ambientLight);

        // Add directional light - disable shadows to fix the error
        const directionalLight = new pc.Entity("directionalLight");
        directionalLight.addComponent("light", {
            type: pc.LIGHTTYPE_DIRECTIONAL,
            color: new pc.Color(1, 1, 1),
            intensity: 0.8,
            castShadows: false, // Changed from true to false
            shadowBias: 0.05,
            normalOffsetBias: 0.05,
            shadowResolution: 1024 // Reduced from 2048 for performance
        });
        directionalLight.setLocalEulerAngles(45, 30, 0);
        this.app.root.addChild(directionalLight);

        // Add a point light that will change with temperature
        const temperatureLightEntity = new pc.Entity("temperatureLight");
        temperatureLightEntity.addComponent("light", {
            type: pc.LIGHTTYPE_POINT,
            color: new pc.Color(1, 0.67, 0),
            intensity: 0.5,
            range: 10
        });
        temperatureLightEntity.setLocalPosition(0, 2, 0);
        this.app.root.addChild(temperatureLightEntity);
        this.temperatureLight = temperatureLightEntity;
    }

    /**
     * Load the factory model with multiple components
     */
    async loadFactoryModel() {
        try {
            // Get paths for all models
            const paths = ModelLoader.getModelPath('playcanvas', 'factory');

            // Step 1: Load the scene definition JSON
            const sceneDefinition = await ModelLoader.loadSceneDefinition(paths.sceneDefinition);
            if (!sceneDefinition) {
                throw new Error("Failed to load scene definition");
            }

            // Parse scene components
            this.factoryScene = FactoryScene.parseSceneDefinition(sceneDefinition);

            // Step 2: Create root container for factory
            this.factoryRoot = new pc.Entity("factoryRoot");
            this.app.root.addChild(this.factoryRoot);

            // Create separate containers for environment and components
            this.environmentRoot = new pc.Entity("environmentRoot");
            this.componentsRoot = new pc.Entity("componentsRoot");
            this.factoryRoot.addChild(this.environmentRoot);
            this.factoryRoot.addChild(this.componentsRoot);

            // Load environment model
            this.loadGLTFModel(paths.models.environment, (model) => {
                this.factoryEnvironment = model;
                this.environmentRoot.addChild(model);
                this.applyModelTransform(this.environmentRoot, this.factoryScene.environment);
                this.checkAllModelsLoaded();
            });

            // Load water tank
            this.loadGLTFModel(paths.models.waterTank, (model) => {
                const waterTankEntity = new pc.Entity("waterTank");
                waterTankEntity.addChild(model);
                this.componentsRoot.addChild(waterTankEntity);
                this.components.waterTank.object3D = waterTankEntity;
                this.applyModelTransform(waterTankEntity, this.factoryScene.waterTank);
                this.checkAllModelsLoaded();
            });

            // Load cookie production lines
            for (let i = 0; i < this.factoryScene.cookieLines.length; i++) {
                const lineNode = this.factoryScene.cookieLines[i];
                this.loadGLTFModel(paths.models.line, (model) => {
                    const lineEntity = new pc.Entity(`cookieLine_${i}`);
                    lineEntity.addChild(model);
                    this.componentsRoot.addChild(lineEntity);
                    this.applyModelTransform(lineEntity, lineNode);

                    // Add additional line components
                    this.setupProductionLineComponents(lineEntity, i);

                    this.cookieLines.push(lineEntity);
                    this.checkAllModelsLoaded();
                });
            }

            // Load mixers (just a few for performance)
            // We'll limit to 6 mixers to keep performance reasonable
            const mixersToLoad = Math.min(6, this.factoryScene.mixers.length);
            for (let i = 0; i < mixersToLoad; i++) {
                const mixerNode = this.factoryScene.mixers[i];
                this.loadGLTFModel(paths.models.mixer, (model) => {
                    const mixerEntity = new pc.Entity(`mixer_${i}`);
                    mixerEntity.addChild(model);
                    this.componentsRoot.addChild(mixerEntity);

                    // Store mixer metadata
                    mixerEntity.mixerIndex = i;
                    mixerEntity.mixerName = mixerNode.name;

                    // Find rotating parts
                    this.findRotatingParts(model);

                    // Apply transforms from scene definition
                    this.applyModelTransform(mixerEntity, mixerNode);

                    this.mixerModels.push({
                        model: mixerEntity,
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
     * Load a GLTF model with PlayCanvas
     * @param {string} url - URL to the model
     * @param {Function} callback - Called when model is loaded
     */
    loadGLTFModel(url, callback) {
        const asset = new pc.Asset('gltf-model', 'container', { url: url });
        asset.on('load', function () {
            const entity = asset.resource.instantiateRenderEntity();
            callback(entity);
        });
        asset.on('error', function (err) {
            console.error('Error loading GLTF model:', url, err);
        });
        this.app.assets.add(asset);
        this.app.assets.load(asset);
    }

    /**
     * Find rotating parts in a model
     * @param {pc.Entity} entity - Entity to search for rotating parts
     */
    findRotatingParts(entity) {
        if (!entity) return;

        entity.children.forEach(child => {
            const name = child.name.toLowerCase();
            if (name.includes('bowl') || name.includes('main_mixer')) {
                child.isRotatingPart = true;
            }
            // Recursively check children
            this.findRotatingParts(child);
        });
    }

    /**
     * Set up production line components like freezer tunnel, cookie former, etc.
     * @param {pc.Entity} lineModel - The line model to add components to
     * @param {number} lineIndex - Index of the line
     */
    setupProductionLineComponents(lineModel, lineIndex) {
        // Only set up components for the first line for simplicity
        if (lineIndex > 0) return;

        // Find key components in the model
        this.traverseEntity(lineModel, (entity) => {
            const name = entity.name.toLowerCase();

            // Freezer tunnel
            if (name.includes('freezer') || name.includes('tunnel')) {
                this.components.freezerTunnel.object3D = entity;
                entity.type = 'freezer';
                // Setup material for coloring
                this.setupColorableMaterial(entity);
            }
            // Plastic liner
            else if (name.includes('plastic') || name.includes('liner')) {
                this.components.plasticLiner.object3D = entity;
                entity.type = 'liner';
                // Setup textured material
                this.setupTexturedMaterial(entity, 'plastic_liner', {
                    patternType: 'lines',
                    lineCount: 8
                });
            }
            // Cookie former
            else if (name.includes('cookie') && name.includes('form')) {
                this.components.cookieFormer.object3D = entity;
                entity.type = 'former';
                this.setupColorableMaterial(entity);
            }
            // Box sealer
            else if (name.includes('box') && (name.includes('seal') || name.includes('erect'))) {
                this.components.boxSealer.object3D = entity;
                entity.type = 'sealer';
                this.setupColorableMaterial(entity);
            }
            // Conveyor sections
            else if (name.includes('conveyor')) {
                const conveyorId = `conveyor_${Object.keys(this.conveyors).length}`;
                this.conveyors[conveyorId] = entity;
                entity.type = 'conveyor';
                entity.conveyorId = conveyorId;
                // Setup textured material
                this.setupTexturedMaterial(entity, conveyorId, {
                    patternType: 'stripes',
                    stripeCount: 10
                });
            }
        });
    }

    /**
     * Traverse an entity and its children
     * @param {pc.Entity} entity - Entity to traverse
     * @param {Function} callback - Function to call for each entity
     */
    traverseEntity(entity, callback) {
        if (!entity) return;

        // Call callback for this entity
        callback(entity);

        // Traverse all children
        entity.children.forEach(child => {
            this.traverseEntity(child, callback);
        });
    }

    /**
     * Setup a material that can be colored (for freezer, etc)
     * @param {pc.Entity} entity - Entity to setup material for
     */
    setupColorableMaterial(entity) {
        if (!entity) return;

        // PlayCanvas material setup for coloring
        // This is a simplified implementation, actual would create a custom material
        entity.originalMaterial = entity.model ? entity.model.material : null;
    }

    /**
     * Setup a textured material for conveyor belts, plastic liner, etc
     * @param {pc.Entity} entity - Entity to setup material for
     * @param {string} id - Unique ID for tracking texture offsets
     * @param {Object} options - Options for texture creation
     */
    setupTexturedMaterial(entity, id, options) {
        if (!entity) return;

        // Create a texture - in a real implementation we'd create a custom texture
        // and apply it to the entity's material
        
        // Initialize texture offset tracking
        this.textureOffsets[id] = {
            u: 0,
            v: 0
        };
    }

    /**
     * Apply transforms from scene definition to a model - PlayCanvas specific implementation
     * @param {pc.Entity} model - PlayCanvas Entity to transform
     * @param {Object} nodeData - Node data from scene definition
     */
    applyModelTransform(model, nodeData) {
        if (!nodeData || !nodeData.transform) return;

        const transform = nodeData.transform;

        // Apply position
        if (transform.position) {
            model.setLocalPosition(
                transform.position[0],
                transform.position[1],
                transform.position[2]
            );
        }

        // Apply rotation (convert from scene definition format)
        if (transform.rotation) {
            model.setLocalEulerAngles(
                transform.rotation[0] * 180 / Math.PI,
                transform.rotation[1] * 180 / Math.PI,
                transform.rotation[2] * 180 / Math.PI
            );
        }

        // Apply scale
        if (transform.scale) {
            model.setLocalScale(
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
            // Create position indicators to help with tag positioning
            this.createPositionIndicators();
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
            // Create a sphere entity for indicator
            const indicator = new pc.Entity("indicator");
            indicator.addComponent("model", {
                type: "sphere",
                material: this.createMaterial(new pc.Color(0, 1, 0))
            });
            
            // Scale the sphere to right size
            indicator.setLocalScale(0.2, 0.2, 0.2);
            
            // Position above the mixer
            indicator.setLocalPosition(0, 2.84, 0);
            mixer.model.addChild(indicator);
            mixer.statusIndicator = indicator;
        });
    }

    /**
     * Create a basic material with a color
     * @param {pc.Color} color - Color for the material
     * @returns {pc.StandardMaterial} Created material
     */
    createMaterial(color) {
        const material = new pc.StandardMaterial();
        material.diffuse = color;
        material.update();
        return material;
    }

    /**
     * Create floating tags for all components to display property values
     */
    createFloatingTags() {
        // Get positions from our indicators to use for tags
        // By now, the position indicators should be created and we can use their positions
        
        // Create tag mapping objects that will be passed to TagManager
        const mixerTags = this.mixerModels.map((mixer, index) => {
            // Get the indicator position if available
            const indicatorId = `mixerIndicator_${index}`;
            const indicatorPos = this.getIndicatorPosition(indicatorId) || 
                                 new pc.Vec3(mixer.model.getPosition().x, 
                                            mixer.model.getPosition().y + 2, 
                                            mixer.model.getPosition().z);
            
            return {
                object3D: mixer.model,
                name: mixer.name,
                // Use indicator position directly as worldPosition
                worldPosition: indicatorPos
            };
        });
        
        // Create tags for other components using their indicator positions
        const otherTags = {
            waterTank: {
                object3D: this.components.waterTank.object3D,
                worldPosition: this.getIndicatorPosition("waterTankIndicator")
            },
            freezerTunnel: {
                object3D: this.components.freezerTunnel.object3D,
                worldPosition: this.getIndicatorPosition("freezerIndicator")
            },
            plasticLiner: {
                object3D: this.components.plasticLiner.object3D,
                worldPosition: this.getIndicatorPosition("linerIndicator")
            },
            cookieFormer: {
                object3D: this.components.cookieFormer.object3D,
                worldPosition: this.getIndicatorPosition("formerIndicator")
            },
            boxSealer: {
                object3D: this.components.boxSealer.object3D,
                worldPosition: this.getIndicatorPosition("sealerIndicator")
            }
        };
        
        // Add conveyor system if available
        if (Object.keys(this.conveyors).length > 0) {
            otherTags.conveyorSystem = {
                object3D: this.conveyors[Object.keys(this.conveyors)[0]],
                worldPosition: this.getIndicatorPosition("conveyorIndicator")
            };
        }
        
        // Use the TagManager to create all component tags
        const tagObjects = {
            mixers: mixerTags,
            ...otherTags
        };
        
        // Create tags using the TagManager's helper function
        this.tagManager.createAllComponentTags(this.components, tagObjects);
        
        // Store references to tag objects for updating positions later
        this.tagObjects = {};
        
        // Store mixer tag references
        mixerTags.forEach((mixer) => {
            this.tagObjects[mixer.name] = {
                object3D: mixer.object3D,
                worldPosition: mixer.worldPosition
            };
        });
        
        // Store other component references
        Object.entries(otherTags).forEach(([key, value]) => {
            const tagId = this.getComponentTagId(key);
            if (tagId && value.object3D) {
                this.tagObjects[tagId] = {
                    object3D: value.object3D,
                    worldPosition: value.worldPosition
                };
            }
        });
    }
    
    /**
     * Get the world position of a position indicator
     * @param {string} indicatorId - ID of the indicator
     * @returns {pc.Vec3} Position of the indicator or null if not found
     */
    getIndicatorPosition(indicatorId) {
        if (!this.positionIndicators || !this.positionIndicators[indicatorId]) {
            return null;
        }
        
        const indicator = this.positionIndicators[indicatorId];
        const worldPos = new pc.Vec3();
        
        // Get the world position
        indicator.getWorldTransform().getTranslation(worldPos);
        return worldPos;
    }
    
    /**
     * Get standard tag ID for a component type
     * @param {string} componentType - Type of component (e.g., waterTank)
     * @returns {string} Tag ID
     */
    getComponentTagId(componentType) {
        const mapping = {
            waterTank: 'WaterTank',
            freezerTunnel: 'FreezerTunnel',
            plasticLiner: 'PlasticLiner',
            cookieFormer: 'CookieFormer',
            boxSealer: 'BoxSealer',
            conveyorSystem: 'ConveyorSystem'
        };
        
        return mapping[componentType] || null;
    }

    /**
     * Helper method to create a tag for a component - PlayCanvas specific implementation
     * that uses the common TagManager
     * @param {string} id - Tag ID
     * @param {pc.Entity} object - Object to attach tag to
     * @param {Object} options - Tag options
     */
    createComponentTag(id, object, options) {
        // Use the common TagManager to create the tag
        this.tagManager.createTag(id, options.content, id);
        
        // Store reference to 3D object for positioning
        const position = options.position || [0, 3, 0];
        this.tagObjects[id] = {
            object3D: object,
            offset: new pc.Vec3(position[0], position[1], position[2])
        };
    }

    /**
     * Update floating tag positions based on 3D positions
     */
    updateTagPositions() {
        if (!this.camera || !this.tagManager || !this.showTags) return;

        // Update all tag positions using the position indicators
        Object.keys(this.tagObjects).forEach(tagId => {
            const tagObject = this.tagObjects[tagId];
            if (!tagObject || !tagObject.object3D) return;
            
            // Calculate tag position in world space
            let worldPos;
            
            // First check if there's a matching indicator
            const indicatorName = this.getMatchingIndicatorName(tagId);
            if (indicatorName && this.positionIndicators && this.positionIndicators[indicatorName]) {
                // Use the position indicator's position for perfect tag placement
                worldPos = new pc.Vec3();
                this.positionIndicators[indicatorName].getWorldTransform().getTranslation(worldPos);
            } 
            // Fallback to direct worldPosition if available
            else if (tagObject.worldPosition) {
                worldPos = tagObject.worldPosition.clone();
            } 
            // Last resort: calculate from object + offset
            else {
                worldPos = this.getWorldPosition(tagObject.object3D);
                if (tagObject.offset) {
                    worldPos.add(tagObject.offset);
                }
            }
            
            // Project 3D position to 2D screen space
            const screenPos = this.camera.worldToScreen(worldPos);
            
            // If position is null, object is behind camera or outside frustum
            if (screenPos === null) {
                this.tagManager.updateTagPosition(tagId, 0, 0, false, 1000);
                return;
            }
            
            // Calculate if object is in front of camera
            const cameraPos = this.cameraEntity.getPosition();
            const cameraForward = this.cameraEntity.forward;
            const objectDir = new pc.Vec3().sub2(worldPos, cameraPos).normalize();
            const inFront = objectDir.dot(cameraForward) > 0;
            
            // Calculate distance to camera (for depth sorting)
            const distance = worldPos.distance(cameraPos);
            
            // Get container dimensions
            const containerRect = this.container.getBoundingClientRect();
            
            // Check if tag is within viewport bounds
            const padding = 10; // px padding from edges
            const inBounds = (
                screenPos.x >= padding && 
                screenPos.x <= (containerRect.width - padding) &&
                screenPos.y >= padding && 
                screenPos.y <= (containerRect.height - padding)
            );
            
            // Only display if in front of camera, in bounds, and tags are enabled
            const shouldDisplay = inFront && inBounds && this.showTags;
            
            // Update tag position in the DOM
            this.tagManager.updateTagPosition(
                tagId,
                screenPos.x, 
                screenPos.y,
                shouldDisplay,
                distance
            );
        });
    }
    
    /**
     * Get matching indicator name for a tag ID
     * @param {string} tagId - The tag ID to get indicator for
     * @returns {string|null} - The indicator name or null if no match found
     */
    getMatchingIndicatorName(tagId) {
        // For mixer tags
        if (tagId.startsWith('Mixer_')) {
            const mixerIndex = tagId.split('_')[1];
            return `mixerIndicator_${mixerIndex}`;
        }
        
        // For other components
        const mapping = {
            'WaterTank': 'waterTankIndicator',
            'FreezerTunnel': 'freezerIndicator',
            'PlasticLiner': 'linerIndicator',
            'CookieFormer': 'formerIndicator',
            'BoxSealer': 'sealerIndicator',
            'ConveyorSystem': 'conveyorIndicator'
        };
        
        return mapping[tagId] || null;
    }

    /**
     * Get viewport position for a tag - PlayCanvas specific implementation
     * @param {Object} tagObject - Tag object data
     * @returns {Object} - Position object with x, y, z and computed screen coordinates
     */
    getTagViewportPosition(tagObject) {
        const containerRect = this.container.getBoundingClientRect();
        
        // Use the world position directly from the indicator if available
        let worldPosition;
        if (tagObject.worldPosition) {
            worldPosition = tagObject.worldPosition.clone();
        } else {
            // Fall back to entity position if world position not available
            worldPosition = this.getWorldPosition(tagObject.object3D);
        }

        // Calculate distance to camera
        const cameraPos = this.cameraEntity.getPosition();
        const distance = worldPosition.distance(cameraPos);

        // Project 3D position to 2D screen space using PlayCanvas camera
        // Convert point from 3D world space to normalized device coordinates (NDC)
        const camera = this.camera;
        
        // Create vector objects to avoid allocations
        const viewPos = new pc.Vec3();
        const projPos = new pc.Vec3();
        
        // Create view matrix from camera
        const viewMatrix = new pc.Mat4().copy(camera.viewMatrix);
        const projMatrix = new pc.Mat4().copy(camera.projectionMatrix);
        
        // Transform point to camera space
        viewMatrix.transformPoint(worldPosition, viewPos);
        
        // Determine if point is in front of camera
        const inFront = viewPos.z < 0;
        
        // Transform from camera space to clip space
        projPos.x = (projMatrix.data[0] * viewPos.x + projMatrix.data[4] * viewPos.y + projMatrix.data[8] * viewPos.z + projMatrix.data[12]);
        projPos.y = (projMatrix.data[1] * viewPos.x + projMatrix.data[5] * viewPos.y + projMatrix.data[9] * viewPos.z + projMatrix.data[13]);
        projPos.z = (projMatrix.data[2] * viewPos.x + projMatrix.data[6] * viewPos.y + projMatrix.data[10] * viewPos.z + projMatrix.data[14]);
        const projW = (projMatrix.data[3] * viewPos.x + projMatrix.data[7] * viewPos.y + projMatrix.data[11] * viewPos.z + projMatrix.data[15]);
        
        // Early return if behind camera or at the camera position
        if (projW <= 0) {
            return {
                x: 0,
                y: 0,
                z: 0,
                distance: distance,
                inFront: false,
                inBounds: false
            };
        }
        
        // Convert to NDC by dividing by w
        projPos.x /= projW;
        projPos.y /= projW;
        projPos.z /= projW;
        
        // Convert to screen coordinates (0-1) by remapping from -1...1 to 0...1
        const screenX = ((projPos.x + 1.0) * 0.5) * containerRect.width;
        const screenY = ((1.0 - (projPos.y + 1.0) * 0.5)) * containerRect.height;
        
        // Check if within viewport bounds with padding
        const padding = 20; // pixels
        const inBounds = (
            screenX >= padding && screenX <= (containerRect.width - padding) &&
            screenY >= padding && screenY <= (containerRect.height - padding)
        );

        return {
            x: screenX,
            y: screenY,
            z: projPos.z,
            distance: distance,
            inFront: inFront,
            inBounds: inBounds
        };
    }

    /**
     * Get world position of an entity
     * @param {pc.Entity} entity - Entity to get position for
     * @returns {pc.Vec3} World position
     */
    getWorldPosition(entity) {
        // Check if entity exists and has the necessary methods
        if (!entity) {
            console.warn("Attempted to get position of null entity");
            return new pc.Vec3(0, 0, 0);
        }

        // Use the correct method to get world position based on what's available
        const pos = new pc.Vec3();
        
        // Different PlayCanvas entities might have different methods
        if (entity.getWorldTransform) {
            // Get world transform matrix
            const worldTransform = new pc.Mat4();
            entity.getWorldTransform(worldTransform);
            
            // Extract position from the transform matrix
            worldTransform.getTranslation(pos);
        } else if (entity.getPosition) {
            // For entities that have a direct getPosition method
            entity.getPosition(pos);
        } else {
            // Fallback to local position if nothing else works
            if (entity.getLocalPosition) {
                entity.getLocalPosition(pos);
            } else if (entity.localPosition) {
                pos.copy(entity.localPosition);
            }
        }
        
        return pos;
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        if (!this.isInitialized) return;
        // PlayCanvas handles resize automatically with FILLMODE_FILL_WINDOW
    }

    /**
     * Update animation for factory model
     * @param {number} time - Current timestamp
     * @param {number} deltaTime - Time elapsed since last update in seconds
     */
    updateFactoryAnimation(time, deltaTime) {
        // Update each mixer in the factory
        this.mixerModels.forEach(mixer => {
            // Get mixer-specific data if available, otherwise use global modelState
            const mixerData = mixer.data || {};
            const temperature = mixerData.temperature !== undefined ? mixerData.temperature : this.components.mixers.temperature;
            const rpm = mixerData.rpm !== undefined ? mixerData.rpm : this.components.mixers.rpm;
            const status = mixerData.status !== undefined ? mixerData.status : this.components.mixers.status;
            
            // Use common animation calculation for consistent mixer behavior across frameworks
            const animValues = VisualizationComponents.calculateAnimationValues('mixer', {
                rpm: rpm
            }, deltaTime);
            
            // Apply the rotation to all rotating parts
            if (animValues.rotationDelta) {
                this.traverseEntity(mixer.model, (entity) => {
                    if (entity.isRotatingPart) {
                        // Rotate around the appropriate axis (y-axis by default)
                        const axis = animValues.axis || 'y';
                        const rotationRad = animValues.rotationDelta;
                        
                        if (axis === 'y') {
                            entity.rotateLocal(0, rotationRad * 180 / Math.PI, 0);
                        } else if (axis === 'x') {
                            entity.rotateLocal(rotationRad * 180 / Math.PI, 0, 0);
                        } else if (axis === 'z') {
                            entity.rotateLocal(0, 0, rotationRad * 180 / Math.PI);
                        }
                    }
                });
            }

            // Update status indicators
            if (mixer.statusIndicator) {
                const statusMapping = DTProperties.mapAlarmStatus(status);
                
                // Get the material from the model component
                const material = mixer.statusIndicator.model.material;
                if (material) {
                    // Set color based on status
                    const color = this.hexToRgb(statusMapping.color);
                    material.diffuse.set(color.r, color.g, color.b);
                    material.update();
                    
                    // Handle blinking if needed
                    if (statusMapping.blinking) {
                        const blinkRate = Math.sin(time / 200) * 0.5 + 0.5;
                        material.opacity = blinkRate;
                        material.blendType = pc.BLEND_NORMAL;
                    } else {
                        material.opacity = 1;
                        material.blendType = pc.BLEND_NONE;
                    }
                    material.update();
                }
            }

            // Update tag content for this mixer using the tag manager
            if (this.tagManager) {
                this.tagManager.updateComponentTagContent(mixer.name, {
                    temperature: temperature,
                    rpm: rpm,
                    status: status
                });
            }
        });

        // Update other components following similar pattern
        // This is a simplified implementation focusing on pattern
        // Complete implementation would animate water tank, freezer tunnel,
        // plastic liner, conveyor belts, etc.

        // Example: Update water tank color based on flow rate
        if (this.components.waterTank.object3D) {
            const flowRateMapping = DTProperties.mapWaterFlowRate(this.components.waterTank.flowRate);
            
            // In a real implementation, we would update the material color
            // based on the flow rate mapping
            
            // Update water tank tag content
            if (this.tagManager) {
                this.tagManager.updateComponentTagContent('WaterTank', {
                    flowRate: this.components.waterTank.flowRate,
                    tankVolume: this.components.waterTank.tankVolume,
                    status: this.components.waterTank.status
                });
            }
        }

        // Update freezer tunnel tag content
        if (this.components.freezerTunnel.object3D && this.tagManager) {
            this.tagManager.updateComponentTagContent('FreezerTunnel', {
                temperature: this.components.freezerTunnel.temperature,
                speed: this.components.freezerTunnel.speed,
                status: this.components.freezerTunnel.status
            });
        }
        
        // Update plastic liner tag content
        if (this.components.plasticLiner.object3D && this.tagManager) {
            this.tagManager.updateComponentTagContent('PlasticLiner', {
                rpm: this.components.plasticLiner.rpm,
                status: this.components.plasticLiner.status
            });
        }
        
        // Update cookie former tag content
        if (this.components.cookieFormer.object3D && this.tagManager) {
            this.tagManager.updateComponentTagContent('CookieFormer', {
                rate: this.components.cookieFormer.rate,
                goodParts: this.components.cookieFormer.goodParts,
                status: this.components.cookieFormer.status
            });
        }
        
        // Update box sealer tag content
        if (this.components.boxSealer.object3D && this.tagManager) {
            this.tagManager.updateComponentTagContent('BoxSealer', {
                speed: this.components.boxSealer.speed,
                status: this.components.boxSealer.status
            });
        }
        
        // Update conveyor system tag content
        if (Object.keys(this.conveyors).length > 0 && this.tagManager) {
            this.tagManager.updateComponentTagContent('ConveyorSystem', {
                speed: this.components.conveyorSystem.speed,
                status: this.components.conveyorSystem.status
            });
        }
    }

    /**
     * Convert hex color to RGB object
     * @param {number} hex - Hexadecimal color value
     * @returns {Object} RGB object with r, g, b components (0-1)
     */
    hexToRgb(hex) {
        return {
            r: ((hex >> 16) & 0xFF) / 255,
            g: ((hex >> 8) & 0xFF) / 255,
            b: (hex & 0xFF) / 255
        };
    }

    /**
     * Update the visualization from digital twin data
     * @param {Object} twinState - Digital twin state data
     */
    updateFromTwin(twinState) {
        // Process the twin data using the common DTDataProcessor
        const processedData = DTDataProcessor.processTwinData(twinState, {
            selectedMixer: window.dashboardState?.selectedMixer || 'all'
        });
        
        if (!processedData) return;
        
        // Update mixers
        Object.entries(processedData.mixers).forEach(([mixerKey, mixerData]) => {
            // Find the mixer model
            const mixer = this.mixerModels.find(m => m.name === mixerKey);
            if (mixer) {
                // Store data in the mixer model for animation
                mixer.data = mixer.data || {};
                mixer.data.temperature = mixerData.temperature;
                mixer.data.rpm = mixerData.rpm;
                mixer.data.status = mixerData.status;
                
                // Update the global state if this is the selected mixer
                if (processedData.selectedMixer === mixerKey || processedData.selectedMixer === 'all') {
                    this.components.mixers.temperature = mixerData.temperature;
                    this.components.mixers.rpm = mixerData.rpm;
                    this.components.mixers.status = mixerData.status;
                }
            }
        });
        
        // Update other components
        // The pattern is the same as in Three.js implementation
        this.components.waterTank.flowRate = processedData.waterTank.flowRate;
        this.components.waterTank.tankVolume = processedData.waterTank.tankVolume;
        this.components.waterTank.status = processedData.waterTank.status;
        
        this.components.freezerTunnel.temperature = processedData.freezerTunnel.temperature;
        this.components.freezerTunnel.speed = processedData.freezerTunnel.speed;
        this.components.freezerTunnel.status = processedData.freezerTunnel.status;
        
        this.components.plasticLiner.rpm = processedData.plasticLiner.rpm;
        this.components.plasticLiner.status = processedData.plasticLiner.status;
        
        this.components.cookieFormer.rate = processedData.cookieFormer.rate;
        this.components.cookieFormer.goodParts = processedData.cookieFormer.goodParts;
        this.components.cookieFormer.status = processedData.cookieFormer.status;
        
        this.components.boxSealer.speed = processedData.boxSealer.speed;
        this.components.boxSealer.status = processedData.boxSealer.status;
        
        this.components.conveyorSystem.speed = processedData.conveyorSystem.speed;
        this.components.conveyorSystem.status = processedData.conveyorSystem.status;
    }

    /**
     * Focus the camera on a specific mixer in the factory
     * @param {string} mixerName - Name of the mixer to focus on (e.g., "Mixer_0") or "all"
     */
    focusOnMixer(mixerName) {
        if (!this.isInitialized || this.modelId !== 'factory') return;

        if (mixerName === 'all') {
            // Reset camera to overview position
            this.cameraOrbit.targetPosition = new pc.Vec3(35, 0, 75);
            this.cameraOrbit.distance = 100;
            this.cameraOrbit.yaw = 0;
            this.cameraOrbit.pitch = 0.5;
            this.updateCameraTransform();
            return;
        }

        // Find the selected mixer
        const mixer = this.mixerModels.find(m => m.name === mixerName);
        if (mixer) {
            // Check if there's a position indicator for this mixer (most accurate)
            const mixerIndex = mixer.index;
            const indicatorName = `mixerIndicator_${mixerIndex}`;
            let worldPos;
            
            if (this.positionIndicators && this.positionIndicators[indicatorName]) {
                // Use the indicator's position
                worldPos = new pc.Vec3();
                this.positionIndicators[indicatorName].getWorldTransform().getTranslation(worldPos);
            } else {
                // Fall back to using our getWorldPosition helper function
                worldPos = this.getWorldPosition(mixer.model);
            }

            // Move camera to focus on this mixer
            this.cameraOrbit.targetPosition = worldPos;
            this.cameraOrbit.distance = 15;
            this.updateCameraTransform();
            this.selectedMixer = mixer;
        }
    }

    /**
     * Focus the camera on a specific component in the factory
     * @param {string} componentId - ID of the component to focus on (e.g., "WaterTank")
     */
    focusOnComponent(componentId) {
        if (!this.isInitialized || this.modelId !== 'factory') return;

        // For mixers, use existing focusOnMixer method
        if (componentId.startsWith('Mixer_')) {
            this.focusOnMixer(componentId);
            return;
        }

        // Get common camera focus parameters
        const cameraParams = VisualizationComponents.getComponentCameraFocus(componentId);
        
        // If no parameters found, fallback to default
        if (!cameraParams) {
            console.warn(`No camera parameters found for component: ${componentId}`);
            return;
        }

        let targetObject = null;

        // Find the component based on its ID
        switch(componentId) {
            case 'WaterTank':
                targetObject = this.components.waterTank.object3D;
                break;
            
            case 'FreezerTunnel':
                targetObject = this.components.freezerTunnel.object3D;
                break;
            
            case 'PlasticLiner':
                targetObject = this.components.plasticLiner.object3D;
                break;
            
            case 'CookieFormer':
                targetObject = this.components.cookieFormer.object3D;
                break;
            
            case 'BoxSealer':
                targetObject = this.components.boxSealer.object3D;
                break;
            
            case 'ConveyorSystem':
                // Find a conveyor to focus on
                const conveyorIds = Object.keys(this.conveyors);
                if (conveyorIds.length > 0) {
                    targetObject = this.conveyors[conveyorIds[0]];
                }
                break;
            
            default:
                // Default to overview position if component not found
                this.cameraOrbit.targetPosition = new pc.Vec3(
                    cameraParams.default.target[0], 
                    cameraParams.default.target[1], 
                    cameraParams.default.target[2]
                );
                this.cameraOrbit.distance = 100;
                this.updateCameraTransform();
                return;
        }

        // Check if we have a matching position indicator which is more accurate
        const indicatorName = this.getMatchingIndicatorName(componentId);
        
        if (targetObject) {
            let worldPos;

            // First try to use position indicator if available (most accurate)
            if (indicatorName && this.positionIndicators && this.positionIndicators[indicatorName]) {
                worldPos = new pc.Vec3();
                this.positionIndicators[indicatorName].getWorldTransform().getTranslation(worldPos);
            } 
            // Otherwise get the world position directly from the target object
            else {
                worldPos = this.getWorldPosition(targetObject);
            }

            // Set camera target to object position with offset
            this.cameraOrbit.targetPosition = new pc.Vec3(
                worldPos.x + (cameraParams.offset?.target?.[0] || 0),
                worldPos.y + (cameraParams.offset?.target?.[1] || 0), 
                worldPos.z + (cameraParams.offset?.target?.[2] || 0)
            );
            
            // Set appropriate distance for this component
            this.cameraOrbit.distance = cameraParams.distance || 20;
            
            // Update camera transform based on new target and distance
            this.updateCameraTransform();
        } else {
            // Fallback to overview position
            this.cameraOrbit.targetPosition = new pc.Vec3(
                cameraParams.default.target[0], 
                cameraParams.default.target[1], 
                cameraParams.default.target[2]
            );
            this.cameraOrbit.distance = 100;
            this.updateCameraTransform();
        }
    }

    /**
     * Set camera position, target and up vector - used for automated camera control
     * @param {Array} position - [x, y, z] position coordinates
     * @param {Array} target - [x, y, z] target/lookAt coordinates
     * @param {Array} up - [x, y, z] up vector
     */
    setCameraPosition(position, target, up) {
        if (!this.cameraEntity) return;
        
        // Calculate distance between position and target
        const targetVec = new pc.Vec3(target[0], target[1], target[2]);
        const posVec = new pc.Vec3(position[0], position[1], position[2]);
        const distance = posVec.distance(targetVec);
        
        // Update orbit parameters
        this.cameraOrbit.targetPosition = targetVec;
        this.cameraOrbit.distance = distance;
        
        // Set the camera's position and look at target
        this.cameraEntity.setPosition(position[0], position[1], position[2]);
        this.cameraEntity.lookAt(target[0], target[1], target[2]);
        
        // We can't directly set the up vector, but we can use setLocalEulerAngles if needed
        // or just use the default camera orientation which should be sufficient in most cases
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
        this.textureOffsets = {};
        this.isInitialized = false;

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
            if (this.app) {
                // Stop the PlayCanvas application
                this.app.destroy();
                this.app = null;
            }

            if (this.container) {
                this.container.innerHTML = '';
            }

            window.removeEventListener('resize', this.onWindowResize);
        }
    }

    /**
     * Create position indicators on each component to help with tag positioning
     * These are invisible entities to store reference points for tag positioning
     */
    createPositionIndicators() {
        // Create empty containers to store position references
        this.positionIndicators = {};
        
        // Add indicator for water tank
        if (this.components.waterTank.object3D) {
            this.addPositionIndicator(this.components.waterTank.object3D, "waterTankIndicator", 5);
        }
        
        // Add indicators for all mixers
        this.mixerModels.forEach((mixer, index) => {
            this.addPositionIndicator(mixer.model, `mixerIndicator_${index}`, 5);
        });
        
        // Add indicators for production line components
        if (this.components.freezerTunnel.object3D) {
            this.addPositionIndicator(this.components.freezerTunnel.object3D, "freezerIndicator", 3.5);
        }
        
        if (this.components.plasticLiner.object3D) {
            this.addPositionIndicator(this.components.plasticLiner.object3D, "linerIndicator", 3);
        }
        
        if (this.components.cookieFormer.object3D) {
            this.addPositionIndicator(this.components.cookieFormer.object3D, "formerIndicator", 4);
        }
        
        if (this.components.boxSealer.object3D) {
            this.addPositionIndicator(this.components.boxSealer.object3D, "sealerIndicator", 3);
        }
        
        // Add indicator for conveyor
        const conveyorIds = Object.keys(this.conveyors);
        if (conveyorIds.length > 0) {
            this.addPositionIndicator(this.conveyors[conveyorIds[0]], "conveyorIndicator", 2.5);
        }
    }
    
    /**
     * Add a position indicator to help with tag positioning
     * @param {pc.Entity} entity - The entity to add an indicator to
     * @param {string} name - Name for the indicator
     * @param {number} height - Height offset for the indicator
     */
    addPositionIndicator(entity, name, height) {
        if (!entity) return;
        
        // Create an empty entity for the indicator (no visible model)
        const indicator = new pc.Entity(name);
        
        // Position at the component's position plus height offset
        indicator.setLocalPosition(0, height, 0);
        
        // Add the indicator to the entity
        entity.addChild(indicator);
        
        // Store reference to the indicator
        if (!this.positionIndicators) {
            this.positionIndicators = {};
        }
        this.positionIndicators[name] = indicator;
    }

    /**
     * Create tags for cookie line components
     */
    createCookieLineTags() {
        // Create tag for freezer tunnel
        if (this.components.freezerTunnel.object3D) {
            const content = VisualizationComponents.generateTagContent('freezerTunnel', this.components.freezerTunnel);
            this.tagManager.createTag('FreezerTunnel', content, 'freezerTunnel');
            
            // Store reference in tagObjects for positioning
            this.tagObjects['FreezerTunnel'] = {
                object3D: this.components.freezerTunnel.object3D,
                worldPosition: this.getWorldPosition(this.components.freezerTunnel.object3D),
                offset: new pc.Vec3(0, 3, 0)
            };
        }
        
        // Create tag for plastic liner
        if (this.components.plasticLiner.object3D) {
            const content = VisualizationComponents.generateTagContent('plasticLiner', this.components.plasticLiner);
            this.tagManager.createTag('PlasticLiner', content, 'plasticLiner');
            
            this.tagObjects['PlasticLiner'] = {
                object3D: this.components.plasticLiner.object3D,
                worldPosition: this.getWorldPosition(this.components.plasticLiner.object3D),
                offset: new pc.Vec3(0, 2.5, 0)
            };
        }
        
        // Create tag for cookie former
        if (this.components.cookieFormer.object3D) {
            const content = VisualizationComponents.generateTagContent('cookieFormer', this.components.cookieFormer);
            this.tagManager.createTag('CookieFormer', content, 'cookieFormer');
            
            this.tagObjects['CookieFormer'] = {
                object3D: this.components.cookieFormer.object3D,
                worldPosition: this.getWorldPosition(this.components.cookieFormer.object3D),
                offset: new pc.Vec3(0, 3, 0)
            };
        }
        
        // Create tag for box sealer
        if (this.components.boxSealer.object3D) {
            const content = VisualizationComponents.generateTagContent('boxSealer', this.components.boxSealer);
            this.tagManager.createTag('BoxSealer', content, 'boxSealer');
            
            this.tagObjects['BoxSealer'] = {
                object3D: this.components.boxSealer.object3D,
                worldPosition: this.getWorldPosition(this.components.boxSealer.object3D),
                offset: new pc.Vec3(0, 3, 0)
            };
        }
        
        // Create tag for conveyor system (using first conveyor as reference)
        if (Object.keys(this.conveyors).length > 0) {
            const firstConveyorId = Object.keys(this.conveyors)[0];
            const firstConveyor = this.conveyors[firstConveyorId];
            
            const content = VisualizationComponents.generateTagContent('conveyorSystem', this.components.conveyorSystem);
            this.tagManager.createTag('ConveyorSystem', content, 'conveyorSystem');
            
            this.tagObjects['ConveyorSystem'] = {
                object3D: firstConveyor,
                worldPosition: this.getWorldPosition(firstConveyor),
                offset: new pc.Vec3(0, 2, 0)
            };
        }
    }
}