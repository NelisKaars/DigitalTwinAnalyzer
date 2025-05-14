/**
 * Babylon.js Visualization Framework Adapter
 * Adapts Babylon.js to work with the dashboard common interface
 */
// Register this framework in the global registry
if (!window.VisualizationFrameworks) {
    window.VisualizationFrameworks = {};
}

window.VisualizationFrameworks.babylonjs = {
    createInstance() {
        return new BabylonJSVisualizer();
    }
};

class BabylonJSVisualizer {
    constructor() {
        // Core Babylon.js components
        this.engine = null;
        this.scene = null;
        this.camera = null;
        this.light = null;
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
     * Initialize the Babylon.js visualizer
     * @param {Object} options - Initialization options
     * @param {HTMLElement} options.container - DOM element to render into
     * @param {string} options.modelId - ID of the model to load
     * @param {Function} options.onReady - Callback when ready
     */
    initialize(options) {
        this.container = options.container;
        this.modelId = 'factory'; // Always use factory model
        this.onReady = options.onReady || (() => { });

        // Create canvas element for Babylon.js
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.touchAction = 'none';
        canvas.style.outline = 'none';
        this.container.appendChild(canvas);

        // Create Babylon engine
        this.engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.engine.resize();
        });

        // Create scene
        this.createScene(canvas);

        // Initialize the tag manager
        this.tagManager = new TagManager(this.container);
        
        // Load factory model
        this.loadFactoryModel();

        // Start rendering loop
        this.isInitialized = true;
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
    }

    /**
     * Create the Babylon.js scene
     * @param {HTMLCanvasElement} canvas - Canvas element for rendering
     */
    createScene(canvas) {
        // Create scene
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color4(0.94, 0.94, 0.94, 1); // Light gray background
        
        // Create camera - always use factory view settings
        this.camera = new BABYLON.ArcRotateCamera(
            "camera", 
            Math.PI / 3, // alpha (positive again)
            Math.PI / 3, // beta
            120,         // radius
            new BABYLON.Vector3(35, 0, 75), // target position
            this.scene
        );
        this.camera.attachControl(canvas, true);
        this.camera.wheelPrecision = 10; // Adjust zoom sensitivity
        
        // Enhance panning speed
        this.camera.panningSensibility = 50; // Default is 1000 (lower = faster)
        this.camera.panningInertia = 0.9;    // Higher inertia for smoother movement
        
        // Set zoom limits for factory view
        this.camera.lowerRadiusLimit = 5;
        this.camera.upperRadiusLimit = 200;
        
        // Setup lighting
        this.setupLighting();

        // Register a render loop to update tag positions
        this.scene.registerBeforeRender(() => {
            this.updateTagPositions();
            this.updateFactoryAnimation();
        });

        // Set last update time for animation delta calculation
        this.lastUpdateTime = performance.now();
    }

    /**
     * Setup scene lighting
     */
    setupLighting() {
        // Create ambient light
        const ambientLight = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), this.scene);
        ambientLight.intensity = 0.5;
        ambientLight.diffuse = new BABYLON.Color3(1, 1, 1);
        ambientLight.specular = new BABYLON.Color3(1, 1, 1);

        // Create directional light for shadows
        const directionalLight = new BABYLON.DirectionalLight("directionalLight", new BABYLON.Vector3(0.5, -1, 0.5), this.scene);
        directionalLight.position = new BABYLON.Vector3(5, 10, 7);
        directionalLight.intensity = 0.8;

        // Enable shadow generation
        const shadowGenerator = new BABYLON.ShadowGenerator(1024, directionalLight);
        shadowGenerator.useBlurExponentialShadowMap = true;
        shadowGenerator.blurKernel = 32;
        
        // Store shadow generator for later use with loaded models
        this.shadowGenerator = shadowGenerator;

        // Add a point light that will change with temperature
        this.temperatureLight = new BABYLON.PointLight("temperatureLight", new BABYLON.Vector3(0, 2, 0), this.scene);
        this.temperatureLight.intensity = 0.5;
        this.temperatureLight.diffuse = new BABYLON.Color3(1, 0.7, 0.3); // Orange-yellow
        this.temperatureLight.range = 10;
    }

    /**
     * Load the factory model with multiple components
     */
    async loadFactoryModel() {
        try {
            // Get paths for all models
            const paths = ModelLoader.getModelPath('babylonjs', 'factory');

            // Step 1: Load the scene definition JSON
            const sceneDefinition = await ModelLoader.loadSceneDefinition(paths.sceneDefinition);
            if (!sceneDefinition) {
                throw new Error("Failed to load scene definition");
            }

            // Parse scene components
            this.factoryScene = FactoryScene.parseSceneDefinition(sceneDefinition);
            
            // Create a root node for the factory model
            this.modelRoot = new BABYLON.TransformNode("modelRoot", this.scene);
            
            // Flag to track if environment is flipped on X-axis
            // This will affect the position calculations for all components
            const environmentFlippedX = true;

            // Configure GLB loader to properly handle models consistently
            BABYLON.SceneLoader.OnPluginActivatedObservable.add((loader) => {
                if (loader.name === "gltf") {
                    const gltfLoader = loader;
                    // Set to AUTO mode to let Babylon.js determine the best coordinate system
                    gltfLoader.coordinateSystemMode = BABYLON.GLTFLoaderCoordinateSystemMode.AUTO;
                    gltfLoader.animationStartMode = BABYLON.GLTFLoaderAnimationStartMode.NONE;
                }
            });

            // Load environment model - directly use loaded mesh
            BABYLON.SceneLoader.ImportMeshAsync("", paths.models.environment, "", this.scene).then(result => {
                // Store reference to the environment mesh
                this.factoryEnvironment = result.meshes[0];  // Use the root mesh
                
                // Apply the transform from the scene definition
                if (this.factoryScene.environment && this.factoryScene.environment.transform) {
                    const transform = this.factoryScene.environment.transform;
                    if (transform.position) {
                        this.factoryEnvironment.position = new BABYLON.Vector3(
                            transform.position[0],
                            transform.position[1],
                            transform.position[2]
                        );
                    }
                    if (transform.rotation) {
                        this.factoryEnvironment.rotation = new BABYLON.Vector3(
                            transform.rotation[0],
                            transform.rotation[1],
                            transform.rotation[2]
                        );
                    }
                    if (transform.scale) {
                        this.factoryEnvironment.scaling = new BABYLON.Vector3(
                            -1, // Flip on X-axis
                            transform.scale[1],
                            transform.scale[2]
                        );
                    } else {
                        // If no scale is specified, still flip on X
                        this.factoryEnvironment.scaling = new BABYLON.Vector3(-1, 1, 1);
                    }
                }
                
                // Add shadows to environment meshes
                result.meshes.forEach(mesh => {
                    if (mesh.isVisible && mesh.isEnabled()) {
                        mesh.receiveShadows = true;
                    }
                });
                
                this.checkAllModelsLoaded();
            });

            // Load water tank - directly use loaded mesh
            BABYLON.SceneLoader.ImportMeshAsync("", paths.models.waterTank, "", this.scene).then(result => {
                // Store reference to the water tank mesh
                this.components.waterTank.object3D = result.meshes[0];  // Use the root mesh
                
                // Apply the transform from the scene definition
                if (this.factoryScene.waterTank && this.factoryScene.waterTank.transform) {
                    const transform = this.factoryScene.waterTank.transform;
                    if (transform.position) {
                        this.components.waterTank.object3D.position = new BABYLON.Vector3(
                            environmentFlippedX ? -transform.position[0] : transform.position[0], // Mirror X position if environment is flipped
                            transform.position[1],
                            transform.position[2]
                        );
                    }
                    if (transform.rotation) {
                        this.components.waterTank.object3D.rotation = new BABYLON.Vector3(
                            transform.rotation[0],
                            environmentFlippedX ? -transform.rotation[1] : transform.rotation[1], // Flip Y-rotation when X is flipped
                            transform.rotation[2]
                        );
                    }
                    if (transform.scale) {
                        this.components.waterTank.object3D.scaling = new BABYLON.Vector3(
                            environmentFlippedX ? -transform.scale[0] : transform.scale[0], // Match environment X-flip
                            transform.scale[1],
                            transform.scale[2]
                        );
                    } else if (environmentFlippedX) {
                        // If no scale but environment is flipped, apply X flip to model too
                        this.components.waterTank.object3D.scaling = new BABYLON.Vector3(-1, 1, 1);
                    }
                }
                
                // Add shadows to water tank meshes
                result.meshes.forEach(mesh => {
                    if (mesh.isVisible && mesh.isEnabled()) {
                        this.shadowGenerator.addShadowCaster(mesh);
                        mesh.receiveShadows = true;
                    }
                });
                
                this.checkAllModelsLoaded();
            });

            // Load cookie production lines - directly use loaded meshes
            for (let i = 0; i < this.factoryScene.cookieLines.length; i++) {
                const lineNode = this.factoryScene.cookieLines[i];
                
                BABYLON.SceneLoader.ImportMeshAsync("", paths.models.line, "", this.scene).then(result => {
                    // Store reference to the line mesh
                    const lineModel = result.meshes[0];  // Use the root mesh
                    
                    // Apply the transform from the scene definition
                    if (lineNode && lineNode.transform) {
                        const transform = lineNode.transform;
                        if (transform.position) {
                            lineModel.position = new BABYLON.Vector3(
                                environmentFlippedX ? -transform.position[0] : transform.position[0], // Mirror X position
                                transform.position[1],
                                transform.position[2]
                            );
                        }
                        if (transform.rotation) {
                            lineModel.rotation = new BABYLON.Vector3(
                                transform.rotation[0],
                                environmentFlippedX ? -transform.rotation[1] : transform.rotation[1], // Flip Y-rotation when X is flipped
                                transform.rotation[2]
                            );
                        }
                        if (transform.scale) {
                            lineModel.scaling = new BABYLON.Vector3(
                                environmentFlippedX ? -transform.scale[0] : transform.scale[0], // Match environment X-flip
                                transform.scale[1],
                                transform.scale[2]
                            );
                        } else if (environmentFlippedX) {
                            // If no scale but environment is flipped, apply X flip to model too
                            lineModel.scaling = new BABYLON.Vector3(-1, 1, 1);
                        }
                    }
                    
                    // Add shadows to line model meshes
                    result.meshes.forEach(mesh => {
                        if (mesh.isVisible && mesh.isEnabled()) {
                            this.shadowGenerator.addShadowCaster(mesh);
                            mesh.receiveShadows = true;
                        }
                    });
                    
                    // Add additional line components
                    this.setupProductionLineComponents(lineModel, result.meshes, i);
                    
                    this.cookieLines.push(lineModel);
                    this.checkAllModelsLoaded();
                });
            }

            // Load mixers - directly use loaded meshes
            const mixersToLoad = Math.min(6, this.factoryScene.mixers.length);
            for (let i = 0; i < mixersToLoad; i++) {
                const mixerNode = this.factoryScene.mixers[i];
                
                BABYLON.SceneLoader.ImportMeshAsync("", paths.models.mixer, "", this.scene).then(result => {
                    // Store reference to the mixer mesh
                    const mixerModel = result.meshes[0];  // Use the root mesh
                    // Store metadata
                    mixerModel.metadata = {
                        mixerIndex: i,
                        mixerName: mixerNode.name
                    };
                    
                    let rotatingPart = null;
                    
                    // Find the rotating part and add shadows
                    result.meshes.forEach(mesh => {
                        // Add shadows to mixer model meshes
                        if (mesh.isVisible && mesh.isEnabled()) {
                            this.shadowGenerator.addShadowCaster(mesh);
                            mesh.receiveShadows = true;
                        }
                        
                        // Identify rotating parts based on name
                        const name = mesh.name.toLowerCase();
                        if (name.includes('mixer')) {
                            mesh.metadata = { isRotatingPart: true };
                            rotatingPart = mesh;
                        }
                    });
                    
                    // Apply the transform from the scene definition
                    if (mixerNode && mixerNode.transform) {
                        const transform = mixerNode.transform;
                        if (transform.position) {
                            mixerModel.position = new BABYLON.Vector3(
                                environmentFlippedX ? -transform.position[0] : transform.position[0], // Mirror X position
                                transform.position[1],
                                transform.position[2]
                            );
                        }
                        if (transform.rotation) {
                            mixerModel.rotation = new BABYLON.Vector3(
                                transform.rotation[0],
                                environmentFlippedX ? -transform.rotation[1] : transform.rotation[1], // Flip Y-rotation when X is flipped
                                transform.rotation[2]
                            );
                        }
                        if (transform.scale) {
                            mixerModel.scaling = new BABYLON.Vector3(
                                environmentFlippedX ? -transform.scale[0] : transform.scale[0], // Match environment X-flip
                                transform.scale[1],
                                transform.scale[2]
                            );
                        } else if (environmentFlippedX) {
                            // If no scale but environment is flipped, apply X flip to model too
                            mixerModel.scaling = new BABYLON.Vector3(-1, 1, 1);
                        }
                    }
                    
                    this.mixerModels.push({
                        model: mixerModel,
                        name: mixerNode.name,
                        index: i,
                        rotatingPart: rotatingPart
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
     * @param {BABYLON.TransformNode} lineModel - The line model to add components to
     * @param {Array<BABYLON.AbstractMesh>} meshes - Meshes from loaded model
     * @param {number} lineIndex - Index of the line
     */
    setupProductionLineComponents(lineModel, meshes, lineIndex) {
        // Only set up components for the first line for simplicity
        if (lineIndex > 0) return;
        
        meshes.forEach(mesh => {
            if (!mesh.isVisible || !mesh.isEnabled()) return;
            
            const name = mesh.name.toLowerCase();
            
            // Freezer tunnel
            if (name.includes('freezer') || name.includes('tunnel')) {
                this.components.freezerTunnel.object3D = mesh;
                mesh.userData = { type: 'freezer' };
                
                // Clone material for individual coloring
                mesh.material = mesh.material.clone();
            }
            // Plastic liner
            else if (name.includes('plastic') || name.includes('liner')) {
                this.components.plasticLiner.object3D = mesh;
                mesh.userData = { type: 'liner' };
                
                // Clone material for individual coloring
                mesh.material = mesh.material.clone();
                
                // Create plastic liner texture if it doesn't have one
                if (mesh.material && !mesh.material.diffuseTexture) {
                    // Create procedural texture for plastic liner
                    const textureData = FactoryModelLoader.generateProceduralTexture('plasticLiner');
                    const texture = new BABYLON.Texture.CreateFromBase64String(
                        textureData.canvas.toDataURL(), 
                        "plasticLinerTexture", 
                        this.scene, 
                        false, 
                        true
                    );
                    
                    // Set texture properties
                    texture.uScale = textureData.params.repeat[0];
                    texture.vScale = textureData.params.repeat[1];
                    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
                    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
                    
                    // Apply texture to material
                    mesh.material.diffuseTexture = texture;
                    
                    // Initialize texture offset tracking
                    this.textureOffsets['plastic_liner'] = {
                        u: 0,
                        v: 0
                    };
                }
            }
            // Cookie former
            else if (name.includes('cookie') && name.includes('form')) {
                this.components.cookieFormer.object3D = mesh;
                mesh.userData = { type: 'former' };
                
                // Clone material for individual coloring
                mesh.material = mesh.material.clone();
            }
            // Box sealer
            else if (name.includes('box') && (name.includes('seal') || name.includes('erect'))) {
                this.components.boxSealer.object3D = mesh;
                mesh.userData = { type: 'sealer' };
                
                // Clone material for individual coloring
                mesh.material = mesh.material.clone();
            }
            // Conveyor sections
            else if (name.includes('conveyor')) {
                const conveyorId = `conveyor_${Object.keys(this.conveyors).length}`;
                this.conveyors[conveyorId] = mesh;
                mesh.userData = { 
                    type: 'conveyor',
                    conveyorId: conveyorId
                };
                
                // Clone material for individual textures
                mesh.material = mesh.material.clone();
                
                // Create conveyor texture if it doesn't have one
                if (mesh.material && !mesh.material.diffuseTexture) {
                    // Create procedural texture for conveyor
                    const textureData = FactoryModelLoader.generateProceduralTexture('conveyor');
                    const texture = new BABYLON.Texture.CreateFromBase64String(
                        textureData.canvas.toDataURL(), 
                        `conveyorTexture_${conveyorId}`, 
                        this.scene, 
                        false, 
                        true
                    );
                    
                    // Set texture properties
                    texture.uScale = textureData.params.repeat[0];
                    texture.vScale = textureData.params.repeat[1];
                    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
                    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
                    
                    // Apply texture to material
                    mesh.material.diffuseTexture = texture;
                    
                    // Initialize texture offset tracking
                    this.textureOffsets[conveyorId] = {
                        u: 0,
                        v: 0
                    };
                }
            }
        });
    }

    /**
     * Apply transforms from scene definition to a model - Babylon.js specific implementation
     * @param {BABYLON.TransformNode|BABYLON.AbstractMesh} model - Babylon.js node to transform
     * @param {Object} nodeData - Node data from scene definition
     */
    applyModelTransform(model, nodeData) {
        if (!nodeData || !nodeData.transform) return;

        const transform = nodeData.transform;

        // Apply position
        if (transform.position) {
            model.position = new BABYLON.Vector3(
                transform.position[0],
                transform.position[1],
                transform.position[2]
            );
        }

        // Apply rotation (convert from scene definition format to radians)
        if (transform.rotation) {
            model.rotation = new BABYLON.Vector3(
                transform.rotation[0],
                transform.rotation[1],
                transform.rotation[2]
            );
        }

        // Apply scale
        if (transform.scale) {
            model.scaling = new BABYLON.Vector3(
                -1,
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
            // Create a sphere for the status indicator
            const indicator = BABYLON.MeshBuilder.CreateSphere(`statusIndicator_${mixer.name}`, {
                diameter: 0.4,
                segments: 16
            }, this.scene);
            
            // Create material for the indicator
            const material = new BABYLON.StandardMaterial(`statusIndicatorMaterial_${mixer.name}`, this.scene);
            material.diffuseColor = new BABYLON.Color3(0, 1, 0); // Default green color
            material.emissiveColor = new BABYLON.Color3(0, 1, 0); // Glow effect
            indicator.material = material;
            
            // Position above the mixer
            indicator.position = new BABYLON.Vector3(0, 2.84, 0);
            indicator.parent = mixer.model;
            
            // Store reference to the status indicator
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
                offset: new BABYLON.Vector3(0, 5, 0)
            },
            freezerTunnel: {
                object3D: this.components.freezerTunnel.object3D,
                offset: new BABYLON.Vector3(0, 3, 0)
            },
            plasticLiner: {
                object3D: this.components.plasticLiner.object3D,
                offset: new BABYLON.Vector3(0, 2.5, 0)
            },
            cookieFormer: {
                object3D: this.components.cookieFormer.object3D,
                offset: new BABYLON.Vector3(0, 3, 0)
            },
            boxSealer: {
                object3D: this.components.boxSealer.object3D,
                offset: new BABYLON.Vector3(0, 3, 0)
            }
        };

        // Add a conveyor system reference if available
        if (Object.keys(this.conveyors).length > 0) {
            const firstConveyorId = Object.keys(this.conveyors)[0];
            tagObjects.conveyorSystem = {
                object3D: this.conveyors[firstConveyorId],
                offset: new BABYLON.Vector3(0, 2, 0)
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
                offset: new BABYLON.Vector3(0, 3.5, 0)
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
     * Helper method to create a tag for a component - Babylon.js specific implementation
     * that uses the common TagManager
     * @param {string} id - Tag ID
     * @param {BABYLON.AbstractMesh|BABYLON.TransformNode} object - Object to attach tag to
     * @param {Object} options - Tag options
     */
    createComponentTag(id, object, options) {
        // Use the common TagManager to create the tag
        this.tagManager.createTag(id, options.content, id);
        
        // Store reference to 3D object for positioning
        const position = options.position || [0, 3, 0];
        this.tagObjects[id] = {
            object3D: object,
            offset: new BABYLON.Vector3(position[0], position[1], position[2])
        };
    }

    /**
     * Update floating tag positions based on 3D positions
     */
    updateTagPositions() {
        if (!this.camera || !this.scene || !this.tagManager) return;

        // Update all tag positions
        Object.keys(this.tagObjects).forEach(tagId => {
            const tagObject = this.tagObjects[tagId];
            
            // Calculate the screen position for the tag
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
     * Get viewport position for a tag - Babylon.js specific implementation
     * @param {Object} tagObject - Tag object data
     * @returns {Object} - Position object with x, y, z and computed screen coordinates
     */
    getTagViewportPosition(tagObject) {
        const containerRect = this.container.getBoundingClientRect();
        
        // Simply use the helper sphere position directly - nothing else
        const objectPos = tagObject.object3D.getAbsolutePosition().add(tagObject.offset.clone());

        // Calculate distance to camera
        const cameraPosition = this.camera.position;
        const distance = BABYLON.Vector3.Distance(cameraPosition, objectPos);
        
        // Project 3D position to 2D screen position
        const projectedPosition = BABYLON.Vector3.Project(
            objectPos,
            BABYLON.Matrix.Identity(),
            this.scene.getTransformMatrix(),
            this.camera.viewport.toGlobal(
                this.engine.getRenderWidth(), 
                this.engine.getRenderHeight()
            )
        );
        
        // Check if the position is in front of the camera (not behind)
        const inFront = projectedPosition.z >= 0 && projectedPosition.z < 1;
        
        const x = projectedPosition.x;
        const y = projectedPosition.y;

        // Check if within viewport bounds with padding
        const padding = 20; // pixels
        const inBounds = (
            x >= padding && x <= (containerRect.width - padding) &&
            y >= padding && y <= (containerRect.height - padding)
        );
        
        return {x, y, z: projectedPosition.z, distance, inFront, inBounds};
    }

    /**
     * Animation loop for factory model
     */
    updateFactoryAnimation() {
        if (!this.isInitialized) return;

        // Calculate delta time in seconds
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = currentTime;

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
                // Updated: Find and rotate all parts with isRotatingPart metadata
                this.findMeshesInTransformNode(mixer.model).forEach(mesh => {
                    if (mesh.metadata && mesh.metadata.isRotatingPart) {
                        // Rotate around the appropriate axis (y-axis by default)
                        const axis = animValues.axis || 'y';
                        if (axis === 'y') {
                            mesh.rotation.y += animValues.rotationDelta;
                        } else if (axis === 'x') {
                            mesh.rotation.x += animValues.rotationDelta;
                        } else if (axis === 'z') {
                            mesh.rotation.z += animValues.rotationDelta;
                        }
                    }
                });
            }

            // Update status indicators
            if (mixer.statusIndicator) {
                const statusMapping = DTProperties.mapAlarmStatus(status);
                const color = this.hexToColor3(statusMapping.color);
                mixer.statusIndicator.material.diffuseColor = color;
                mixer.statusIndicator.material.emissiveColor = color;

                // Handle blinking if needed
                if (statusMapping.blinking) {
                    const blinkRate = Math.sin(currentTime / 200) * 0.5 + 0.5;
                    mixer.statusIndicator.material.alpha = blinkRate;
                } else {
                    mixer.statusIndicator.material.alpha = 1;
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

        // Update water tank color based on flow rate
        if (this.components.waterTank.object3D) {
            const flowRateMapping = DTProperties.mapWaterFlowRate(this.components.waterTank.flowRate);
            const color = this.hexToColor3(flowRateMapping.color);
            
            // Find all water tank meshes
            this.findMeshesInTransformNode(this.components.waterTank.object3D).forEach(mesh => {
                if (mesh.material) {
                    // Find the actual water tank body (not pipes or structure)
                    const name = mesh.name.toLowerCase();
                    if (name.includes('water') || name.includes('tank') || name.includes('liquid')) {
                        mesh.material.emissiveColor = color.scale(flowRateMapping.intensity * 0.3);
                    }
                }
            });

            // Update water tank tag content using the tag manager
            if (this.tagManager) {
                this.tagManager.updateComponentTagContent('WaterTank', {
                    flowRate: this.components.waterTank.flowRate,
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
            const color = new BABYLON.Color3(0.2, 0.4, 0.8); // Blue-ish color for freezer

            // Apply material changes to the freezer tunnel
            if (this.components.freezerTunnel.object3D.material) {
                this.components.freezerTunnel.object3D.material.emissiveColor = color.scale(intensity);
            }

            // Update freezer tunnel tag content using the tag manager
            if (this.tagManager) {
                this.tagManager.updateComponentTagContent('FreezerTunnel', {
                    temperature: this.components.freezerTunnel.temperature,
                    speed: this.components.freezerTunnel.speed,
                    status: this.components.freezerTunnel.status
                });
            }
        }

        // Update plastic liner - animate texture instead of rotating the object
        if (this.components.plasticLiner.object3D) {
            if (this.components.plasticLiner.object3D.material && 
                this.components.plasticLiner.object3D.material.diffuseTexture) {
                
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
                    this.components.plasticLiner.object3D.material.diffuseTexture.uOffset = offset.u;
                    this.components.plasticLiner.object3D.material.diffuseTexture.vOffset = offset.v;
                    
                    // Store updated offset
                    this.textureOffsets['plastic_liner'] = offset;
                }
            }

            // Update plastic liner tag content using the tag manager
            if (this.tagManager) {
                this.tagManager.updateComponentTagContent('PlasticLiner', {
                    rpm: this.components.plasticLiner.rpm,
                    status: this.components.plasticLiner.status
                });
            }
        }

        // Update cookie former using the tag manager
        if (this.components.cookieFormer.object3D && this.tagManager) {
            this.tagManager.updateComponentTagContent('CookieFormer', {
                rate: this.components.cookieFormer.rate,
                goodParts: this.components.cookieFormer.goodParts,
                status: this.components.cookieFormer.status
            });
        }

        // Update box sealer using the tag manager
        if (this.components.boxSealer.object3D && this.tagManager) {
            this.tagManager.updateComponentTagContent('BoxSealer', {
                speed: this.components.boxSealer.speed,
                status: this.components.boxSealer.status
            });
        }

        // Update conveyor belts - animate texture instead of rotating the mesh
        Object.entries(this.conveyors).forEach(([id, conveyor]) => {
            if (conveyor.material && conveyor.material.diffuseTexture) {
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
                    conveyor.material.diffuseTexture.uOffset = offset.u;
                    conveyor.material.diffuseTexture.vOffset = offset.v;
                    
                    // Store updated offset
                    this.textureOffsets[id] = offset;
                }
            }
        });

        // Update conveyor system tag if it exists using the tag manager
        if (this.tagManager) {
            this.tagManager.updateComponentTagContent('ConveyorSystem', {
                speed: this.components.conveyorSystem.speed,
                status: this.components.conveyorSystem.status
            });
        }
    }

    /**
     * Helper method to convert hex color to Babylon.js Color3
     * @param {number} hex - Hex color value (e.g., 0xff0000)
     * @returns {BABYLON.Color3} - Babylon.js Color3 object
     */
    hexToColor3(hex) {
        const r = ((hex >> 16) & 255) / 255;
        const g = ((hex >> 8) & 255) / 255;
        const b = (hex & 255) / 255;
        return new BABYLON.Color3(r, g, b);
    }

    /**
     * Helper method to find all meshes in a transform node hierarchy
     * @param {BABYLON.TransformNode|BABYLON.AbstractMesh} node - The node to search in
     * @returns {Array<BABYLON.AbstractMesh>} - Array of meshes found
     */
    findMeshesInTransformNode(node) {
        const meshes = [];
        
        if (node instanceof BABYLON.AbstractMesh) {
            meshes.push(node);
        }
        
        // If it has children, search them too
        if (node.getChildren) {
            node.getChildren().forEach(child => {
                meshes.push(...this.findMeshesInTransformNode(child));
            });
        }
        
        return meshes;
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
        if (!this.isInitialized || this.modelId !== 'factory') return false;

        if (mixerName === 'all') {
            // Reset camera to overview position
            this.camera.setPosition(new BABYLON.Vector3(35, 30, 100));
            this.camera.setTarget(new BABYLON.Vector3(35, 0, 75));
            return true;
        }

        // Find the selected mixer
        const mixer = this.mixerModels.find(m => m.name === mixerName);
        if (mixer) {
            const pos = mixer.model.position;

            // Move camera to focus on this mixer
            this.camera.setPosition(new BABYLON.Vector3(pos.x, pos.y + 5, pos.z + 10));
            this.camera.setTarget(new BABYLON.Vector3(pos.x, pos.y, pos.z));

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
        const pos = targetObject.getAbsolutePosition();
        
        // Use the camera offset from the common parameters
        this.camera.setPosition(new BABYLON.Vector3(
            pos.x + cameraParams.offset.camera[0],
            pos.y + cameraParams.offset.camera[1],
            pos.z + cameraParams.offset.camera[2]
        ));
        
        // Look at the object position
        this.camera.setTarget(new BABYLON.Vector3(
            pos.x + cameraParams.offset.target[0], 
            pos.y + cameraParams.offset.target[1], 
            pos.z + cameraParams.offset.target[2]
        ));
    }

    /**
     * Set camera position, target and up vector - used for automated camera control
     * @param {Array} position - [x, y, z] position coordinates
     * @param {Array} target - [x, y, z] target/lookAt coordinates
     * @param {Array} up - [x, y, z] up vector
     */
    setCameraPosition(position, target, up) {
        if (!this.camera) return;
        // Set camera position
        this.camera.setPosition(new BABYLON.Vector3(-position[0], position[1], position[2]));
        
        // Set target for camera
        this.camera.setTarget(new BABYLON.Vector3(-target[0], target[1], target[2]));
        
        // Set up vector
        this.camera.upVector = new BABYLON.Vector3(up[0], up[1], up[2]);
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
        // Clean up helper spheres
        if (this.tagObjects) {
            Object.values(this.tagObjects).forEach(tagObject => {
                if (tagObject.helperSphere) {
                    tagObject.helperSphere.dispose();
                }
            });
        }
        
        // Use the common cleanup pattern for standard cleanup
        VisualizationComponents.cleanupPattern(this, keepContainer);
        
        // Babylon.js-specific cleanup
        if (this.scene) {
            this.scene.dispose();
            this.scene = null;
        }

        if (!keepContainer) {
            if (this.engine) {
                this.engine.dispose();
                this.engine = null;
            }

            if (this.container) {
                this.container.innerHTML = '';
            }
        }
    }
}