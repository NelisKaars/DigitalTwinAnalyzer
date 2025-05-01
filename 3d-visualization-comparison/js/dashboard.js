/**
 * dashboard.js - Main controller for the visualization dashboard
 * Handles framework switching, UI interactions, and coordinates with the Ditto API
 */
document.addEventListener('DOMContentLoaded', () => {
    // Dashboard state
    const dashboardState = {
        currentFramework: 'threejs',
        currentModel: 'factory', // Always use the factory model
        frameworkInstances: {},
        activeInstance: null,
        loadedLibraries: {}, // Track which framework libraries have been loaded
        isUserInteracting: false, // Flag to track user interaction with controls
        userInteractionTimeout: null, // Timeout for user interaction
        controlUpdateTimeout: null, // Debounce timer for control updates
        selectedMixer: 'all', // Selected mixer in factory view
        isSimulationActive: false, // Flag to track if simulation is active
        activeComponent: 'mixers' // Currently active component section
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
        
        // Component selector
        const componentSelector = document.getElementById('component-selector');
        if (componentSelector) {
            componentSelector.addEventListener('change', (e) => {
                switchComponentSection(e.target.value);
            });
        }
        
        // Factory mixer selector
        const factoryMixerSelector = document.getElementById('factory-mixer-selector');
        if (factoryMixerSelector) {
            factoryMixerSelector.addEventListener('change', (e) => {
                dashboardState.selectedMixer = e.target.value;
                
                // Update UI to show current values for selected mixer
                if (dashboardState.activeInstance && dashboardState.activeInstance.focusOnMixer) {
                    dashboardState.activeInstance.focusOnMixer(dashboardState.selectedMixer);
                }
                
                // Update UI controls to reflect the selected mixer's values
                DittoAPI.getTwinState().then(state => {
                    updateDashboardUI(state);
                });
            });
        }
        
        // Control sliders for temperature with auto-update
        setupSliderControl('temp-control', 'temp-value', '°C', 
            (value) => updateFactoryMixerTemperature(value));
        
        // Control sliders for RPM with auto-update
        setupSliderControl('rpm-control', 'rpm-value', '', 
            (value) => updateFactoryMixerRPM(value));
        
        // Alarm status dropdown with auto-update
        document.getElementById('alarm-status').addEventListener('change', (e) => {
            updateFactoryAlarmStatus(e.target.value);
        });
        
        // Water flow control for factory
        setupSliderControl('water-flow-control', 'water-flow-value', '', 
            (value) => DittoAPI.updateProperty('WaterTank', 'flowRate1', parseInt(value)));
        
        // Water tank volume control for factory
        setupSliderControl('water-volume-control', 'water-volume-value', '%', 
            (value) => DittoAPI.updateProperty('WaterTank', 'tankVolume1', parseInt(value)));
        
        // Water tank status control
        setupStatusControl('water-tank-status', 'WaterTank');
        
        // FREEZER TUNNEL CONTROLS
        setupSliderControl('freezer-temp-control', 'freezer-temp-value', '°C', 
            (value) => DittoAPI.updateProperty('FreezerTunnel', 'Temperature', parseInt(value)));
        
        // Freezer status control
        setupStatusControl('freezer-status', 'FreezerTunnel');
        
        // PLASTIC LINER CONTROLS
        setupSliderControl('liner-rpm-control', 'liner-rpm-value', '', 
            (value) => DittoAPI.updateProperty('PlasticLiner', 'RPM', parseInt(value)));
        
        // Plastic liner status control
        setupStatusControl('liner-status', 'PlasticLiner');
        
        // COOKIE FORMER CONTROLS
        setupSliderControl('cookie-rate-control', 'cookie-rate-value', '/min', 
            (value) => DittoAPI.updateProperty('CookieFormer', 'Rate', parseInt(value)));
        
        // Cookie quality control
        setupSliderControl('cookie-quality-control', 'cookie-quality-value', '%', 
            (value) => DittoAPI.updateProperty('CookieFormer', 'GoodParts', parseFloat(value)));
        
        // Cookie former status control
        setupStatusControl('cookie-former-status', 'CookieFormer');
        
        // BOX SEALER CONTROLS
        setupSliderControl('box-sealer-speed', 'box-sealer-speed-value', ' m/s', 
            (value) => DittoAPI.updateProperty('BoxSealer', 'Speed', parseFloat(value)));
        
        // Box sealer status control
        setupStatusControl('box-sealer-status', 'BoxSealer');
        
        // CONVEYOR SYSTEM CONTROLS
        setupSliderControl('conveyor-speed-control', 'conveyor-speed-value', ' m/s', 
            (value) => DittoAPI.updateProperty('Conveyor', 'Speed', parseFloat(value)));
        
        // Conveyor status control
        setupStatusControl('conveyor-status', 'Conveyor');
        
        // Toggle tag visibility
        const toggleTagsCheckbox = document.getElementById('toggle-tags');
        if (toggleTagsCheckbox) {
            toggleTagsCheckbox.addEventListener('change', () => {
                // Call the toggleTags method if it exists on the active framework
                if (dashboardState.activeInstance && dashboardState.activeInstance.toggleTags) {
                    dashboardState.activeInstance.toggleTags(toggleTagsCheckbox.checked);
                }
            });
        }
        
        // Download metrics CSV
        document.getElementById('download-metrics').addEventListener('click', () => {
            MetricsCollector.downloadCSV();
        });
        
        // ------- Simulation Controls -------
        
        // Start simulation
        document.getElementById('start-simulation').addEventListener('click', () => {
            if (dashboardState.isSimulationActive) return;
            
            if (!dashboardState.activeInstance || !dashboardState.activeInstance.setCameraPosition) {
                alert("Current framework doesn't support camera simulation. Please implement the setCameraPosition method.");
                return;
            }
            
            startSimulation();
        });
        
        // Pause simulation
        document.getElementById('pause-simulation').addEventListener('click', () => {
            if (!dashboardState.isSimulationActive) return;
            
            const pauseButton = document.getElementById('pause-simulation');
            if (pauseButton.textContent === 'Pause') {
                Simulation.pause();
                pauseButton.textContent = 'Resume';
            } else {
                Simulation.resume();
                pauseButton.textContent = 'Pause';
            }
        });
        
        // Stop simulation
        document.getElementById('stop-simulation').addEventListener('click', () => {
            if (!dashboardState.isSimulationActive) return;
            
            stopSimulation();
        });
        
        // Download simulation metrics
        document.getElementById('download-sim-metrics').addEventListener('click', () => {
            MetricsCollector.downloadSimulationCSV();
        });
    }
    
    /**
     * Sets up a slider control with its associated event listeners
     * @param {string} controlId - ID of the slider input element
     * @param {string} valueId - ID of the element to display the current value
     * @param {string} suffix - Text suffix to add after the value (e.g., '°C', '%')
     * @param {Function} updateFn - Function to call with the new value
     */
    function setupSliderControl(controlId, valueId, suffix, updateFn) {
        const control = document.getElementById(controlId);
        if (!control) return;
        
        // Handle continuously updating while sliding
        control.addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById(valueId).textContent = `${value}${suffix}`;
            
            // Set the user interaction flag
            startUserInteraction();
            
            // Debounce the update
            debounceControlUpdate(() => updateFn(value));
        });
        
        // Handle when user stops sliding
        control.addEventListener('change', () => {
            updateFn(control.value);
            endUserInteraction();
        });
    }
    
    /**
     * Sets up a status control dropdown
     * @param {string} controlId - ID of the status select element
     * @param {string} componentName - Name of the component to update
     */
    function setupStatusControl(controlId, componentName) {
        const control = document.getElementById(controlId);
        if (control) {
            control.addEventListener('change', (e) => {
                DittoAPI.updateProperty(componentName, 'Status', e.target.value);
            });
        }
    }
    
    /**
     * Switch between component control sections
     * @param {string} componentId - ID of the component section to show
     */
    function switchComponentSection(componentId) {
        // Hide all component sections
        document.querySelectorAll('.component-controls').forEach(section => {
            section.style.display = 'none';
        });
        
        // Show selected component section
        const selectedSection = document.getElementById(`${componentId}-controls`);
        if (selectedSection) {
            selectedSection.style.display = 'block';
        }
        
        // Update active component in dashboard state
        dashboardState.activeComponent = componentId;
        
        // If we have an active framework instance and it can focus on components
        if (dashboardState.activeInstance) {
            // Focus camera on this component if possible
            if (dashboardState.activeInstance.focusOnComponent) {
                // Map component ID to actual component tag ID used in visualization
                const componentMap = {
                    'mixers': dashboardState.selectedMixer, // Use selected mixer
                    'water-tank': 'WaterTank',
                    'freezer-tunnel': 'FreezerTunnel',
                    'plastic-liner': 'PlasticLiner',
                    'cookie-former': 'CookieFormer',
                    'box-sealer': 'BoxSealer',
                    'conveyor-system': 'ConveyorSystem'
                };
                
                // Focus on the appropriate component
                if (componentId === 'mixers') {
                    dashboardState.activeInstance.focusOnMixer(dashboardState.selectedMixer);
                } else if (componentMap[componentId]) {
                    dashboardState.activeInstance.focusOnComponent(componentMap[componentId]);
                }
            }
        }
    }
    
    /**
     * Update temperature for selected factory mixer(s)
     * @param {string|number} value - Temperature value
     */
    function updateFactoryMixerTemperature(value) {
        const selectedMixer = dashboardState.selectedMixer;
        const tempValue = parseInt(value);
        
        if (selectedMixer === 'all') {
            // Update all mixers
            for (let i = 0; i < 6; i++) {
                DittoAPI.updateProperty(`Mixer_${i}`, 'Temperature', tempValue);
            }
        } else {
            // Update only the selected mixer
            DittoAPI.updateProperty(selectedMixer, 'Temperature', tempValue);
        }
    }
    
    /**
     * Update RPM for selected factory mixer(s)
     * @param {string|number} value - RPM value
     */
    function updateFactoryMixerRPM(value) {
        const selectedMixer = dashboardState.selectedMixer;
        const rpmValue = parseInt(value);
        
        if (selectedMixer === 'all') {
            // Update all mixers
            for (let i = 0; i < 6; i++) {
                DittoAPI.updateProperty(`Mixer_${i}`, 'RPM', rpmValue);
            }
        } else {
            // Update only the selected mixer
            DittoAPI.updateProperty(selectedMixer, 'RPM', rpmValue);
        }
    }
    
    /**
     * Update alarm status for selected factory mixer(s)
     * @param {string} status - Alarm status
     */
    function updateFactoryAlarmStatus(status) {
        const selectedMixer = dashboardState.selectedMixer;
        
        if (selectedMixer === 'all') {
            // Update all mixers
            for (let i = 0; i < 6; i++) {
                DittoAPI.updateProperty(`Mixer_${i}_AlarmComponent`, 'alarm_status', status);
            }
        } else {
            // Update only the selected mixer
            DittoAPI.updateProperty(`${selectedMixer}_AlarmComponent`, 'alarm_status', status);
        }
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
     * Update a control element with a value from the twin state if the user is not interacting
     * @param {object} twinState - Current twin state
     * @param {string} feature - Feature name in the twin state
     * @param {string} property - Property name in the feature
     * @param {string} controlId - ID of the control element to update
     * @param {string} valueId - ID of the element to display the value
     * @param {string} suffix - Optional suffix for the displayed value
     * @param {function} parseValue - Function to parse the value (e.g., parseFloat)
     */
    function updateControlFromTwin(twinState, feature, property, controlId, valueId, suffix = '', parseValue = parseFloat) {
        if (twinState.features?.[feature]?.properties?.[property] !== undefined && !dashboardState.isUserInteracting) {
            const value = parseValue(twinState.features[feature].properties[property]);
            const control = document.getElementById(controlId);
            const valueElement = document.getElementById(valueId);
            
            if (control && valueElement) {
                control.value = value;
                valueElement.textContent = `${value}${suffix}`;
            }
        }
    }
    
    /**
     * Update a status select control with a value from the twin state
     * @param {object} twinState - Current twin state
     * @param {string} feature - Feature name in the twin state
     * @param {string} property - Property name in the feature
     * @param {string} controlId - ID of the status select element
     */
    function updateStatusControlFromTwin(twinState, feature, property, controlId) {
        if (twinState.features?.[feature]?.properties?.[property] !== undefined && !dashboardState.isUserInteracting) {
            const status = twinState.features[feature].properties[property];
            const statusControl = document.getElementById(controlId);
            
            if (statusControl) {
                statusControl.value = status;
            }
        }
    }
    
    /**
     * Update the dashboard UI based on digital twin state
     * @param {object} twinState - Current state of the digital twin
     */
    function updateDashboardUI(twinState) {
        // Determine which mixer to display data for in the UI
        let selectedMixerPrefix = dashboardState.selectedMixer;
        
        if (selectedMixerPrefix === 'all') {
            // Default to Mixer_0 for displaying values when "all" is selected
            selectedMixerPrefix = 'Mixer_0';
        }
        
        // Update mixer controls
        updateControlFromTwin(twinState, selectedMixerPrefix, 'Temperature', 'temp-control', 'temp-value', '°C');
        updateControlFromTwin(twinState, selectedMixerPrefix, 'RPM', 'rpm-control', 'rpm-value');
        
        // Update mixer alarm status
        updateStatusControlFromTwin(twinState, `${selectedMixerPrefix}_AlarmComponent`, 'alarm_status', 'alarm-status');
        
        // Update water tank controls
        updateControlFromTwin(twinState, 'WaterTank', 'flowRate1', 'water-flow-control', 'water-flow-value');
        updateControlFromTwin(twinState, 'WaterTank', 'tankVolume1', 'water-volume-control', 'water-volume-value', '%');
        updateStatusControlFromTwin(twinState, 'WaterTank', 'Status', 'water-tank-status');
        
        // Update freezer tunnel controls
        updateControlFromTwin(twinState, 'FreezerTunnel', 'Temperature', 'freezer-temp-control', 'freezer-temp-value', '°C');
        updateStatusControlFromTwin(twinState, 'FreezerTunnel', 'Status', 'freezer-status');
        
        // Update plastic liner controls
        updateControlFromTwin(twinState, 'PlasticLiner', 'RPM', 'liner-rpm-control', 'liner-rpm-value');
        updateStatusControlFromTwin(twinState, 'PlasticLiner', 'Status', 'liner-status');
        
        // Update cookie former controls
        updateControlFromTwin(twinState, 'CookieFormer', 'Rate', 'cookie-rate-control', 'cookie-rate-value', '/min');
        updateControlFromTwin(twinState, 'CookieFormer', 'GoodParts', 'cookie-quality-control', 'cookie-quality-value', '%');
        updateStatusControlFromTwin(twinState, 'CookieFormer', 'Status', 'cookie-former-status');
        
        // Update box sealer controls
        updateControlFromTwin(twinState, 'BoxSealer', 'Speed', 'box-sealer-speed', 'box-sealer-speed-value', ' m/s');
        updateStatusControlFromTwin(twinState, 'BoxSealer', 'Status', 'box-sealer-status');
        
        // Update conveyor system controls
        updateControlFromTwin(twinState, 'Conveyor', 'Speed', 'conveyor-speed-control', 'conveyor-speed-value', ' m/s');
        updateStatusControlFromTwin(twinState, 'Conveyor', 'Status', 'conveyor-status');
    }
    
    // --- SIMULATION FUNCTIONALITY ---
    
    /**
     * Start the automated simulation
     */
    function startSimulation() {
        // Get simulation parameters from UI
        const duration = parseInt(document.getElementById('simulation-duration').value);
        const dataInterval = parseInt(document.getElementById('simulation-data-interval').value);
        
        // Disable controls during simulation
        setSimulationControlsState(true);
        
        // Initialize the simulation
        Simulation.initialize({
            duration: duration,
            dataUpdateInterval: dataInterval,
            onProgress: updateSimulationProgress,
            onComplete: simulationComplete,
            onDataUpdate: () => {
                // Optional callback when data is updated
            }
        });
        
        // Start the simulation with the active framework instance
        Simulation.start(dashboardState.activeInstance);
        
        // Update state
        dashboardState.isSimulationActive = true;
        
        // Show the timer at 00:00
        updateSimulationTimer(0);
    }
    
    /**
     * Stop the current simulation
     */
    function stopSimulation() {
        if (!dashboardState.isSimulationActive) return;
        
        Simulation.stop();
        simulationComplete();
    }
    
    /**
     * Called when simulation is complete
     */
    function simulationComplete() {
        // Update state
        dashboardState.isSimulationActive = false;
        
        // Re-enable controls
        setSimulationControlsState(false);
        
        // Reset pause button
        document.getElementById('pause-simulation').textContent = 'Pause';
        
        // Display simulation results
        displaySimulationResults();
        
        // Show simulation metrics panel
        document.querySelector('.simulation-metrics').style.display = 'block';
    }
    
    /**
     * Update the simulation progress bar and timer
     * @param {number} progress - Progress value between 0 and 1
     */
    function updateSimulationProgress(progress) {
        // Update progress bar
        const progressFill = document.getElementById('simulation-progress-fill');
        const percent = Math.round(progress * 100);
        progressFill.style.width = `${percent}%`;
        
        // Update timer display
        const duration = parseInt(document.getElementById('simulation-duration').value);
        const elapsed = duration * progress;
        updateSimulationTimer(elapsed);
    }
    
    /**
     * Update the simulation timer display
     * @param {number} seconds - Elapsed time in seconds
     */
    function updateSimulationTimer(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const timeStr = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        document.getElementById('simulation-timer').textContent = timeStr;
    }
    
    /**
     * Display the simulation results
     */
    function displaySimulationResults() {
        // Get results from metrics collector
        // Fallbacks in case the methods don't exist
        const fps = MetricsCollector.getSimulationAverageFPS ? 
                    MetricsCollector.getSimulationAverageFPS() : 
                    MetricsCollector.getAverageFPS ? MetricsCollector.getAverageFPS() : 0;
                    
        const memory = MetricsCollector.getSimulationAverageMemory ? 
                    MetricsCollector.getSimulationAverageMemory() : 
                    MetricsCollector.getAverageMemory ? MetricsCollector.getAverageMemory() : 0;
                    
        const latency = MetricsCollector.getSimulationAverageLatency ? 
                    MetricsCollector.getSimulationAverageLatency() : 
                    MetricsCollector.getAverageLatency ? MetricsCollector.getAverageLatency() : 0;
                    
        const duration = Simulation.config.elapsedTime.toFixed(1);
        
        // Update UI
        document.getElementById('sim-metric-fps').textContent = fps;
        document.getElementById('sim-metric-memory').textContent = `${memory} MB`;
        document.getElementById('sim-metric-latency').textContent = `${latency} ms`;
        document.getElementById('sim-metric-duration').textContent = `${duration} s`;
    }
    
    /**
     * Enable or disable simulation controls
     * @param {boolean} isRunning - Whether simulation is running
     */
    function setSimulationControlsState(isRunning) {
        // Disable start button and enable pause/stop when running
        document.getElementById('start-simulation').disabled = isRunning;
        document.getElementById('pause-simulation').disabled = !isRunning;
        document.getElementById('stop-simulation').disabled = !isRunning;
        
        // Disable input fields when running
        document.getElementById('simulation-duration').disabled = isRunning;
        document.getElementById('simulation-data-interval').disabled = isRunning;
        
        // Disable framework selection during simulation
        document.querySelectorAll('.framework-list li').forEach(item => {
            item.classList.toggle('disabled', isRunning);
        });
        
        // Disable or enable digital twin manual controls
        const controls = document.querySelectorAll('.digital-twin-controller input, .digital-twin-controller select');
        controls.forEach(control => {
            control.disabled = isRunning;
        });
    }
    
    // Export the dashboardState to window for potential external access
    window.dashboardState = dashboardState;
    
    // Expose the simulation object to window for potential external access
    window.Simulation = Simulation;
});