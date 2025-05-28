/**
 * common.js - Shared functionality for digital twin visualization frameworks
 * This file provides common utilities and APIs that all frameworks can use.
 */

// Digital Twin API namespace
const DittoAPI = {
    // Default settings
    settings: {
        baseUrl: 'http://54.217.116.62:8080', // Changed from localhost to backend EC2 IP
        thingId: 'org.eclipse.ditto:Factory', // Always use Factory as the default
        username: 'ditto',
        password: 'ditto',
        pollingInterval: 2000 // ms
    },

    // State tracking
    _pollingInterval: null,
    _pollingCallback: null,
    _isPaused: false,

    // Authentication header generation
    getAuthHeader() {
        const auth = btoa(`${this.settings.username}:${this.settings.password}`);
        return { 'Authorization': `Basic ${auth}` };
    },

    // Get the current state of the digital twin
    async getTwinState() {
        try {
            const response = await fetch(`${this.settings.baseUrl}/api/2/things/${this.settings.thingId}`, {
                method: 'GET',
                headers: this.getAuthHeader()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching twin state:', error);
            return null;
        }
    },

    // Update a property of the digital twin
    async updateProperty(featureId, propertyName, value) {
        try {
            const url = `${this.settings.baseUrl}/api/2/things/${this.settings.thingId}/features/${featureId}/properties/${propertyName}`;
            
            const startTime = performance.now();
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    ...this.getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(value)
            });
            const endTime = performance.now();
            
            // Track latency for metrics
            MetricsCollector.recordLatency(endTime - startTime);
            
            return response.status === 204;
        } catch (error) {
            console.error(`Error updating ${propertyName}:`, error);
            return false;
        }
    },

    // Start polling for digital twin updates
    startPolling(callback) {
        // Store callback for pause/resume functionality
        this._pollingCallback = callback;
        
        // Clean up any existing interval
        if (this._pollingInterval) {
            clearInterval(this._pollingInterval);
        }
        
        // Reset paused state
        this._isPaused = false;
        
        // Start new polling interval
        this._pollingInterval = setInterval(async () => {
            // Skip polling when paused
            if (this._isPaused) return;
            
            const state = await this.getTwinState();
            if (state && this._pollingCallback) {
                this._pollingCallback(state);
            }
        }, this.settings.pollingInterval);
        
        return this._pollingInterval;
    },

    // Stop polling
    stopPolling() {
        if (this._pollingInterval) {
            clearInterval(this._pollingInterval);
            this._pollingInterval = null;
            this._pollingCallback = null;
        }
    },

    // Pause polling (temporarily suspend updates)
    pausePolling() {
        this._isPaused = true;
        console.log("Polling paused - user is interacting with controls");
    },

    // Resume polling after pause
    resumePolling() {
        this._isPaused = false;
        console.log("Polling resumed");
        
        // Immediately fetch latest state after resuming
        if (this._pollingCallback) {
            this.getTwinState().then(state => {
                if (state) {
                    this._pollingCallback(state);
                }
            });
        }
    },
    
    // Initialize the factory digital twin with default values if it doesn't exist
    async initializeFactoryTwin() {
        try {
            // Check if the factory twin exists
            const state = await this.getTwinState();
            if (!state) {
                console.log("Factory digital twin not found. Creating initial state...");
                
                // Create the base thing structure
                await fetch(`${this.settings.baseUrl}/api/2/things/${this.settings.thingId}`, {
                    method: 'PUT',
                    headers: {
                        ...this.getAuthHeader(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        "policyId": this.settings.thingId,
                        "definition": "org.eclipse.ditto:factory:1.0.0"
                    })
                });
                
                // Initialize Mixer features
                for (let i = 0; i < 6; i++) {
                    // Create mixer feature
                    await this.updateProperty(`Mixer_${i}`, 'Temperature', 100);
                    await this.updateProperty(`Mixer_${i}`, 'RPM', 60);
                    
                    // Create mixer alarm component
                    await this.updateProperty(`Mixer_${i}_AlarmComponent`, 'alarm_status', 'NORMAL');
                }
                
                // Initialize Water Tank
                await this.updateProperty('WaterTank', 'flowRate1', 35);
                await this.updateProperty('WaterTank', 'tankVolume1', 75);
                
                // Initialize Freezer Tunnel
                await this.updateProperty('FreezerTunnel', 'Temperature', -15);
                await this.updateProperty('FreezerTunnel', 'State', 'RUNNING');
                
                // Initialize Plastic Liner
                await this.updateProperty('PlasticLiner', 'RPM', 45);
                await this.updateProperty('PlasticLiner', 'Status', 'NORMAL');
                
                // Initialize Cookie Former 
                await this.updateProperty('CookieFormer', 'Rate', 120); // Changed from ProductionRate to Rate
                await this.updateProperty('CookieFormer', 'GoodParts', 98.5);
                await this.updateProperty('CookieFormer', 'Status', 'OPERATIONAL');
                
                // Initialize Box Sealer
                await this.updateProperty('BoxSealer', 'Speed', 0.8);
                await this.updateProperty('BoxSealer', 'Status', 'OPERATIONAL');
                
                // Initialize Conveyor System
                await this.updateProperty('Conveyor', 'Speed', 0.8); // Changed from ConveyorSystem to Conveyor
                await this.updateProperty('Conveyor', 'Status', 'RUNNING');
                
                console.log("Factory digital twin initialized with default values");
            }
            
            return true;
        } catch (error) {
            console.error("Error initializing factory digital twin:", error);
            return false;
        }
    }
};

// Model loader utility to standardize 3D model loading across frameworks
const ModelLoader = {
    // Get the correct model path based on the selected framework and model
    getModelPath(framework, modelId) {
        // Updated paths to use the local models directory
        const factoryPath = '../models/CookieFactory/';
        
        // Only return factory model paths
        return {
            sceneDefinition: `${factoryPath}CookieFactory.json`,
            models: {
                environment: `${factoryPath}CookieFactoryEnvironment.glb`,
                mixer: `${factoryPath}CookieFactoryMixer.glb`,
                line: `${factoryPath}CookieFactoryLine.glb`,
                waterTank: `${factoryPath}CookieFactoryWaterTank.glb`,
                freezerTunnel: `${factoryPath}CookieFactoryFreezer.glb`,
                plasticLiner: `${factoryPath}CookieFactoryLiner.glb`,
                cookieFormer: `${factoryPath}CookieFactoryFormer.glb`,
                boxSealer: `${factoryPath}CookieFactorySealer.glb`,
                conveyorSystem: `${factoryPath}CookieFactoryConveyor.glb`
            }
        };
    },
    
    // Load the scene definition JSON file
    async loadSceneDefinition(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading scene definition:', error);
            return null;
        }
    }
};

// Digital Twin properties helper - maps data to visual elements
const DTProperties = {
    // Map temperature value to visual elements (color, effects, etc.)
    mapTemperature(temp, framework) {
        // Common mapping logic that frameworks can use
        let color;
        
        if (temp < 50) {
            color = 0x0088ff; // cool blue
        } else if (temp < 100) {
            color = 0xffaa00; // warm orange
        } else {
            color = 0xff0000; // hot red
        }
        
        return {
            color: color,
            intensity: Math.min(1.0, temp / 200), // normalized intensity
            emissive: temp > 150 // whether to add emissive effect
        };
    },
    
    // Map RPM value to animation speed
    mapRPM(rpm) {
        // Normalize RPM to animation speed
        return {
            rotationSpeed: (rpm / 60) * Math.PI * 2, // radians per second
            intensity: rpm / 120 // normalized intensity
        };
    },
    
    // Map alarm status to visual indicators
    mapAlarmStatus(status) {
        switch(status) {
            case 'NORMAL':
                return { color: 0x00ff00, blinking: false };
            case 'ACTIVE':
                return { color: 0xff0000, blinking: true };
            case 'ACKNOWLEDGED':
                return { color: 0xffff00, blinking: true };
            default:
                return { color: 0x0000ff, blinking: false };
        }
    },
    
    // Map water flow rate to visual indicators
    mapWaterFlowRate(rate) {
        // Water flow rate mapping (used for water tank in factory view)
        return {
            flowSpeed: rate / 40, // normalized flow speed
            color: rate > 40 ? 0xff0000 : 0x00ff00, // red if over threshold, otherwise green
            intensity: Math.min(1.0, rate / 80) // normalized intensity
        };
    },
    
    // Map freezer tunnel temperature to visual indicators
    mapFreezerTemperature(temp) {
        // Freezer temperature mapping (should be negative values)
        const normalizedTemp = Math.abs(temp) / 30; // normalize from -30 to 0
        
        return {
            intensity: normalizedTemp, // intensity based on how cold it is
            color: temp < -20 ? 0x0044ff : temp < -10 ? 0x00ccff : 0x88ddff, // colder = deeper blue
            frostEffect: temp < -25 // add frost effect for very cold temperatures
        };
    },
    
    // Map conveyor speed to animation speed
    mapConveyorSpeed(speed) {
        return {
            movementSpeed: speed, // direct mapping for animation
            intensity: speed / 2 // normalized for effects (0.0 - 1.0 for max speed of 2 m/s)
        };
    },
    
    // Map liner RPM to animation speed
    mapLinerRPM(rpm) {
        return {
            rotationSpeed: (rpm / 60) * Math.PI, // half the regular mixer speed
            intensity: rpm / 90 // normalized intensity (0-90 range)
        };
    },
    
    // Map cookie former production rate to animations
    mapCookieFormerRate(rate) {
        return {
            formingSpeed: rate / 200, // normalized for animation (0.0 - 1.0 for 0-200 range)
            cyclesPerMinute: rate / 60 // cycles per second
        };
    },
    
    // Map component status to visual indicators
    mapComponentStatus(status) {
        switch(status.toUpperCase()) {
            case 'NORMAL':
            case 'OPERATIONAL':
            case 'RUNNING':
                return { color: 0x00ff00, indicatorLight: true, active: true };
            case 'WARNING':
            case 'STANDBY':
                return { color: 0xffaa00, indicatorLight: true, active: true };
            case 'FAULT':
            case 'CRITICAL':
            case 'MAINTENANCE':
                return { color: 0xff0000, indicatorLight: true, active: false };
            case 'STOPPED':
                return { color: 0xff5500, indicatorLight: true, active: false };
            default:
                return { color: 0x888888, indicatorLight: false, active: false };
        }
    }
};

// Factory scene helper - provides utilities for working with the factory scene
const FactoryScene = {
    // Parse the CookieFactory.json scene and extract key information
    parseSceneDefinition(sceneData) {
        if (!sceneData || !sceneData.nodes) {
            console.error('Invalid scene data');
            return null;
        }
        
        // Extract all mixers, water tanks, and other components
        const components = {
            rootNode: sceneData.nodes[0],
            environment: null,
            mixers: [],
            waterTank: null,
            cookieLines: [],
            freezerTunnel: null,
            plasticLiner: null,
            cookieFormer: null,
            boxSealer: null,
            conveyorSystem: null
        };
        
        // Process each node in the scene
        sceneData.nodes.forEach(node => {
            // Check node type based on name and components
            if (node.name === 'Environment') {
                components.environment = node;
            } else if (node.name.startsWith('Mixer_')) {
                components.mixers.push(node);
            } else if (node.name === 'WaterTank') {
                components.waterTank = node;
            } else if (node.name.startsWith('COOKIE_LINE')) {
                components.cookieLines.push(node);
            } else if (node.name === 'FreezerTunnel') {
                components.freezerTunnel = node;
            } else if (node.name === 'PlasticLiner') {
                components.plasticLiner = node;
            } else if (node.name === 'CookieFormer') {
                components.cookieFormer = node;
            } else if (node.name === 'BoxSealer') {
                components.boxSealer = node;
            } else if (node.name === 'ConveyorSystem') {
                components.conveyorSystem = node;
            }
        });
        
        return components;
    },
    
    // Get transformation data for a specific node
    getNodeTransform(node) {
        if (!node || !node.transform) return null;
        
        return {
            position: node.transform.position || [0, 0, 0],
            rotation: node.transform.rotation || [0, 0, 0],
            scale: node.transform.scale || [1, 1, 1]
        };
    },
    
    // Apply transforms from scene definition to a model
    // This function has been moved from the framework-specific visualizer to be reusable
    applyModelTransform(model, nodeData, framework) {
        if (!nodeData || !nodeData.transform) return;

        const transform = nodeData.transform;
        
        // Framework implementations need to handle this in their own way,
        // but we can pass back a standardized structure
        return {
            position: transform.position || [0, 0, 0],
            rotation: transform.rotation || [0, 0, 0],
            scale: transform.scale || [1, 1, 1]
        };
    },
    
    // Get camera waypoints for the factory scene tour
    getFactoryWaypoints() {
        return [
            { // Overview of factory
                position: [35, 30, 100],
                target: [35, 0, 75],
                up: [0, 1, 0],
                duration: 3000,
                description: "Factory Overview"
            },
            { // Mixers area
                position: [5, 15, 60],
                target: [15, 5, 40],
                up: [0, 1, 0],
                duration: 3000,
                description: "Mixer Area"
            },
            { // Water Tank
                position: [-10, 10, 40],
                target: [-5, 5, 20],
                up: [0, 1, 0],
                duration: 3000,
                description: "Water Tank"
            },
            { // Cookie Former
                position: [25, 10, 20],
                target: [20, 5, 10],
                up: [0, 1, 0],
                duration: 3000,
                description: "Cookie Former"
            },
            { // Freezer Tunnel
                position: [40, 10, 0],
                target: [30, 5, -10],
                up: [0, 1, 0],
                duration: 3000,
                description: "Freezer Tunnel"
            },
            { // Packaging Line
                position: [60, 15, 20],
                target: [50, 5, 10],
                up: [0, 1, 0],
                duration: 3000,
                description: "Packaging Line"
            },
            { // Box Sealer
                position: [70, 10, 40],
                target: [60, 5, 30],
                up: [0, 1, 0],
                duration: 3000,
                description: "Box Sealer"
            },
            { // Back to overview
                position: [35, 30, 100],
                target: [35, 0, 75],
                up: [0, 1, 0],
                duration: 3000,
                description: "Factory Overview"
            }
        ];
    },
    
    // Generate random realistic values for factory simulation
    generateRandomFactoryValues() {
        // Random mixer temperature (with constraints)
        const mixerTemp = Math.max(50, Math.min(150, 100 + (Math.random() * 60 - 30)));
        
        // Random mixer RPM
        const mixerRPM = Math.max(20, Math.min(100, 60 + (Math.random() * 40 - 20)));
        
        // Random water tank properties
        const waterFlowRate = Math.max(10, Math.min(90, 35 + (Math.random() * 30 - 15)));
        const waterTankVolume = Math.max(20, Math.min(95, 75 + (Math.random() * 20 - 10)));
        
        // Random freezer tunnel temperature
        const freezerTemp = Math.max(-30, Math.min(0, -15 + (Math.random() * 10 - 5)));
        
        // Random plastic liner RPM
        const linerRPM = Math.max(10, Math.min(80, 45 + (Math.random() * 20 - 10)));
        
        // Random cookie former rate
        const formerRate = Math.max(60, Math.min(180, 120 + (Math.random() * 40 - 20)));
        const goodParts = Math.max(90, Math.min(99.9, 98.5 + (Math.random() * 1.5 - 0.5)));
        
        // Random conveyor speed
        const conveyorSpeed = Math.max(0.2, Math.min(1.5, 0.8 + (Math.random() * 0.6 - 0.3)));
        
        // Return all properties
        return {
            mixerTemp,
            mixerRPM,
            waterFlowRate,
            waterTankVolume,
            freezerTemp,
            linerRPM,
            formerRate,
            goodParts,
            conveyorSpeed
        };
    }
};

// Initialize the factory digital twin on script load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the factory twin with all required features
    DittoAPI.initializeFactoryTwin()
        .then(() => {
            console.log('Factory digital twin ready');
        })
        .catch(err => {
            console.error('Error initializing factory digital twin:', err);
        });
});