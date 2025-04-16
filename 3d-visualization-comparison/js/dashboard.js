/**
 * dashboard.js - Main controller for the visualization dashboard
 * Handles framework switching, UI interactions, and coordinates with the Ditto API
 */
document.addEventListener('DOMContentLoaded', () => {
    // Dashboard state
    const dashboardState = {
        currentFramework: 'threejs',
        currentModel: 'mixer',
        frameworkInstances: {},
        activeInstance: null,
        loadedLibraries: {}, // Track which framework libraries have been loaded
        isUserInteracting: false, // Flag to track user interaction with controls
        userInteractionTimeout: null, // Timeout for user interaction
        controlUpdateTimeout: null // Debounce timer for control updates
    };
    
    // Framework library dependencies
    const frameworkLibraries = {
        'threejs': [
            'https://cdn.jsdelivr.net/npm/three@0.132.2/build/three.min.js',
            'https://cdn.jsdelivr.net/npm/three@0.132.2/examples/js/controls/OrbitControls.js',
            'https://cdn.jsdelivr.net/npm/three@0.132.2/examples/js/loaders/GLTFLoader.js'
        ],
        'babylonjs': [
            'https://cdn.babylonjs.com/babylon.js',
            'https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js'
        ],
        'unity': []
    };
    
    // Setup UI event listeners
    setupEventListeners();
    
    // Load the default framework (Three.js)
    loadFramework('threejs');
    
    /**
     * Set up all event listeners for the dashboard
     */
    function setupEventListeners() {
        // Framework selection
        document.querySelectorAll('.framework-list li').forEach(item => {
            item.addEventListener('click', () => {
                // Only switch if different from current
                if (item.dataset.framework !== dashboardState.currentFramework) {
                    selectFramework(item.dataset.framework);
                }
            });
        });
        
        // Digital twin model selection
        document.getElementById('dt-model-selector').addEventListener('change', (e) => {
            const modelId = e.target.value;
            changeDigitalTwinModel(modelId);
        });
        
        // Control sliders for temperature with auto-update
        const tempControl = document.getElementById('temp-control');
        tempControl.addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('temp-value').textContent = `${value}°C`;
            
            // Set the user interaction flag
            startUserInteraction();
            
            // Debounce the update
            debounceControlUpdate(() => {
                DittoAPI.updateProperty('Mixer', 'Temperature', parseInt(value));
            });
        });
        
        // When user stops interacting with the temperature slider
        tempControl.addEventListener('change', () => {
            // Update immediately at the end of the slider movement
            DittoAPI.updateProperty('Mixer', 'Temperature', parseInt(tempControl.value));
            endUserInteraction();
        });
        
        // Control sliders for RPM with auto-update
        const rpmControl = document.getElementById('rpm-control');
        rpmControl.addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('rpm-value').textContent = value;
            
            // Set the user interaction flag
            startUserInteraction();
            
            // Debounce the update
            debounceControlUpdate(() => {
                DittoAPI.updateProperty('Mixer', 'RPM', parseInt(value));
            });
        });
        
        // When user stops interacting with the RPM slider
        rpmControl.addEventListener('change', () => {
            // Update immediately at the end of the slider movement
            DittoAPI.updateProperty('Mixer', 'RPM', parseInt(rpmControl.value));
            endUserInteraction();
        });
        
        // Alarm status dropdown with auto-update
        const alarmControl = document.getElementById('alarm-status');
        alarmControl.addEventListener('change', (e) => {
            DittoAPI.updateProperty('Alarm', 'alarm_status', e.target.value);
        });
        
        // Download metrics CSV
        document.getElementById('download-metrics').addEventListener('click', () => {
            MetricsCollector.downloadCSV();
        });
    }
    
    /**
     * Mark the start of user interaction with controls
     */
    function startUserInteraction() {
        dashboardState.isUserInteracting = true;
        
        // Clear any existing timeout
        if (dashboardState.userInteractionTimeout) {
            clearTimeout(dashboardState.userInteractionTimeout);
        }
        
        // Pause polling during interaction
        DittoAPI.pausePolling();
    }
    
    /**
     * Mark the end of user interaction with controls
     */
    function endUserInteraction() {
        // Set a timeout to clear the interaction flag
        dashboardState.userInteractionTimeout = setTimeout(() => {
            dashboardState.isUserInteracting = false;
            // Resume polling after interaction ends
            DittoAPI.resumePolling();
        }, 500); // Short delay before resuming polling
    }
    
    /**
     * Debounce control updates to prevent too many API calls
     * @param {Function} updateFn - The update function to call
     */
    function debounceControlUpdate(updateFn) {
        if (dashboardState.controlUpdateTimeout) {
            clearTimeout(dashboardState.controlUpdateTimeout);
        }
        
        dashboardState.controlUpdateTimeout = setTimeout(() => {
            updateFn();
        }, 100); // 100ms debounce time
    }
    
    /**
     * Switch to a different visualization framework
     * @param {string} frameworkId - ID of the framework to load (threejs, babylonjs, unity)
     */
    function selectFramework(frameworkId) {
        // Update UI
        document.querySelectorAll('.framework-list li').forEach(item => {
            item.classList.toggle('active', item.dataset.framework === frameworkId);
        });
        
        // Update state
        dashboardState.currentFramework = frameworkId;
        
        // Load the framework
        loadFramework(frameworkId);
    }
    
    /**
     * Load all required libraries for a framework
     * @param {string} frameworkId - ID of the framework to load libraries for
     * @returns {Promise} - Promise that resolves when all libraries are loaded
     */
    function loadFrameworkLibraries(frameworkId) {
        // If already loaded, return resolved promise
        if (dashboardState.loadedLibraries[frameworkId]) {
            return Promise.resolve();
        }
        
        const libraries = frameworkLibraries[frameworkId] || [];
        
        // If no libraries to load, return resolved promise
        if (libraries.length === 0) {
            return Promise.resolve();
        }
        
        // Load libraries sequentially (order matters for some frameworks)
        return libraries.reduce((promise, libraryUrl) => {
            return promise.then(() => loadScript(libraryUrl));
        }, Promise.resolve())
        .then(() => {
            dashboardState.loadedLibraries[frameworkId] = true;
        });
    }
    
    /**
     * Load a script dynamically
     * @param {string} url - URL of the script to load
     * @returns {Promise} - Promise that resolves when the script is loaded
     */
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            // Check if script already exists
            const existingScript = document.querySelector(`script[src="${url}"]`);
            if (existingScript) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            
            script.onload = () => resolve();
            script.onerror = (err) => reject(new Error(`Failed to load ${url}: ${err}`));
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * Load a visualization framework
     * @param {string} frameworkId - ID of the framework to load
     */
    function loadFramework(frameworkId) {
        const container = document.getElementById('framework-container');
        const loadingIndicator = document.getElementById('loading-indicator');
        
        // Show loading indicator
        loadingIndicator.style.display = 'block';
        
        // Clear previous framework
        if (dashboardState.activeInstance && dashboardState.activeInstance.cleanup) {
            dashboardState.activeInstance.cleanup();
        }
        container.innerHTML = '';
        
        // Start timing for load metrics
        const startTime = performance.now();
        
        // First load the required libraries for the framework
        loadFrameworkLibraries(frameworkId)
            .then(() => {
                // Now load the framework visualizer script
                const scriptPath = `frameworks/${frameworkId}/visualizer.js`;
                
                // Check if we already have an instance of this framework
                if (dashboardState.frameworkInstances[frameworkId]) {
                    initializeFramework(frameworkId, container, startTime);
                    return;
                }
                
                return loadScript(scriptPath)
                    .then(() => {
                        // Script loaded, now initialize the framework
                        initializeFramework(frameworkId, container, startTime);
                    });
            })
            .catch((error) => {
                console.error(`Error loading ${frameworkId} framework:`, error);
                loadingIndicator.textContent = `Error loading ${frameworkId} framework: ${error.message}`;
            });
    }
    
    /**
     * Initialize the loaded framework
     * @param {string} frameworkId - ID of the framework
     * @param {HTMLElement} container - Container element for the visualization
     * @param {number} startTime - Timestamp when loading started
     */
    function initializeFramework(frameworkId, container, startTime) {
        // The framework script should have registered its factory in window.VisualizationFrameworks
        if (!window.VisualizationFrameworks || !window.VisualizationFrameworks[frameworkId]) {
            console.error(`Framework ${frameworkId} not properly registered`);
            document.getElementById('loading-indicator').textContent = `Framework ${frameworkId} failed to load`;
            return;
        }
        
        try {
            // Create an instance of the framework
            const framework = window.VisualizationFrameworks[frameworkId];
            const instance = framework.createInstance();
            
            // Store the instance for future use
            dashboardState.frameworkInstances[frameworkId] = instance;
            dashboardState.activeInstance = instance;
            
            // Initialize the framework with the container
            instance.initialize({
                container: container,
                modelId: dashboardState.currentModel,
                onReady: () => {
                    // Framework is ready, hide loading indicator
                    document.getElementById('loading-indicator').style.display = 'none';
                    
                    // Record load time
                    const loadTime = performance.now() - startTime;
                    MetricsCollector.recordLoadTime(loadTime);
                    
                    // Start metrics collection
                    MetricsCollector.start(frameworkId);
                    
                    // Start digital twin data polling
                    startDittoPolling(instance);
                }
            });
        } catch (error) {
            console.error(`Error initializing ${frameworkId}:`, error);
            document.getElementById('loading-indicator').textContent = `Error initializing ${frameworkId}`;
        }
    }
    
    /**
     * Start polling for digital twin updates
     * @param {object} frameworkInstance - The active visualization framework instance
     */
    function startDittoPolling(frameworkInstance) {
        // Stop any existing polling
        DittoAPI.stopPolling();
        
        // Start polling and send updates to the framework
        DittoAPI.startPolling((state) => {
            // Only update UI from polling if user is not interacting with controls
            if (!dashboardState.isUserInteracting) {
                if (frameworkInstance && frameworkInstance.updateFromTwin) {
                    frameworkInstance.updateFromTwin(state);
                }
                
                // Update dashboard UI with current values
                updateDashboardUI(state);
            }
        });
    }
    
    /**
     * Update the dashboard UI based on digital twin state
     * @param {object} twinState - Current state of the digital twin
     */
    function updateDashboardUI(twinState) {
        // Update temperature slider (only if not being manipulated)
        if (twinState.features?.Mixer?.properties?.Temperature !== undefined && !dashboardState.isUserInteracting) {
            const temp = parseFloat(twinState.features.Mixer.properties.Temperature);
            document.getElementById('temp-control').value = temp;
            document.getElementById('temp-value').textContent = `${temp}°C`;
        }
        
        // Update RPM slider (only if not being manipulated)
        if (twinState.features?.Mixer?.properties?.RPM !== undefined && !dashboardState.isUserInteracting) {
            const rpm = parseFloat(twinState.features.Mixer.properties.RPM);
            document.getElementById('rpm-control').value = rpm;
            document.getElementById('rpm-value').textContent = rpm;
        }
        
        // Update alarm status dropdown (only if not being manipulated)
        if (twinState.features?.Alarm?.properties?.alarm_status !== undefined && !dashboardState.isUserInteracting) {
            const status = twinState.features.Alarm.properties.alarm_status;
            document.getElementById('alarm-status').value = status;
        }
    }
    
    /**
     * Apply changes from UI controls to the digital twin
     * This is kept for the Apply Changes button
     */
    async function applyDigitalTwinChanges() {
        const temperatureValue = parseInt(document.getElementById('temp-control').value);
        const rpmValue = parseInt(document.getElementById('rpm-control').value);
        const alarmStatus = document.getElementById('alarm-status').value;
        
        // Update temperature
        await DittoAPI.updateProperty('Mixer', 'Temperature', temperatureValue);
        
        // Update RPM
        await DittoAPI.updateProperty('Mixer', 'RPM', rpmValue);
        
        // Update alarm status
        await DittoAPI.updateProperty('Alarm', 'alarm_status', alarmStatus);
    }
    
    /**
     * Change the digital twin model
     * @param {string} modelId - ID of the model to load (mixer, factory, etc.)
     */
    function changeDigitalTwinModel(modelId) {
        // Update state
        dashboardState.currentModel = modelId;
        
        // Update Ditto API to point to the correct digital twin
        DittoAPI.setDigitalTwinModel(modelId);
        
        // Reload the current framework with the new model
        if (dashboardState.activeInstance && dashboardState.activeInstance.changeModel) {
            dashboardState.activeInstance.changeModel(modelId);
        } else {
            // If the framework doesn't support model changing directly, reload it
            loadFramework(dashboardState.currentFramework);
        }
    }
});