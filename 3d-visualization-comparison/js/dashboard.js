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
        const tempControl = document.getElementById('temp-control');
        tempControl.addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('temp-value').textContent = `${value}°C`;
            
            // Set the user interaction flag
            startUserInteraction();
            
            // Debounce the update
            debounceControlUpdate(() => {
                updateFactoryMixerTemperature(value);
            });
        });
        
        // When user stops interacting with the temperature slider
        tempControl.addEventListener('change', () => {
            // Update immediately at the end of the slider movement
            updateFactoryMixerTemperature(tempControl.value);
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
                updateFactoryMixerRPM(value);
            });
        });
        
        // When user stops interacting with the RPM slider
        rpmControl.addEventListener('change', () => {
            // Update immediately at the end of the slider movement
            updateFactoryMixerRPM(rpmControl.value);
            endUserInteraction();
        });
        
        // Alarm status dropdown with auto-update
        const alarmControl = document.getElementById('alarm-status');
        alarmControl.addEventListener('change', (e) => {
            updateFactoryAlarmStatus(e.target.value);
        });
        
        // Water flow control for factory
        const waterFlowControl = document.getElementById('water-flow-control');
        if (waterFlowControl) {
            waterFlowControl.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('water-flow-value').textContent = value;
                
                startUserInteraction();
                
                debounceControlUpdate(() => {
                    DittoAPI.updateProperty('WaterTank', 'flowRate1', parseInt(value));
                });
            });
            
            waterFlowControl.addEventListener('change', () => {
                DittoAPI.updateProperty('WaterTank', 'flowRate1', parseInt(waterFlowControl.value));
                endUserInteraction();
            });
        }
        
        // Water tank volume control for factory
        const waterVolumeControl = document.getElementById('water-volume-control');
        if (waterVolumeControl) {
            waterVolumeControl.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('water-volume-value').textContent = `${value}%`;
                
                startUserInteraction();
                
                debounceControlUpdate(() => {
                    DittoAPI.updateProperty('WaterTank', 'tankVolume1', parseInt(value));
                });
            });
            
            waterVolumeControl.addEventListener('change', () => {
                DittoAPI.updateProperty('WaterTank', 'tankVolume1', parseInt(waterVolumeControl.value));
                endUserInteraction();
            });
        }
        
        // Water tank status control
        const waterTankStatusControl = document.getElementById('water-tank-status');
        if (waterTankStatusControl) {
            waterTankStatusControl.addEventListener('change', (e) => {
                updateWaterTankStatus(e.target.value);
            });
        }
        
        // FREEZER TUNNEL CONTROLS
        // Freezer temperature control
        const freezerTempControl = document.getElementById('freezer-temp-control');
        if (freezerTempControl) {
            freezerTempControl.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('freezer-temp-value').textContent = `${value}°C`;
                
                startUserInteraction();
                
                debounceControlUpdate(() => {
                    DittoAPI.updateProperty('FreezerTunnel', 'Temperature', parseInt(value));
                });
            });
            
            freezerTempControl.addEventListener('change', () => {
                DittoAPI.updateProperty('FreezerTunnel', 'Temperature', parseInt(freezerTempControl.value));
                endUserInteraction();
            });
        }
        
        // Freezer status control
        const freezerStatusControl = document.getElementById('freezer-status');
        if (freezerStatusControl) {
            freezerStatusControl.addEventListener('change', (e) => {
                updateFreezerStatus(e.target.value);
            });
        }
        
        // PLASTIC LINER CONTROLS
        // Plastic liner RPM control
        const linerRpmControl = document.getElementById('liner-rpm-control');
        if (linerRpmControl) {
            linerRpmControl.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('liner-rpm-value').textContent = value;
                
                startUserInteraction();
                
                debounceControlUpdate(() => {
                    DittoAPI.updateProperty('PlasticLiner', 'RPM', parseInt(value));
                });
            });
            
            linerRpmControl.addEventListener('change', () => {
                DittoAPI.updateProperty('PlasticLiner', 'RPM', parseInt(linerRpmControl.value));
                endUserInteraction();
            });
        }
        
        // Plastic liner status control
        const linerStatusControl = document.getElementById('liner-status');
        if (linerStatusControl) {
            linerStatusControl.addEventListener('change', (e) => {
                updateLinerStatus(e.target.value);
            });
        }
        
        // COOKIE FORMER CONTROLS
        // Cookie former production rate control
        const cookieRateControl = document.getElementById('cookie-rate-control');
        if (cookieRateControl) {
            cookieRateControl.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('cookie-rate-value').textContent = `${value}/min`;
                
                startUserInteraction();
                
                debounceControlUpdate(() => {
                    DittoAPI.updateProperty('CookieFormer', 'Rate', parseInt(value));
                });
            });
            
            cookieRateControl.addEventListener('change', () => {
                DittoAPI.updateProperty('CookieFormer', 'Rate', parseInt(cookieRateControl.value));
                endUserInteraction();
            });
        }
        
        // Cookie quality control
        const cookieQualityControl = document.getElementById('cookie-quality-control');
        if (cookieQualityControl) {
            cookieQualityControl.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('cookie-quality-value').textContent = `${value}%`;
                
                startUserInteraction();
                
                debounceControlUpdate(() => {
                    DittoAPI.updateProperty('CookieFormer', 'GoodParts', parseFloat(value));
                });
            });
            
            cookieQualityControl.addEventListener('change', () => {
                DittoAPI.updateProperty('CookieFormer', 'GoodParts', parseFloat(cookieQualityControl.value));
                endUserInteraction();
            });
        }
        
        // Cookie former status control
        const cookieFormerStatusControl = document.getElementById('cookie-former-status');
        if (cookieFormerStatusControl) {
            cookieFormerStatusControl.addEventListener('change', (e) => {
                updateCookieFormerStatus(e.target.value);
            });
        }
        
        // BOX SEALER CONTROLS
        // Box sealer speed control
        const boxSealerSpeedControl = document.getElementById('box-sealer-speed');
        if (boxSealerSpeedControl) {
            boxSealerSpeedControl.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('box-sealer-speed-value').textContent = `${value} m/s`;
                
                startUserInteraction();
                
                debounceControlUpdate(() => {
                    DittoAPI.updateProperty('BoxSealer', 'Speed', parseFloat(value));
                });
            });
            
            boxSealerSpeedControl.addEventListener('change', () => {
                DittoAPI.updateProperty('BoxSealer', 'Speed', parseFloat(boxSealerSpeedControl.value));
                endUserInteraction();
            });
        }
        
        // Box sealer status control
        const boxSealerStatusControl = document.getElementById('box-sealer-status');
        if (boxSealerStatusControl) {
            boxSealerStatusControl.addEventListener('change', (e) => {
                updateBoxSealerStatus(e.target.value);
            });
        }
        
        // CONVEYOR SYSTEM CONTROLS
        // Conveyor speed control
        const conveyorSpeedControl = document.getElementById('conveyor-speed-control');
        if (conveyorSpeedControl) {
            conveyorSpeedControl.addEventListener('input', (e) => {
                const value = e.target.value;
                document.getElementById('conveyor-speed-value').textContent = `${value} m/s`;
                
                startUserInteraction();
                
                debounceControlUpdate(() => {
                    DittoAPI.updateProperty('Conveyor', 'Speed', parseFloat(value));
                });
            });
            
            conveyorSpeedControl.addEventListener('change', () => {
                DittoAPI.updateProperty('Conveyor', 'Speed', parseFloat(conveyorSpeedControl.value));
                endUserInteraction();
            });
        }
        
        // Conveyor status control
        const conveyorStatusControl = document.getElementById('conveyor-status');
        if (conveyorStatusControl) {
            conveyorStatusControl.addEventListener('change', (e) => {
                updateConveyorStatus(e.target.value);
            });
        }
        
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
     * Update status for water tank component
     * @param {string} status - Water tank status
     */
    function updateWaterTankStatus(status) {
        // Remove condition to allow updates regardless of active component
        DittoAPI.updateProperty('WaterTank', 'Status', status);
    }
    
    /**
     * Update status for the freezer tunnel component
     * @param {string} status - Freezer tunnel status
     */
    function updateFreezerStatus(status) {
        // Remove condition to allow updates regardless of active component
        DittoAPI.updateProperty('FreezerTunnel', 'Status', status);
    }
    
    /**
     * Update status for the plastic liner component
     * @param {string} status - Plastic liner status
     */
    function updateLinerStatus(status) {
        // Remove condition to allow updates regardless of active component
        DittoAPI.updateProperty('PlasticLiner', 'Status', status);
    }
    
    /**
     * Update status for the cookie former component
     * @param {string} status - Cookie former status
     */
    function updateCookieFormerStatus(status) {
        // Remove condition to allow updates regardless of active component
        DittoAPI.updateProperty('CookieFormer', 'Status', status);
    }
    
    /**
     * Update status for the box sealer component
     * @param {string} status - Box sealer status
     */
    function updateBoxSealerStatus(status) {
        // Remove condition to allow updates regardless of active component
        DittoAPI.updateProperty('BoxSealer', 'Status', status);
    }
    
    /**
     * Update status for the conveyor system component
     * @param {string} status - Conveyor system status
     */
    function updateConveyorStatus(status) {
        // Remove condition to allow updates regardless of active component
        DittoAPI.updateProperty('Conveyor', 'Status', status);
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
        
        // Ensure we're using the Factory thing
        DittoAPI.setDigitalTwinModel('factory');
        
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
        // Determine which mixer to display data for in the UI
        let selectedMixerPrefix = dashboardState.selectedMixer;
        
        if (selectedMixerPrefix === 'all') {
            // Default to Mixer_0 for displaying values when "all" is selected
            selectedMixerPrefix = 'Mixer_0';
        }
        
        // Update temperature slider
        if (twinState.features?.[selectedMixerPrefix]?.properties?.Temperature !== undefined && !dashboardState.isUserInteracting) {
            const temp = parseFloat(twinState.features[selectedMixerPrefix].properties.Temperature);
            document.getElementById('temp-control').value = temp;
            document.getElementById('temp-value').textContent = `${temp}°C`;
        }
        
        // Update RPM slider
        if (twinState.features?.[selectedMixerPrefix]?.properties?.RPM !== undefined && !dashboardState.isUserInteracting) {
            const rpm = parseFloat(twinState.features[selectedMixerPrefix].properties.RPM);
            document.getElementById('rpm-control').value = rpm;
            document.getElementById('rpm-value').textContent = rpm;
        }
        
        // Update alarm status dropdown
        const alarmComponentName = `${selectedMixerPrefix}_AlarmComponent`;
        if (twinState.features?.[alarmComponentName]?.properties?.alarm_status !== undefined && !dashboardState.isUserInteracting) {
            const status = twinState.features[alarmComponentName].properties.alarm_status;
            document.getElementById('alarm-status').value = status;
        }
        
        // Update water flow rate
        if (twinState.features?.WaterTank?.properties?.flowRate1 !== undefined && !dashboardState.isUserInteracting) {
            const flowRate = parseFloat(twinState.features.WaterTank.properties.flowRate1);
            const waterFlowControl = document.getElementById('water-flow-control');
            const waterFlowValue = document.getElementById('water-flow-value');
            
            if (waterFlowControl && waterFlowValue) {
                waterFlowControl.value = flowRate;
                waterFlowValue.textContent = flowRate;
            }
        }
        
        // Update water tank volume
        if (twinState.features?.WaterTank?.properties?.tankVolume1 !== undefined && !dashboardState.isUserInteracting) {
            const tankVolume = parseFloat(twinState.features.WaterTank.properties.tankVolume1);
            const waterVolumeControl = document.getElementById('water-volume-control');
            const waterVolumeValue = document.getElementById('water-volume-value');
            
            if (waterVolumeControl && waterVolumeValue) {
                waterVolumeControl.value = tankVolume;
                waterVolumeValue.textContent = `${tankVolume}%`;
            }
        }
        
        // Update freezer tunnel temperature
        if (twinState.features?.FreezerTunnel?.properties?.Temperature !== undefined && !dashboardState.isUserInteracting) {
            const freezerTemp = parseFloat(twinState.features.FreezerTunnel.properties.Temperature);
            const freezerTempControl = document.getElementById('freezer-temp-control');
            const freezerTempValue = document.getElementById('freezer-temp-value');
            
            if (freezerTempControl && freezerTempValue) {
                freezerTempControl.value = freezerTemp;
                freezerTempValue.textContent = `${freezerTemp}°C`;
            }
        }
        
        // Update freezer tunnel status - changed from State to Status
        if (twinState.features?.FreezerTunnel?.properties?.Status !== undefined && !dashboardState.isUserInteracting) {
            const freezerStatus = twinState.features.FreezerTunnel.properties.Status;
            const freezerStatusControl = document.getElementById('freezer-status');
            
            if (freezerStatusControl) {
                freezerStatusControl.value = freezerStatus;
            }
        }
        
        // Update plastic liner RPM
        if (twinState.features?.PlasticLiner?.properties?.RPM !== undefined && !dashboardState.isUserInteracting) {
            const linerRPM = parseFloat(twinState.features.PlasticLiner.properties.RPM);
            const linerRpmControl = document.getElementById('liner-rpm-control');
            const linerRpmValue = document.getElementById('liner-rpm-value');
            
            if (linerRpmControl && linerRpmValue) {
                linerRpmControl.value = linerRPM;
                linerRpmValue.textContent = linerRPM;
            }
        }
        
        // Update plastic liner status
        if (twinState.features?.PlasticLiner?.properties?.Status !== undefined && !dashboardState.isUserInteracting) {
            const linerStatus = twinState.features.PlasticLiner.properties.Status;
            const linerStatusControl = document.getElementById('liner-status');
            
            if (linerStatusControl) {
                linerStatusControl.value = linerStatus;
            }
        }
        
        // Update cookie former rate
        if (twinState.features?.CookieFormer?.properties?.Rate !== undefined && !dashboardState.isUserInteracting) {
            const cookieRate = parseFloat(twinState.features.CookieFormer.properties.Rate);
            const cookieRateControl = document.getElementById('cookie-rate-control');
            const cookieRateValue = document.getElementById('cookie-rate-value');
            
            if (cookieRateControl && cookieRateValue) {
                cookieRateControl.value = cookieRate;
                cookieRateValue.textContent = `${cookieRate}/min`;
            }
        }
        
        // Update cookie former good parts percentage
        if (twinState.features?.CookieFormer?.properties?.GoodParts !== undefined && !dashboardState.isUserInteracting) {
            const goodParts = parseFloat(twinState.features.CookieFormer.properties.GoodParts);
            const cookieQualityControl = document.getElementById('cookie-quality-control');
            const cookieQualityValue = document.getElementById('cookie-quality-value');
            
            if (cookieQualityControl && cookieQualityValue) {
                cookieQualityControl.value = goodParts;
                cookieQualityValue.textContent = `${goodParts}%`;
            }
        }
        
        // Update cookie former status
        if (twinState.features?.CookieFormer?.properties?.Status !== undefined && !dashboardState.isUserInteracting) {
            const formerStatus = twinState.features.CookieFormer.properties.Status;
            const cookieFormerStatusControl = document.getElementById('cookie-former-status');
            
            if (cookieFormerStatusControl) {
                cookieFormerStatusControl.value = formerStatus;
            }
        }
        
        // Update box sealer speed
        if (twinState.features?.BoxSealer?.properties?.Speed !== undefined && !dashboardState.isUserInteracting) {
            const boxSpeed = parseFloat(twinState.features.BoxSealer.properties.Speed);
            const boxSealerSpeedControl = document.getElementById('box-sealer-speed');
            const boxSealerSpeedValue = document.getElementById('box-sealer-speed-value');
            
            if (boxSealerSpeedControl && boxSealerSpeedValue) {
                boxSealerSpeedControl.value = boxSpeed;
                boxSealerSpeedValue.textContent = `${boxSpeed} m/s`;
            }
        }
        
        // Update box sealer status
        if (twinState.features?.BoxSealer?.properties?.Status !== undefined && !dashboardState.isUserInteracting) {
            const boxStatus = twinState.features.BoxSealer.properties.Status;
            const boxSealerStatusControl = document.getElementById('box-sealer-status');
            
            if (boxSealerStatusControl) {
                boxSealerStatusControl.value = boxStatus;
            }
        }
        
        // Update conveyor system speed
        if (twinState.features?.Conveyor?.properties?.Speed !== undefined && !dashboardState.isUserInteracting) {
            const conveyorSpeed = parseFloat(twinState.features.Conveyor.properties.Speed);
            const conveyorSpeedControl = document.getElementById('conveyor-speed-control');
            const conveyorSpeedValue = document.getElementById('conveyor-speed-value');
            
            if (conveyorSpeedControl && conveyorSpeedValue) {
                conveyorSpeedControl.value = conveyorSpeed;
                conveyorSpeedValue.textContent = `${conveyorSpeed} m/s`;
            }
        }
        
        // Update conveyor system status
        if (twinState.features?.Conveyor?.properties?.Status !== undefined && !dashboardState.isUserInteracting) {
            const conveyorStatus = twinState.features.Conveyor.properties.Status;
            const conveyorStatusControl = document.getElementById('conveyor-status');
            
            if (conveyorStatusControl) {
                conveyorStatusControl.value = conveyorStatus;
            }
        }
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
    
    // Expose the simulation object to window for potential external access
    window.Simulation = Simulation;
});