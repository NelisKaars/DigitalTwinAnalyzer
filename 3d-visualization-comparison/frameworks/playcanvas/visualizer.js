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
        this.cameraControls = null;  // New variable for the camera controller

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
        
        // Add camera to scene
        this.app.root.addChild(this.cameraEntity);
        
        // Initialize camera controls
        this.cameraControls = new PlayCanvasCameraControls(this.app, this.cameraEntity);

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
            // Enhanced identification to include more potential mixer parts
            if (name.includes('bowl') || 
                name.includes('main_mixer') || 
                name.includes('blade') || 
                name.includes('paddle') ||
                name.includes('stirrer') ||
                name.includes('arm') ||
                name.includes('hand') ||
                name.includes('mixer')) {
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
            const tagId = this.tagManager.getTagIdFromComponentType(key);
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
        // Use the common implementation from VisualizationComponents
        VisualizationComponents.updateFromTwin(this, twinState);
    }

    /**
     * Focus the camera on a specific mixer in the factory
     * @param {string} mixerName - Name of the mixer to focus on (e.g., "Mixer_0") or "all"
     */
    focusOnMixer(mixerName) {
        if (!this.isInitialized || this.modelId !== 'factory' || !this.cameraControls) return;

        if (mixerName === 'all') {
            // Reset camera to overview position
            const targetPosition = new pc.Vec3(35, 0, 75);
            this.cameraControls.focusOn(targetPosition, 100, 0, 0.5);
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
            this.cameraControls.focusOn(worldPos, 15);
            this.selectedMixer = mixer;
        }
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
        if (!this.cameraControls) return false;
        
        let worldPos;

        // Check if we have a matching position indicator which is more accurate
        if (cameraParams.componentId) {
            const indicatorName = this.getMatchingIndicatorName(cameraParams.componentId);
            
            if (indicatorName && this.positionIndicators && this.positionIndicators[indicatorName]) {
                worldPos = new pc.Vec3();
                this.positionIndicators[indicatorName].getWorldTransform().getTranslation(worldPos);
            }
        }

        // If we didn't get a position from an indicator, use the object's position
        if (!worldPos) {
            worldPos = this.getWorldPosition(targetObject);
        }
            
        // Create target position with offset if provided
        const targetPosition = new pc.Vec3(
            worldPos.x + (cameraParams.offset?.target?.[0] || 0),
            worldPos.y + (cameraParams.offset?.target?.[1] || 0), 
            worldPos.z + (cameraParams.offset?.target?.[2] || 0)
        );
            
        // Use appropriate distance for this component
        const distance = cameraParams.distance || 20;
            
        // Update camera using the camera controller
        this.cameraControls.focusOn(targetPosition, distance);
        
        return true;
    }

    /**
     * Set camera position, target and up vector - used for automated camera control
     * @param {Array} position - [x, y, z] position coordinates
     * @param {Array} target - [x, y, z] target/lookAt coordinates
     * @param {Array} up - [x, y, z] up vector
     */
    setCameraPosition(position, target, up) {
        if (!this.cameraControls) return;
        
        // Delegate to camera controller
        this.cameraControls.setCameraPosition(position, target);
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
        // Clean up camera controls
        if (this.cameraControls) {
            this.cameraControls.cleanup();
            this.cameraControls = null;
        }
        
        // Use the common cleanup pattern from VisualizationComponents
        VisualizationComponents.cleanupPattern(this, keepContainer);
        
        // PlayCanvas specific cleanup
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
     * These are invisible entities that provide consistent positioning for tags
     */
    createPositionIndicators() {
        // Create empty container to store position references
        this.positionIndicators = {};
        
        // Define all indicators in a single configuration
        const indicators = [
            { entity: this.components.waterTank.object3D, id: "waterTankIndicator", height: 5 },
            { entity: this.components.freezerTunnel.object3D, id: "freezerIndicator", height: 3.5 },
            { entity: this.components.plasticLiner.object3D, id: "linerIndicator", height: 3 },
            { entity: this.components.cookieFormer.object3D, id: "formerIndicator", height: 4 },
            { entity: this.components.boxSealer.object3D, id: "sealerIndicator", height: 3 }
        ];
        
        // Add mixer indicators
        this.mixerModels.forEach((mixer, index) => {
            indicators.push({ entity: mixer.model, id: `mixerIndicator_${index}`, height: 5 });
        });
        
        // Add conveyor indicator if available
        const conveyorIds = Object.keys(this.conveyors);
        if (conveyorIds.length > 0) {
            indicators.push({ entity: this.conveyors[conveyorIds[0]], id: "conveyorIndicator", height: 2.5 });
        }
        
        // Create all indicators
        indicators.forEach(indicator => {
            if (indicator.entity) {
                // Create an empty entity for the indicator (no visible model)
                const indicatorEntity = new pc.Entity(indicator.id);
                
                // Position at the component's position plus height offset
                indicatorEntity.setLocalPosition(0, indicator.height, 0);
                
                // Add the indicator to the entity
                indicator.entity.addChild(indicatorEntity);
                
                // Store reference to the indicator
                this.positionIndicators[indicator.id] = indicatorEntity;
            }
        });
    }

    /**
     * Update camera position and rotation based on orbit parameters
     * Delegates to the camera controller
     */
    updateCameraTransform() {
        if (this.cameraControls) {
            this.cameraControls.updateCameraTransform();
        }
    }

    /**
     * Update tag positions for all floating tags
     */
    updateTagPositions() {
        // Use the tag objects to update positions
        Object.entries(this.tagObjects).forEach(([id, object]) => {
            if (object && object.object3D) {
                // Get viewport position for this object
                const pos = this.getTagViewportPosition(object);
                
                // Update tag position using the tag manager
                if (this.tagManager) {
                    this.tagManager.updateTagPosition(id, pos.x, pos.y, pos.inFront && pos.inBounds, pos.distance);
                }
            }
        });
    }

    /**
     * Calculate viewport position for a tag
     * @param {Object} object - Tag object with object3D and optional worldPosition
     * @returns {Object} Object with x, y screen coordinates, inFront flag, inBounds flag, and distance
     */
    getTagViewportPosition(object) {
        const camera = this.cameraEntity.camera;
        if (!camera || !object) {
            return { x: 0, y: 0, inFront: false, inBounds: false, distance: Infinity };
        }
        
        // Get the world position of the object
        let worldPos;
        
        // Use pre-calculated world position if provided (from indicators)
        if (object.worldPosition) {
            worldPos = object.worldPosition;
        } else {
            worldPos = this.getWorldPosition(object.object3D);
        }
        
        // Calculate screen position based on world position
        const tempVec = new pc.Vec3();
        tempVec.copy(worldPos);
        
        // Calculate distance from camera to object
        const cameraPos = new pc.Vec3();
        this.cameraEntity.getPosition(cameraPos);
        const distance = cameraPos.distance(tempVec);
        
        // Project 3D position to 2D screen space
        camera.worldToScreen(tempVec, tempVec);
        
        // Check if object is in front of camera
        const inFront = tempVec.z > 0;
        
        // Adjust screen coordinates to account for canvas size
        const screenX = tempVec.x;
        const screenY = tempVec.y;
        
        // Check if object is within screen bounds
        const inBounds = screenX >= 0 && screenX <= this.app.graphicsDevice.width &&
                        screenY >= 0 && screenY <= this.app.graphicsDevice.height;
        
        return {
            x: screenX,
            y: screenY,
            inFront: inFront,
            inBounds: inBounds,
            distance: distance
        };
    }
}