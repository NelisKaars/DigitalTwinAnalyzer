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
        this.container = null;
        
        // Model components
        this.modelId = null;
        this.modelMesh = null;
        this.rotatingPart = null;
        
        // State tracking
        this.isInitialized = false;
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
     * Initialize the Babylon.js visualizer
     * @param {Object} options - Initialization options
     * @param {HTMLElement} options.container - DOM element to render into
     * @param {string} options.modelId - ID of the model to load
     * @param {Function} options.onReady - Callback when ready
     */
    initialize(options) {
        this.container = options.container;
        this.modelId = options.modelId;
        this.onReady = options.onReady || (() => {});
        
        // Create canvas for Babylon.js
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        this.container.appendChild(canvas);
        
        // Create Babylon.js engine
        this.engine = new BABYLON.Engine(canvas, true);
        
        // Create scene
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color4(0.93, 0.93, 0.93, 1);
        
        // Create camera
        this.camera = new BABYLON.ArcRotateCamera(
            'camera', 
            -Math.PI / 2, 
            Math.PI / 3, 
            10, 
            BABYLON.Vector3.Zero(),
            this.scene
        );
        this.camera.attachControl(canvas, true);
        this.camera.wheelPrecision = 50;
        this.camera.lowerRadiusLimit = 2;
        this.camera.upperRadiusLimit = 20;
        
        // Setup lighting
        this.setupLighting();
        
        // Setup ground
        this.setupGround();
        
        // Load model
        this.loadModel();
        
        // Start the render loop
        this.engine.runRenderLoop(() => {
            this.update();
            this.scene.render();
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.engine.resize();
        });
        
        this.isInitialized = true;
    }
    
    /**
     * Setup scene lighting
     */
    setupLighting() {
        // Ambient light
        new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(0, 1, 0), this.scene);
        
        // Directional light for shadows
        const dirLight = new BABYLON.DirectionalLight(
            'dirLight',
            new BABYLON.Vector3(-1, -2, -1),
            this.scene
        );
        dirLight.position = new BABYLON.Vector3(10, 10, 10);
        dirLight.intensity = 0.8;
        
        // Temperature-controlled point light
        this.temperatureLight = new BABYLON.PointLight(
            'tempLight',
            new BABYLON.Vector3(0, 2, 0),
            this.scene
        );
        this.temperatureLight.diffuse = new BABYLON.Color3.FromHexString('#ffaa00');
        this.temperatureLight.intensity = 0.5;
        this.temperatureLight.range = 10;
    }
    
    /**
     * Setup ground plane
     */
    setupGround() {
        const ground = BABYLON.MeshBuilder.CreateGround(
            'ground',
            { width: 20, height: 20 },
            this.scene
        );
        
        const groundMaterial = new BABYLON.StandardMaterial('groundMat', this.scene);
        groundMaterial.diffuseColor = new BABYLON.Color3.FromHexString('#cccccc');
        groundMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        ground.material = groundMaterial;
        ground.receiveShadows = true;
    }
    
    /**
     * Get the model path based on modelId
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
     * Load the 3D model
     */
    loadModel() {
        // Get model path
        const modelPath = this.getModelPath();
        
        // Babylon.js asset loader
        BABYLON.SceneLoader.ImportMesh(
            '',
            '',
            modelPath,
            this.scene,
            (meshes) => {
                this.onModelLoaded(meshes);
            },
            (progressEvent) => {
                // Progress callback
                const progressPercent = progressEvent.loaded / progressEvent.total * 100;
                console.log(`Loading: ${Math.round(progressPercent)}%`);
            },
            (scene, message) => {
                // Error callback
                console.error(`Error loading model: ${message}`);
            }
        );
    }
    
    /**
     * Handle model loaded event
     * @param {Array} meshes - The loaded meshes
     */
    onModelLoaded(meshes) {
        if (meshes.length > 0) {
            this.modelMesh = meshes[0];
            
            // Find rotating part
            for (const mesh of meshes) {
                const name = mesh.name.toLowerCase();
                if (name.includes('mixer') || name.includes('blade') || 
                    name.includes('rotate') || name.includes('spin')) {
                    this.rotatingPart = mesh;
                    console.log("Found rotating part:", mesh.name);
                    break;
                }
            }
            
            // If no rotating part is found, use the first child mesh
            if (!this.rotatingPart && meshes.length > 1) {
                this.rotatingPart = meshes[1];
                console.log("No specific rotating part found, using first child mesh");
            }
            
            // Create status indicator
            this.createStatusIndicator();
            
            // Signal that we're ready
            this.onReady();
        } else {
            console.error("No meshes loaded from model");
        }
    }
    
    /**
     * Create a status indicator object
     */
    createStatusIndicator() {
        this.statusIndicator = BABYLON.MeshBuilder.CreateSphere(
            'statusIndicator',
            { diameter: 0.4 },
            this.scene
        );
        this.statusIndicator.position.y = 3;
        
        // Create material for status
        const statusMaterial = new BABYLON.StandardMaterial('statusMat', this.scene);
        statusMaterial.diffuseColor = new BABYLON.Color3.FromHexString('#00ff00');
        statusMaterial.emissiveColor = new BABYLON.Color3.FromHexString('#00ff00');
        statusMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        this.statusIndicator.material = statusMaterial;
    }
    
    /**
     * Update animation and effects
     * This is called every frame
     */
    update() {
        if (!this.isInitialized) return;
        
        // Update rotating part based on RPM
        if (this.rotatingPart) {
            const rpm = this.modelState.rpm;
            const radiansPerFrame = (rpm / 60) * Math.PI * 2 / 60; // Assuming 60 FPS
            this.rotatingPart.rotation.y += radiansPerFrame;
        }
        
        // Update temperature light
        if (this.temperatureLight) {
            const tempMapping = DTProperties.mapTemperature(this.modelState.temperature);
            const hexColor = '#' + tempMapping.color.toString(16).padStart(6, '0');
            this.temperatureLight.diffuse = new BABYLON.Color3.FromHexString(hexColor);
            this.temperatureLight.intensity = tempMapping.intensity;
        }
        
        // Update status indicator
        if (this.statusIndicator && this.statusIndicator.material) {
            const statusMapping = DTProperties.mapAlarmStatus(this.modelState.status);
            const material = this.statusIndicator.material;
            
            const hexColor = '#' + statusMapping.color.toString(16).padStart(6, '0');
            material.diffuseColor = new BABYLON.Color3.FromHexString(hexColor);
            material.emissiveColor = new BABYLON.Color3.FromHexString(hexColor);
            
            if (statusMapping.blinking) {
                material.alpha = (Math.sin(performance.now() / 200) * 0.5) + 0.5;
            } else {
                material.alpha = 1;
            }
        }
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
        
        // Dispose current meshes
        if (this.modelMesh) {
            this.modelMesh.dispose();
            this.modelMesh = null;
        }
        
        if (this.rotatingPart) {
            this.rotatingPart = null;
        }
        
        if (this.statusIndicator) {
            this.statusIndicator.dispose();
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
        
        if (this.engine) {
            this.engine.stopRenderLoop();
        }
        
        if (this.scene) {
            this.scene.dispose();
        }
        
        if (this.engine) {
            this.engine.dispose();
        }
        
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}