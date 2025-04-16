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
        
        // Factory scene components
        this.factoryScene = null;
        this.mixerModels = [];
        this.factoryEnvironment = null;
        this.waterTank = null;
        this.cookieLines = [];
        this.selectedMixer = null;
        
        // Additional factory equipment
        this.freezerTunnel = null;
        this.plasticLiner = null;
        this.cookieFormer = null;
        this.boxSealer = null;
        this.conveyors = {};
        
        // Floating tags for real-time data
        this.tags = {};
        this.tagOpacity = 0.8;
        this.showTags = true;
        
        // State tracking
        this.isInitialized = false;
        this.animationFrame = null;
        this.lastUpdateTime = 0;
        this.modelState = {
            temperature: 100,
            rpm: 60,
            status: 'NORMAL',
            waterFlowRate: 35,
            tankVolume: 75,
            freezerTemperature: -15,
            linerRPM: 45,
            cookieFormerRate: 120,
            conveyorSpeed: 0.8,
            goodParts: 98.5
        };
        
        // Effects
        this.temperatureLight = null;
        this.statusIndicator = null;

        // Tag interaction system
        this.hoveredTag = null;
        this.focusedTag = null;
        this.tagBaseOpacity = 0.6;  // All tags are at least this visible
        this.tagFocusOpacity = 0.9; // Opacity when focused or hovered
        this.tagBaseScale = 0.6;    // Base scale for tags
        this.tagFocusScale = 1.0;   // Scale when focused or hovered
        this.tagScaleTransition = 0.2; // Seconds for scale transition 
        
        // For textures (especially conveyor belts and plastic liner)
        this.textureOffsets = {};
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
        this.modelId = options.modelId;
        this.onReady = options.onReady || (() => {});
        
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        
        if (this.modelId === 'factory') {
            // Position camera further back for factory view
            this.camera.position.set(35, 30, 100);
        } else {
            // Default camera position for mixer
            this.camera.position.set(0, 2, 5);
        }
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
        
        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // Lighting
        this.setupLighting();
        
        // Ground plane
        this.setupGround();
        
        // Load model
        this.loadModel();
        
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
     * Load the 3D model based on modelId
     */
    loadModel() {
        if (this.modelId === 'factory') {
            this.loadFactoryModel();
        } else {
            // Load single mixer model
            const modelPath = ModelLoader.getModelPath('threejs', 'mixer');
            
            const loader = new THREE.GLTFLoader();
            loader.load(
                modelPath,
                this.onModelLoaded.bind(this),
                this.onLoadProgress.bind(this),
                this.onLoadError.bind(this)
            );
        }
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
                this.waterTank = gltf.scene;
                this.applyModelTransform(this.waterTank, this.factoryScene.waterTank);
                this.scene.add(this.waterTank);
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
                this.freezerTunnel = node;
                node.userData.type = 'freezer';
                node.material = node.material.clone(); // Clone material for individual coloring
            }
            // Plastic liner
            else if (name.includes('plastic') || name.includes('liner')) {
                this.plasticLiner = node;
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
                this.cookieFormer = node;
                node.userData.type = 'former';
                node.material = node.material.clone();
            }
            // Box sealer
            else if (name.includes('box') && (name.includes('seal') || name.includes('erect'))) {
                this.boxSealer = node;
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
                                     (this.waterTank ? 1 : 0) + 
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
        // Create a container for all tags and position it relative to the visualization container
        const tagContainerElement = document.createElement('div');
        tagContainerElement.className = 'floating-tags-container';
        tagContainerElement.style.position = 'absolute';
        tagContainerElement.style.top = '0';
        tagContainerElement.style.left = '0';
        tagContainerElement.style.width = '100%';
        tagContainerElement.style.height = '100%';
        tagContainerElement.style.pointerEvents = 'none';
        tagContainerElement.style.overflow = 'hidden'; // Prevent tags from showing outside container
        tagContainerElement.style.zIndex = '10'; // Set z-index higher than scene but lower than other UI elements
        
        this.container.style.position = 'relative'; // Ensure container has relative positioning
        this.container.appendChild(tagContainerElement);
        this.tagContainer = tagContainerElement;
        
        // Create tags for each mixer
        this.mixerModels.forEach((mixer, index) => {
            const tagId = mixer.name;
            const tagGroup = new THREE.Group();
            
            // Position above the mixer (higher than the status indicator)
            tagGroup.position.set(0, 3.5, 0);
            
            // Create text using HTML and CSS
            const tagElement = document.createElement('div');
            tagElement.className = 'floating-tag';
            tagElement.id = `tag-${tagId}`;
            tagElement.style.position = 'absolute';
            tagElement.style.padding = '8px';
            tagElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            tagElement.style.color = 'white';
            tagElement.style.borderRadius = '5px';
            tagElement.style.fontSize = '12px';
            tagElement.style.fontFamily = 'Arial, sans-serif';
            tagElement.style.width = 'auto';
            tagElement.style.textAlign = 'left';
            tagElement.style.display = this.showTags ? 'block' : 'none';
            tagElement.style.transform = `translate(-50%, -50%) scale(${this.tagBaseScale})`;
            tagElement.style.opacity = this.tagBaseOpacity.toString();
            tagElement.style.transition = `transform ${this.tagScaleTransition}s ease-out, opacity ${this.tagScaleTransition}s ease-out`;
            tagElement.innerHTML = `
                <div><strong>${mixer.name}</strong></div>
                <div>Temperature: ${this.modelState.temperature}°C</div>
                <div>RPM: ${this.modelState.rpm}</div>
                <div>Status: ${this.modelState.status}</div>
            `;
            
            // Add mouse interaction
            this.setupTagInteraction(tagElement, tagId);
            
            this.tagContainer.appendChild(tagElement);
            
            // Store references
            this.tags[tagId] = {
                element: tagElement,
                object3D: tagGroup,
                type: 'mixer',
                index: mixer.index,
                priority: (6 - index) // Higher priority for first mixers (reverse of index)
            };
            
            mixer.model.add(tagGroup);
        });
        
        // Create tag for water tank
        if (this.waterTank) {
            const tagId = 'WaterTank';
            const tagGroup = new THREE.Group();
            
            // Position above the water tank
            tagGroup.position.set(0, 5, 0);
            
            // Create text using HTML and CSS
            const tagElement = document.createElement('div');
            tagElement.className = 'floating-tag';
            tagElement.id = `tag-${tagId}`;
            tagElement.style.position = 'absolute';
            tagElement.style.padding = '8px';
            tagElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            tagElement.style.color = 'white';
            tagElement.style.borderRadius = '5px';
            tagElement.style.fontSize = '12px';
            tagElement.style.fontFamily = 'Arial, sans-serif';
            tagElement.style.width = 'auto';
            tagElement.style.textAlign = 'left';
            tagElement.style.display = this.showTags ? 'block' : 'none';
            tagElement.style.transform = `translate(-50%, -50%) scale(${this.tagBaseScale})`;
            tagElement.style.opacity = this.tagBaseOpacity.toString();
            tagElement.style.transition = `transform ${this.tagScaleTransition}s ease-out, opacity ${this.tagScaleTransition}s ease-out`;
            tagElement.innerHTML = `
                <div><strong>Water Tank</strong></div>
                <div>Flow Rate: ${this.modelState.waterFlowRate}</div>
                <div>Volume: ${this.modelState.tankVolume}%</div>
            `;
            
            // Add mouse interaction
            this.setupTagInteraction(tagElement, tagId);
            
            this.tagContainer.appendChild(tagElement);
            
            // Store references
            this.tags[tagId] = {
                element: tagElement,
                object3D: tagGroup,
                type: 'watertank'
            };
            
            this.waterTank.add(tagGroup);
        }
        
        // Create tags for additional components from CookieFactoryV3
        
        // Freezer Tunnel tag
        if (this.freezerTunnel) {
            this.createComponentTag('FreezerTunnel', this.freezerTunnel, {
                position: [0, 3, 0],
                content: `
                    <div><strong>Freezer Tunnel</strong></div>
                    <div>Temperature: ${this.modelState.freezerTemperature}°C</div>
                    <div>Speed: ${this.modelState.conveyorSpeed} m/s</div>
                    <div>State: RUNNING</div>
                `
            });
        }
        
        // Plastic Liner tag
        if (this.plasticLiner) {
            this.createComponentTag('PlasticLiner', this.plasticLiner, {
                position: [0, 2.5, 0],
                content: `
                    <div><strong>Plastic Liner</strong></div>
                    <div>RPM: ${this.modelState.linerRPM}</div>
                    <div>Status: NORMAL</div>
                `
            });
        }
        
        // Cookie Former tag
        if (this.cookieFormer) {
            this.createComponentTag('CookieFormer', this.cookieFormer, {
                position: [0, 3, 0],
                content: `
                    <div><strong>Cookie Former</strong></div>
                    <div>Rate: ${this.modelState.cookieFormerRate}/min</div>
                    <div>Good Parts: ${this.modelState.goodParts}%</div>
                `
            });
        }
        
        // Box Sealer tag
        if (this.boxSealer) {
            this.createComponentTag('BoxSealer', this.boxSealer, {
                position: [0, 3, 0],
                content: `
                    <div><strong>Box Sealer</strong></div>
                    <div>Speed: ${this.modelState.conveyorSpeed} m/s</div>
                    <div>Status: OPERATIONAL</div>
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
                    <div>Speed: ${this.modelState.conveyorSpeed} m/s</div>
                    <div>Status: RUNNING</div>
                `
            });
        }
    }
    
    /**
     * Setup mouse interaction for a tag element
     * @param {HTMLElement} tagElement - The tag element
     * @param {string} tagId - ID of the tag
     */
    setupTagInteraction(tagElement, tagId) {
        // Make tag element receive pointer events
        tagElement.style.pointerEvents = 'auto';
        tagElement.style.cursor = 'pointer';
        
        // Mouse enter - highlight tag
        tagElement.addEventListener('mouseenter', () => {
            this.hoveredTag = tagId;
            this.updateTagVisualState(tagId, true);
        });
        
        // Mouse leave - remove highlight unless focused
        tagElement.addEventListener('mouseleave', () => {
            this.hoveredTag = null;
            if (this.focusedTag !== tagId) {
                this.updateTagVisualState(tagId, false);
            }
        });
        
        // Click - focus on tag
        tagElement.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent click from propagating to canvas
            
            // If already focused, unfocus
            if (this.focusedTag === tagId) {
                this.focusedTag = null;
                this.updateTagVisualState(tagId, this.hoveredTag === tagId);
            } else {
                // Unfocus previous focused tag
                if (this.focusedTag && this.tags[this.focusedTag]) {
                    this.updateTagVisualState(this.focusedTag, this.hoveredTag === this.focusedTag);
                }
                
                // Focus this tag
                this.focusedTag = tagId;
                this.updateTagVisualState(tagId, true);
                
                // Potentially focus camera on this component
                this.focusOnComponent(tagId);
            }
        });
    }
    
    /**
     * Update the visual state of a tag based on hover/focus state
     * @param {string} tagId - ID of the tag
     * @param {boolean} highlight - Whether to highlight the tag
     */
    updateTagVisualState(tagId, highlight) {
        const tag = this.tags[tagId];
        if (!tag || !tag.element) return;
        
        const element = tag.element;
        
        if (highlight) {
            // Highlight the tag - make it more visible and larger
            element.style.opacity = this.tagFocusOpacity.toString();
            element.style.transform = `translate(-50%, -50%) scale(${this.tagFocusScale})`;
            element.style.zIndex = '100'; // Bring to front
        } else {
            // Return to normal state
            element.style.opacity = this.tagBaseOpacity.toString();
            element.style.transform = `translate(-50%, -50%) scale(${this.tagBaseScale})`;
            element.style.zIndex = '10';
        }
    }
    
    /**
     * Focus the camera on a component when its tag is clicked
     * @param {string} tagId - ID of the tag/component
     */
    focusOnComponent(tagId) {
        // For mixers, use existing focusOnMixer method
        if (tagId.startsWith('Mixer_')) {
            this.focusOnMixer(tagId);
            return;
        }
        
        // For other components, find their position and focus on them
        let targetObject = null;
        
        switch(tagId) {
            case 'WaterTank':
                targetObject = this.waterTank;
                break;
            case 'FreezerTunnel':
                targetObject = this.freezerTunnel;
                break;
            case 'PlasticLiner':
                targetObject = this.plasticLiner;
                break;
            case 'CookieFormer':
                targetObject = this.cookieFormer;
                break;
            case 'BoxSealer':
                targetObject = this.boxSealer;
                break;
            case 'ConveyorSystem':
                targetObject = Object.values(this.conveyors)[0];
                break;
        }
        
        if (targetObject) {
            // Get world position of the object
            const pos = new THREE.Vector3();
            targetObject.getWorldPosition(pos);
            
            // Move camera to focus on this component
            this.camera.position.set(pos.x + 5, pos.y + 5, pos.z + 10);
            this.controls.target.set(pos.x, pos.y, pos.z);
            this.controls.update();
        }
    }
    
    /**
     * Helper method to create a tag for a component
     * @param {string} id - Tag ID
     * @param {THREE.Object3D} object - Object to attach tag to
     * @param {Object} options - Tag options
     */
    createComponentTag(id, object, options) {
        const tagGroup = new THREE.Group();
        
        // Position tag
        const position = options.position || [0, 3, 0];
        tagGroup.position.set(position[0], position[1], position[2]);
        
        // Create text using HTML and CSS
        const tagElement = document.createElement('div');
        tagElement.className = 'floating-tag';
        tagElement.id = `tag-${id}`;
        tagElement.style.position = 'absolute';
        tagElement.style.padding = '8px';
        tagElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        tagElement.style.color = 'white';
        tagElement.style.borderRadius = '5px';
        tagElement.style.fontSize = '12px';
        tagElement.style.fontFamily = 'Arial, sans-serif';
        tagElement.style.width = 'auto';
        tagElement.style.textAlign = 'left';
        tagElement.style.display = this.showTags ? 'block' : 'none';
        tagElement.style.transform = `translate(-50%, -50%) scale(${this.tagBaseScale})`;
        tagElement.style.opacity = this.tagBaseOpacity.toString();
        tagElement.style.transition = `transform ${this.tagScaleTransition}s ease-out, opacity ${this.tagScaleTransition}s ease-out`;
        tagElement.innerHTML = options.content;
        
        // Add mouse interaction
        this.setupTagInteraction(tagElement, id);
        
        this.tagContainer.appendChild(tagElement);
        
        // Store references
        this.tags[id] = {
            element: tagElement,
            object3D: tagGroup,
            type: options.type || 'equipment'
        };
        
        object.add(tagGroup);
    }
    
    /**
     * Update floating tag positions based on 3D positions
     */
    updateTagPositions() {
        if (!this.camera || !this.renderer || !this.tagContainer) return;
        
        // If tags are not shown at all, hide all tags and skip the rest
        if (!this.showTags) {
            Object.keys(this.tags).forEach(tagId => {
                const tag = this.tags[tagId];
                tag.element.style.display = 'none';
            });
            return;
        }
        
        // Update all tag positions
        Object.keys(this.tags).forEach(tagId => {
            const tag = this.tags[tagId];
            const position = this.getTagViewportPosition(tag);
            
            // Should the tag be displayed?
            const shouldDisplay = position.inFront && position.inBounds;
            
            if (shouldDisplay) {
                // Position the tag
                tag.element.style.left = `${position.x}px`;
                tag.element.style.top = `${position.y}px`;
                tag.element.style.display = 'block';
            } else {
                tag.element.style.display = 'none';
            }
        });
    }
    
    /**
     * Get viewport position for a tag
     * @param {Object} tag - Tag object
     * @returns {Object} - Position object with x, y, z and computed screen coordinates
     */
    getTagViewportPosition(tag) {
        const tempVector = new THREE.Vector3();
        const containerRect = this.container.getBoundingClientRect();
        
        // Get world position of tag
        tempVector.setFromMatrixPosition(tag.object3D.matrixWorld);
        
        // Get object position for distance calculation
        const objectPos = new THREE.Vector3();
        tag.object3D.getWorldPosition(objectPos);
        
        // Calculate distance to camera
        const distance = this.camera.position.distanceTo(objectPos);
        
        // Project 3D position to 2D screen position
        tempVector.project(this.camera);
        
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
        const tag = this.tags[tagId];
        if (!tag) return;
        
        if (tag.type === 'mixer') {
            tag.element.innerHTML = `
                <div><strong>${tagId}</strong></div>
                <div>Temperature: ${data.temperature}°C</div>
                <div>RPM: ${data.rpm}</div>
                <div>Status: ${data.status}</div>
            `;
            
            // Update color based on temperature
            const tempColor = this.getTemperatureColor(data.temperature);
            tag.element.style.borderLeft = `4px solid ${tempColor}`;
            
            // Update color based on alarm status
            if (data.status === 'ACTIVE') {
                tag.element.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            } else if (data.status === 'ACKNOWLEDGED') {
                tag.element.style.backgroundColor = 'rgba(255, 165, 0, 0.7)';
            } else {
                tag.element.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            }
        } else if (tag.type === 'watertank') {
            tag.element.innerHTML = `
                <div><strong>Water Tank</strong></div>
                <div>Flow Rate: ${data.waterFlowRate}</div>
                <div>Volume: ${data.tankVolume}%</div>
            `;
            
            // Update color based on flow rate
            if (data.waterFlowRate > 70) {
                tag.element.style.borderLeft = '4px solid #ff0000'; // Red for high flow
            } else if (data.waterFlowRate > 50) {
                tag.element.style.borderLeft = '4px solid #ffaa00'; // Orange for medium flow
            } else {
                tag.element.style.borderLeft = '4px solid #00ff00'; // Green for normal flow
            }
        } else if (tag.type === 'equipment') {
            // Handle other equipment types based on the tagId
            switch(tagId) {
                case 'FreezerTunnel':
                    tag.element.innerHTML = `
                        <div><strong>Freezer Tunnel</strong></div>
                        <div>Temperature: ${data.freezerTemperature}°C</div>
                        <div>Speed: ${data.conveyorSpeed} m/s</div>
                        <div>State: ${data.state || 'RUNNING'}</div>
                    `;
                    // Blue color for cold temperatures
                    const freezerColor = this.getFreezerTemperatureColor(data.freezerTemperature);
                    tag.element.style.borderLeft = `4px solid ${freezerColor}`;
                    break;
                    
                case 'PlasticLiner':
                    tag.element.innerHTML = `
                        <div><strong>Plastic Liner</strong></div>
                        <div>RPM: ${data.linerRPM}</div>
                        <div>Status: ${data.status || 'NORMAL'}</div>
                    `;
                    // Color based on RPM
                    if (data.linerRPM > 60) {
                        tag.element.style.borderLeft = '4px solid #ff0000'; // Red for high RPM
                    } else if (data.linerRPM < 30) {
                        tag.element.style.borderLeft = '4px solid #ffaa00'; // Orange for low RPM
                    } else {
                        tag.element.style.borderLeft = '4px solid #00ff00'; // Green for normal
                    }
                    break;
                    
                case 'CookieFormer':
                    tag.element.innerHTML = `
                        <div><strong>Cookie Former</strong></div>
                        <div>Rate: ${data.cookieFormerRate}/min</div>
                        <div>Good Parts: ${data.goodParts}%</div>
                    `;
                    // Color based on good parts percentage
                    if (data.goodParts < 95) {
                        tag.element.style.borderLeft = '4px solid #ff0000'; // Red for low quality
                    } else if (data.goodParts < 98) {
                        tag.element.style.borderLeft = '4px solid #ffaa00'; // Orange for medium quality
                    } else {
                        tag.element.style.borderLeft = '4px solid #00ff00'; // Green for high quality
                    }
                    break;
                    
                case 'BoxSealer':
                    tag.element.innerHTML = `
                        <div><strong>Box Sealer</strong></div>
                        <div>Speed: ${data.conveyorSpeed} m/s</div>
                        <div>Status: ${data.status || 'OPERATIONAL'}</div>
                    `;
                    tag.element.style.borderLeft = '4px solid #00ff00'; // Green for normal
                    break;
                    
                case 'ConveyorSystem':
                    tag.element.innerHTML = `
                        <div><strong>Conveyor System</strong></div>
                        <div>Speed: ${data.conveyorSpeed} m/s</div>
                        <div>Status: ${data.status || 'RUNNING'}</div>
                    `;
                    // Color based on speed
                    if (data.conveyorSpeed > 1.5) {
                        tag.element.style.borderLeft = '4px solid #ff0000'; // Red for high speed
                    } else if (data.conveyorSpeed < 0.3) {
                        tag.element.style.borderLeft = '4px solid #ffaa00'; // Orange for low speed
                    } else {
                        tag.element.style.borderLeft = '4px solid #00ff00'; // Green for normal
                    }
                    break;
            }
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
        
        // Set visibility for all tags
        Object.keys(this.tags).forEach(tagId => {
            const tag = this.tags[tagId];
            if (tag && tag.element) {
                tag.element.style.display = this.showTags ? 'block' : 'none';
            }
        });
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
        
        if (this.modelId === 'factory') {
            // Update factory model
            this.updateFactoryAnimation(time, deltaTime);
        } else {
            // Update single mixer model
            this.updateMixerAnimation(time, deltaTime);
        }
        
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
            const radiansPerSecond = (this.modelState.rpm / 60) * Math.PI * 2;
            this.rotatingPart.rotation.y += radiansPerSecond * deltaTime;
        }
        
        // Update temperature visual effects
        if (this.temperatureLight) {
            const tempMapping = DTProperties.mapTemperature(this.modelState.temperature);
            this.temperatureLight.color.setHex(tempMapping.color);
            this.temperatureLight.intensity = tempMapping.intensity;
        }
        
        // Update status indicator
        if (this.statusIndicator) {
            const statusMapping = DTProperties.mapAlarmStatus(this.modelState.status);
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
            // Find the rotating parts and rotate them
            const rotationSpeed = (this.modelState.rpm / 60) * Math.PI * 2;
            
            mixer.model.traverse((node) => {
                if (node.userData && node.userData.isRotatingPart) {
                    node.rotation.y += rotationSpeed * deltaTime;
                }
            });
            
            // Update status indicators
            if (mixer.statusIndicator) {
                const statusMapping = DTProperties.mapAlarmStatus(this.modelState.status);
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
            
            // Update tag content for this mixer
            if (this.tags[mixer.name]) {
                this.updateTagContent(mixer.name, {
                    temperature: this.modelState.temperature,
                    rpm: this.modelState.rpm,
                    status: this.modelState.status
                });
            }
        });
        
        // Update water tank color based on flow rate
        if (this.waterTank) {
            const flowRateMapping = DTProperties.mapWaterFlowRate(this.modelState.waterFlowRate);
            
            this.waterTank.traverse((node) => {
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
            
            // Update water tank tag content
            if (this.tags['WaterTank']) {
                this.updateTagContent('WaterTank', {
                    waterFlowRate: this.modelState.waterFlowRate,
                    tankVolume: this.modelState.tankVolume
                });
            }
        }
        
        // Update freezer tunnel 
        if (this.freezerTunnel) {
            // Update color based on temperature (blue-ish for cold)
            const freezerTemp = this.modelState.freezerTemperature;
            const intensity = Math.min(1.0, Math.max(0.0, (-freezerTemp + 10) / 30));
            const color = new THREE.Color(0.2, 0.4, 0.8); // Blue-ish color for freezer
            
            // Apply material changes to the freezer tunnel
            if (this.freezerTunnel.material) {
                this.freezerTunnel.material.emissive = color;
                this.freezerTunnel.material.emissiveIntensity = intensity;
            }
            
            // Update freezer tunnel tag content
            if (this.tags['FreezerTunnel']) {
                this.updateTagContent('FreezerTunnel', {
                    freezerTemperature: this.modelState.freezerTemperature,
                    conveyorSpeed: this.modelState.conveyorSpeed,
                    state: 'RUNNING'
                });
            }
        }
        
        // Update plastic liner - animate texture instead of rotating the object
        if (this.plasticLiner) {
            if (this.plasticLiner.material && this.plasticLiner.material.map) {
                // Update texture offset based on liner RPM
                // This creates the illusion of a rotating liner without rotating the mesh
                const offset = this.textureOffsets['plastic_liner'] || { u: 0, v: 0 };
                
                // The RPM determines how fast the texture rotates
                // Convert RPM to radians per second, then scale for texture movement
                const linerRotationSpeed = (this.modelState.linerRPM / 60) * Math.PI * 2;
                const textureSpeed = linerRotationSpeed / (Math.PI * 2) * deltaTime; 
                
                // In this case, we want to animate horizontally (u-direction)
                offset.u -= textureSpeed;
                
                // Apply the updated offset to the texture
                this.plasticLiner.material.map.offset.set(offset.u, offset.v);
                
                // Store updated offset
                this.textureOffsets['plastic_liner'] = offset;
            }
            
            // Update plastic liner tag content
            if (this.tags['PlasticLiner']) {
                this.updateTagContent('PlasticLiner', {
                    linerRPM: this.modelState.linerRPM,
                    status: 'NORMAL'
                });
            }
        }
        
        // Update cookie former
        if (this.cookieFormer && this.tags['CookieFormer']) {
            this.updateTagContent('CookieFormer', {
                cookieFormerRate: this.modelState.cookieFormerRate,
                goodParts: this.modelState.goodParts
            });
        }
        
        // Update box sealer
        if (this.boxSealer && this.tags['BoxSealer']) {
            this.updateTagContent('BoxSealer', {
                conveyorSpeed: this.modelState.conveyorSpeed,
                status: 'OPERATIONAL'
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
                offset.v -= this.modelState.conveyorSpeed * deltaTime * 0.5;
                
                // Apply the updated offset to the texture
                conveyor.material.map.offset.set(offset.u, offset.v);
                
                // Store updated offset
                this.textureOffsets[id] = offset;
            }
        });
        
        // Update conveyor system tag if it exists
        if (this.tags['ConveyorSystem']) {
            this.updateTagContent('ConveyorSystem', {
                conveyorSpeed: this.modelState.conveyorSpeed,
                status: 'RUNNING'
            });
        }
    }
    
    /**
     * Update the visualization from digital twin data
     * @param {Object} twinState - Digital twin state data
     */
    updateFromTwin(twinState) {
        if (this.modelId === 'factory') {
            this.updateFactoryFromTwin(twinState);
        } else {
            this.updateMixerFromTwin(twinState);
        }
    }
    
    /**
     * Update single mixer from twin data
     */
    updateMixerFromTwin(twinState) {
        // Update temperature if available
        if (twinState.features?.Mixer?.properties?.Temperature !== undefined) {
            const temp = parseFloat(twinState.features.Mixer.properties.Temperature);
            if (!isNaN(temp)) {
                this.modelState.temperature = temp;
            }
        }
        
        // Update RPM if available
        if (twinState.features?.Mixer?.properties?.RPM !== undefined) {
            const rpm = parseFloat(twinState.features.Mixer.properties.RPM);
            if (!isNaN(rpm)) {
                this.modelState.rpm = rpm;
            }
        }
        
        // Update status if available
        if (twinState.features?.Alarm?.properties?.alarm_status !== undefined) {
            this.modelState.status = twinState.features.Alarm.properties.alarm_status;
        }
    }
    
    /**
     * Update factory model from twin data
     */
    updateFactoryFromTwin(twinState) {
        // Check if we have any mixer data
        for (let i = 0; i < 6; i++) {
            const mixerKey = `Mixer_${i}`;
            
            // Update temperature 
            if (twinState.features?.[mixerKey]?.properties?.Temperature !== undefined) {
                const temp = parseFloat(twinState.features[mixerKey].properties.Temperature);
                if (!isNaN(temp)) {
                    this.modelState.temperature = temp;
                }
            }
            
            // Update RPM
            if (twinState.features?.[mixerKey]?.properties?.RPM !== undefined) {
                const rpm = parseFloat(twinState.features[mixerKey].properties.RPM);
                if (!isNaN(rpm)) {
                    this.modelState.rpm = rpm;
                }
            }
            
            // Update alarm status
            const alarmKey = `${mixerKey}_AlarmComponent`;
            if (twinState.features?.[alarmKey]?.properties?.alarm_status !== undefined) {
                this.modelState.status = twinState.features[alarmKey].properties.alarm_status;
            }
        }
        
        // Update water tank flow rate
        if (twinState.features?.WaterTank?.properties?.flowRate1 !== undefined) {
            const flowRate = parseFloat(twinState.features.WaterTank.properties.flowRate1);
            if (!isNaN(flowRate)) {
                this.modelState.waterFlowRate = flowRate;
            }
        }
        
        // Update water tank volume (if available)
        if (twinState.features?.WaterTank?.properties?.tankVolume1 !== undefined) {
            const tankVolume = parseFloat(twinState.features.WaterTank.properties.tankVolume1);
            if (!isNaN(tankVolume)) {
                this.modelState.tankVolume = tankVolume;
            }
        }
        
        // Update freezer tunnel temperature (if available)
        if (twinState.features?.FreezerTunnel?.properties?.Temperature !== undefined) {
            const freezerTemp = parseFloat(twinState.features.FreezerTunnel.properties.Temperature);
            if (!isNaN(freezerTemp)) {
                this.modelState.freezerTemperature = freezerTemp;
            }
        }
        
        // Update plastic liner RPM (if available)
        if (twinState.features?.PlasticLiner?.properties?.RPM !== undefined) {
            const linerRPM = parseFloat(twinState.features.PlasticLiner.properties.RPM);
            if (!isNaN(linerRPM)) {
                this.modelState.linerRPM = linerRPM;
            }
        }
        
        // Update cookie former rate (if available)
        if (twinState.features?.CookieFormer?.properties?.Rate !== undefined) {
            const formerRate = parseFloat(twinState.features.CookieFormer.properties.Rate);
            if (!isNaN(formerRate)) {
                this.modelState.cookieFormerRate = formerRate;
            }
        }
        
        // Update conveyor speed (if available)
        if (twinState.features?.Conveyor?.properties?.Speed !== undefined) {
            const conveyorSpeed = parseFloat(twinState.features.Conveyor.properties.Speed);
            if (!isNaN(conveyorSpeed)) {
                this.modelState.conveyorSpeed = conveyorSpeed;
            }
        }
        
        // Update good parts percentage (if available)
        if (twinState.features?.CookieFormer?.properties?.GoodParts !== undefined) {
            const goodParts = parseFloat(twinState.features.CookieFormer.properties.GoodParts);
            if (!isNaN(goodParts)) {
                this.modelState.goodParts = goodParts;
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
        // Reset tag interaction state
        this.hoveredTag = null;
        this.focusedTag = null;
        
        // Reset texture offsets
        this.textureOffsets = {};
        
        // Existing cleanup code...
        this.isInitialized = false;
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        // Clean up floating tags
        if (this.tagContainer && this.tagContainer.parentNode) {
            this.tagContainer.parentNode.removeChild(this.tagContainer);
            this.tagContainer = null;
        }
        
        // Clean up individual tag elements
        Object.keys(this.tags).forEach(tagId => {
            const tag = this.tags[tagId];
            if (tag && tag.element && tag.element.parentNode) {
                tag.element.parentNode.removeChild(tag.element);
            }
        });
        this.tags = {};
        
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
        this.waterTank = null;
        this.cookieLines = [];
        this.selectedMixer = null;
        this.statusIndicator = null;
        this.freezerTunnel = null;
        this.plasticLiner = null;
        this.cookieFormer = null;
        this.boxSealer = null;
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
}