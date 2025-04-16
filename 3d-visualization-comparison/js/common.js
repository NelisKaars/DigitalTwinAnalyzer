/**
 * common.js - Shared functionality for digital twin visualization frameworks
 * This file provides common utilities and APIs that all frameworks can use.
 */

// Digital Twin API namespace
const DittoAPI = {
    // Default settings
    settings: {
        baseUrl: 'http://localhost:8080',
        thingId: 'org.eclipse.ditto:Mixer',
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
    
    // Change the digital twin model
    setDigitalTwinModel(modelId) {
        switch(modelId) {
            case 'mixer':
                this.settings.thingId = 'org.eclipse.ditto:Mixer';
                break;
            case 'factory':
                this.settings.thingId = 'org.eclipse.ditto:Factory';
                break;
            default:
                console.warn(`Unknown model ID: ${modelId}, using Mixer as default`);
                this.settings.thingId = 'org.eclipse.ditto:Mixer';
        }
    }
};

// Model loader utility to standardize 3D model loading across frameworks
const ModelLoader = {
    // Get the correct model path based on the selected framework and model
    getModelPath(framework, modelId) {
        const basePath = '../models/';
        
        const modelMap = {
            'mixer': {
                'threejs': 'CookieFactoryMixer.glb',
                'babylonjs': 'CookieFactoryMixer.glb',
                'unity': 'CookieFactoryMixer.fbx'
            },
            'factory': {
                'threejs': 'CookieFactory.glb',
                'babylonjs': 'CookieFactory.glb',
                'unity': 'CookieFactory.fbx'
            }
        };
        
        if (modelMap[modelId] && modelMap[modelId][framework]) {
            return basePath + modelMap[modelId][framework];
        }
        
        // Default to Mixer model for Three.js if not found
        console.warn(`Model path not found for ${framework}/${modelId}, using default`);
        return basePath + 'CookieFactoryMixer.glb';
    },
    
    // Future: Add more utility methods for handling model loading, animations, etc.
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
    }
};