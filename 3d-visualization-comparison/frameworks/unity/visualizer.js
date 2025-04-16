/**
 * Unity WebGL Visualization Framework Adapter
 * Adapts a Unity WebGL build to work with the dashboard interface
 */

// Register this framework in the global registry
if (!window.VisualizationFrameworks) {
    window.VisualizationFrameworks = {};
}

window.VisualizationFrameworks.unity = {
    createInstance() {
        return new UnityVisualizer();
    }
};

class UnityVisualizer {
    constructor() {
        // Unity WebGL instance
        this.unityInstance = null;
        this.container = null;
        this.loaderUrl = null;
        this.buildUrl = null;
        
        // Model and state tracking
        this.modelId = null;
        this.isInitialized = false;
        this.isLoaded = false;
        this.modelState = {
            temperature: 100,
            rpm: 60,
            status: 'NORMAL'
        };
        
        // Unity build paths based on model
        this.buildPaths = {
            'mixer': {
                loaderUrl: 'Build/MixerVisualization.loader.js',
                dataUrl: 'Build/MixerVisualization.data',
                frameworkUrl: 'Build/MixerVisualization.framework.js',
                codeUrl: 'Build/MixerVisualization.wasm',
            },
            'factory': {
                loaderUrl: 'Build/FactoryVisualization.loader.js',
                dataUrl: 'Build/FactoryVisualization.data',
                frameworkUrl: 'Build/FactoryVisualization.framework.js',
                codeUrl: 'Build/FactoryVisualization.wasm',
            }
        };
    }
    
    /**
     * Initialize the Unity WebGL visualizer
     * @param {Object} options - Initialization options
     * @param {HTMLElement} options.container - DOM element to render into
     * @param {string} options.modelId - ID of the model to load
     * @param {Function} options.onReady - Callback when ready
     */
    initialize(options) {
        this.container = options.container;
        this.modelId = options.modelId;
        this.onReady = options.onReady || (() => {});
        
        // Create a canvas for Unity
        const canvas = document.createElement('canvas');
        canvas.id = 'unity-canvas';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        this.container.appendChild(canvas);
        
        // Create loading progress bar
        this.progressBar = document.createElement('div');
        this.progressBar.style.position = 'absolute';
        this.progressBar.style.left = '10%';
        this.progressBar.style.right = '10%';
        this.progressBar.style.top = '50%';
        this.progressBar.style.height = '20px';
        this.progressBar.style.background = '#333';
        this.progressBar.style.borderRadius = '5px';
        this.container.appendChild(this.progressBar);
        
        this.progressBarFill = document.createElement('div');
        this.progressBarFill.style.width = '0%';
        this.progressBarFill.style.height = '100%';
        this.progressBarFill.style.background = '#007bff';
        this.progressBarFill.style.borderRadius = '5px';
        this.progressBarFill.style.transition = 'width 0.3s';
        this.progressBar.appendChild(this.progressBarFill);
        
        // For the actual dashboard implementation, we would load the Unity WebGL build
        // Since this is a demonstration, we'll simulate the loading and communication with Unity
        this.simulateUnityLoading();
    }
    
    /**
     * Simulate Unity WebGL loading (for demo purposes)
     * In a real implementation, this would use the Unity Loader to load the WebGL build
     */
    simulateUnityLoading() {
        // Simulate loading progress
        let progress = 0;
        const loadingInterval = setInterval(() => {
            progress += 5;
            this.progressBarFill.style.width = `${progress}%`;
            
            if (progress >= 100) {
                clearInterval(loadingInterval);
                
                // Hide progress bar
                this.progressBar.style.display = 'none';
                
                // Signal that Unity is "loaded"
                this.isLoaded = true;
                console.log("Unity WebGL build loaded (simulated)");
                
                // Create a placeholder visualization since we don't have an actual Unity build
                this.createPlaceholderVisualization();
                
                // Signal ready
                this.onReady();
            }
        }, 100);
    }
    
    /**
     * Create a placeholder visualization for demo purposes
     * In a real implementation, the Unity WebGL build would render here
     */
    createPlaceholderVisualization() {
        // Remove canvas as we'll create a placeholder visualization
        this.container.innerHTML = '';
        
        // Create a simple placeholder to represent Unity content
        const placeholder = document.createElement('div');
        placeholder.style.width = '100%';
        placeholder.style.height = '100%';
        placeholder.style.background = 'linear-gradient(to bottom, #1a2940, #2c3e50)';
        placeholder.style.color = 'white';
        placeholder.style.fontFamily = 'Arial, sans-serif';
        placeholder.style.display = 'flex';
        placeholder.style.flexDirection = 'column';
        placeholder.style.justifyContent = 'center';
        placeholder.style.alignItems = 'center';
        placeholder.style.textAlign = 'center';
        placeholder.style.padding = '20px';
        this.container.appendChild(placeholder);
        
        // Unity logo (simulated)
        const logo = document.createElement('div');
        logo.style.background = 'url(https://unity.com/themes/contrib/unity_base/images/favicons/favicon.ico) no-repeat center';
        logo.style.backgroundSize = 'contain';
        logo.style.width = '64px';
        logo.style.height = '64px';
        logo.style.margin = '0 auto 20px';
        placeholder.appendChild(logo);
        
        // Title
        const title = document.createElement('h2');
        title.textContent = `Unity WebGL - ${this.modelId === 'mixer' ? 'Mixer' : 'Factory'} Visualization`;
        title.style.margin = '0 0 20px 0';
        placeholder.appendChild(title);
        
        // Status info
        this.infoPanel = document.createElement('div');
        this.infoPanel.style.background = 'rgba(0,0,0,0.5)';
        this.infoPanel.style.borderRadius = '10px';
        this.infoPanel.style.padding = '15px';
        this.infoPanel.style.width = '80%';
        this.infoPanel.style.maxWidth = '400px';
        placeholder.appendChild(this.infoPanel);
        
        // Temperature display
        this.tempDisplay = document.createElement('div');
        this.tempDisplay.innerHTML = `<strong>Temperature:</strong> <span id="unity-temp">${this.modelState.temperature}°C</span>`;
        this.tempDisplay.style.margin = '10px 0';
        this.infoPanel.appendChild(this.tempDisplay);
        
        // RPM display
        this.rpmDisplay = document.createElement('div');
        this.rpmDisplay.innerHTML = `<strong>RPM:</strong> <span id="unity-rpm">${this.modelState.rpm}</span>`;
        this.rpmDisplay.style.margin = '10px 0';
        this.infoPanel.appendChild(this.rpmDisplay);
        
        // Status display
        this.statusDisplay = document.createElement('div');
        this.statusDisplay.innerHTML = `<strong>Status:</strong> <span id="unity-status">${this.modelState.status}</span>`;
        this.statusDisplay.style.margin = '10px 0';
        this.infoPanel.appendChild(this.statusDisplay);
        
        // Visual indicator
        this.indicator = document.createElement('div');
        this.indicator.style.width = '100px';
        this.indicator.style.height = '100px';
        this.indicator.style.borderRadius = '50%';
        this.indicator.style.background = '#00ff00';
        this.indicator.style.margin = '20px auto';
        this.indicator.style.transition = 'background-color 0.5s';
        placeholder.appendChild(this.indicator);
        
        // Animation element to simulate rotation
        this.rotatingElement = document.createElement('div');
        this.rotatingElement.style.width = '200px';
        this.rotatingElement.style.height = '200px';
        this.rotatingElement.style.margin = '20px auto';
        this.rotatingElement.style.background = 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)';
        this.rotatingElement.style.position = 'relative';
        placeholder.appendChild(this.rotatingElement);
        
        // Add blade elements to simulate rotation
        for (let i = 0; i < 3; i++) {
            const blade = document.createElement('div');
            blade.style.position = 'absolute';
            blade.style.width = '20px';
            blade.style.height = '80px';
            blade.style.background = 'white';
            blade.style.top = '60px';
            blade.style.left = '90px';
            blade.style.borderRadius = '10px';
            blade.style.transformOrigin = '50% 100%';
            blade.style.transform = `rotate(${i * 120}deg)`;
            this.rotatingElement.appendChild(blade);
        }
        
        // Start animation
        this.startAnimation();
    }
    
    /**
     * Start a simple animation to simulate Unity visualization
     */
    startAnimation() {
        let rotation = 0;
        
        // Update animation frame
        const animate = () => {
            if (!this.isLoaded) return;
            
            // Rotate based on RPM
            const rpmFactor = this.modelState.rpm / 60;
            rotation += rpmFactor;
            
            if (this.rotatingElement) {
                this.rotatingElement.style.transform = `rotate(${rotation}deg)`;
            }
            
            // Update indicator color based on status
            if (this.indicator) {
                switch(this.modelState.status) {
                    case 'NORMAL':
                        this.indicator.style.backgroundColor = '#00ff00';
                        break;
                    case 'ACTIVE':
                        const blinkRate = Math.sin(Date.now() / 200) > 0 ? 1 : 0.5;
                        this.indicator.style.backgroundColor = `rgba(255, 0, 0, ${blinkRate})`;
                        break;
                    case 'ACKNOWLEDGED':
                        this.indicator.style.backgroundColor = '#ffff00';
                        break;
                    default:
                        this.indicator.style.backgroundColor = '#0000ff';
                }
            }
            
            // Update display values
            if (this.tempDisplay) {
                document.getElementById('unity-temp').textContent = `${this.modelState.temperature}°C`;
            }
            
            if (this.rpmDisplay) {
                document.getElementById('unity-rpm').textContent = this.modelState.rpm;
            }
            
            if (this.statusDisplay) {
                document.getElementById('unity-status').textContent = this.modelState.status;
            }
            
            requestAnimationFrame(animate);
        };
        
        // Start animation loop
        requestAnimationFrame(animate);
    }
    
    /**
     * In a real implementation, this function would send a message to the Unity instance
     * @param {string} functionName - The function name to call in Unity
     * @param {any} parameter - The parameter to pass to the Unity function
     */
    sendMessageToUnity(functionName, parameter) {
        if (!this.isLoaded) {
            console.warn('Unity not loaded yet, cannot send message');
            return;
        }
        
        // In actual implementation:
        // this.unityInstance.SendMessage('GameObjectName', functionName, parameter);
        
        console.log(`Would send to Unity: ${functionName}(${parameter})`);
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
                this.sendMessageToUnity('SetTemperature', temp);
            }
        }
        
        // Update RPM if available
        if (twinState.features?.Mixer?.properties?.RPM !== undefined) {
            const rpm = parseFloat(twinState.features.Mixer.properties.RPM);
            if (!isNaN(rpm)) {
                this.modelState.rpm = rpm;
                this.sendMessageToUnity('SetRPM', rpm);
            }
        }
        
        // Update status if available
        if (twinState.features?.Alarm?.properties?.alarm_status !== undefined) {
            this.modelState.status = twinState.features.Alarm.properties.alarm_status;
            this.sendMessageToUnity('SetStatus', this.modelState.status);
        }
    }
    
    /**
     * Change the current model
     * @param {string} modelId - ID of the new model to load
     */
    changeModel(modelId) {
        this.modelId = modelId;
        
        // In a real implementation, we would need to unload the current Unity instance
        // and load a new one with the different model
        console.log(`Would change Unity model to: ${modelId}`);
        
        // For our demo, we'll just update the title
        const title = this.container.querySelector('h2');
        if (title) {
            title.textContent = `Unity WebGL - ${this.modelId === 'mixer' ? 'Mixer' : 'Factory'} Visualization`;
        }
    }
    
    /**
     * Clean up resources
     */
    cleanup() {
        this.isLoaded = false;
        
        // In a real implementation, we would need to unload the Unity instance
        // if (this.unityInstance) {
        //     this.unityInstance.Quit();
        //     this.unityInstance = null;
        // }
        
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}