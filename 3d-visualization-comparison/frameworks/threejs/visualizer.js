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
        
        // State tracking
        this.isInitialized = false;
        this.animationFrame = null;
        this.lastUpdateTime = 0;
        this.modelState = {
            temperature: 100,
            rpm: 60,
            status: 'NORMAL',
            waterFlowRate: 35
        };
        
        // Effects
        this.temperatureLight = null;
        this.statusIndicator = null;
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
                    const lineModel = gltf.scene;
                    this.applyModelTransform(lineModel, lineNode);
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
        this.waterTank = null;
        this.cookieLines = [];
        this.selectedMixer = null;
        this.statusIndicator = null;
        
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