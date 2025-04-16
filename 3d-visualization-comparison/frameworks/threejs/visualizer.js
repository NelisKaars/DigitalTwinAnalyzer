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
        
        // State tracking
        this.isInitialized = false;
        this.animationFrame = null;
        this.lastUpdateTime = 0;
        this.modelState = {
            temperature: 100,
            rpm: 60,
            status: 'NORMAL'
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
        this.camera.position.set(0, 2, 5);
        
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
     * Load the 3D model
     */
    loadModel() {
        // For now we'll hardcode the path to the model since we know it exists
        // Later we can use the ModelLoader utility to select different models
        const modelPath = this.getModelPath();
        
        // Start loading the model
        const loader = new THREE.GLTFLoader();
        loader.load(
            modelPath,
            this.onModelLoaded.bind(this),
            this.onLoadProgress.bind(this),
            this.onLoadError.bind(this)
        );
    }
    
    /**
     * Get the path to the model based on the modelId
     */
    getModelPath() {
        // Fix: Use the correct path relative to the dashboard.html
        if (this.modelId === 'mixer') {
            return 'models/CookieFactoryMixer.glb';
        } else if (this.modelId === 'factory') {
            return 'models/CookieFactory.glb';
        }
        
        // Default to the mixer model
        return 'models/CookieFactoryMixer.glb';
    }
    
    /**
     * Handle model loaded event
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
     * Create a status indicator object
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
        
        // Render
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * Update the visualization from digital twin data
     * @param {Object} twinState - Digital twin state data
     */
    updateFromTwin(twinState) {
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
     * Change the current model
     * @param {string} modelId - ID of the new model to load
     */
    changeModel(modelId) {
        this.modelId = modelId;
        
        // Remove the current model
        if (this.modelObject) {
            this.scene.remove(this.modelObject);
            this.modelObject = null;
        }
        
        // Remove the status indicator
        if (this.statusIndicator) {
            this.scene.remove(this.statusIndicator);
            this.statusIndicator = null;
        }
        
        // Load the new model
        this.loadModel();
    }
    
    /**
     * Clean up resources
     */
    cleanup() {
        this.isInitialized = false;
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this.container) {
            // Remove all event listeners
            this.container.innerHTML = '';
        }
        
        window.removeEventListener('resize', this.onWindowResize);
    }
}