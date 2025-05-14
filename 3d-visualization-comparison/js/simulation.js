/**
 * simulation.js - Camera and data simulation for standardized performance testing
 * Handles automatic camera movement and digital twin data updates for benchmarking.
 */
const Simulation = {
    // Configuration
    config: {
        isRunning: false,              // Whether simulation is currently running
        isPaused: false,               // Whether simulation is paused
        startTime: 0,                  // When simulation started
        pauseStartTime: 0,             // When pause started
        totalPauseTime: 0,             // Total time spent in pause
        elapsedTime: 0,                // Total elapsed time
        duration: 90,                  // Fixed duration in seconds (90 seconds = 1:30)
        cameraPathDuration: 95,        // Time to complete full camera path in seconds
        dataUpdateInterval: 100,       // Fixed data update interval (in milliseconds)
        lastDataUpdate: 0,             // Timestamp of last data update
        waypointIndex: 0,              // Current waypoint index
        waypointProgress: 0,           // Progress between waypoints (0-1)
        activeInstance: null,          // Reference to active framework instance
        cameraControlsEnabled: true,   // Whether user camera controls are enabled
    },
    
    // Camera path waypoints (position, target, up vector)
    waypoints: [
        { 
            position: [50, 50, -100],        // Move to the hall next to production line
            target: [0, 0, 0],
            up: [0, 1, 0]
        },
        { 
            position: [7, 3, -20],        // Move toward production line
            target: [7, 3, 15],
            up: [0, 1, 0]
        },
        { 
            position: [7, 3, 15],       // Move toward production line
            target: [42, 3, 65],
            up: [0, 1, 0]
        },
        { 
            position: [42, 3, 15],       // Take a left to production line
            target: [36, 3, 28],
            up: [0, 1, 0]
        },
        { 
            position: [37, 2, 28],       // Walk to the left around production line
            target: [35, 1, 28],
            up: [0, 1, 0]
        },
        { 
            position: [37, 2, 35],       // Close up of production line (Data changed so plastic liner is sped up)
            target: [35, 1, 35],
            up: [0, 1, 0]
        },
        { 
            position: [40, 3, 37],       // Close up of production line (Data changed so plastic liner is sped up)
            target: [35, 1, 35],
            up: [0, 1, 0]
        },
        { 
            position: [38, 3, 40],       // Walk through freezer tunnel (alarm should go off or something so visuals are affected)
            target: [32, 2, 40],
            up: [0, 1, 0]
        },
        { 
            position: [38, 3, 47],       // Walk through freezer tunnel (alarm should go off or something so visuals are affected)
            target: [32, 2, 47],
            up: [0, 1, 0]
        },
        { 
            position: [42, 3, 60],       // Walk towards door cookiemixer room
            target: [32, 2, 47],
            up: [0, 1, 0]
        },
        { 
            position: [37, 3, 60],       // Walk towards door cookiemixer room
            target: [22.5, 3, 69],
            up: [0, 1, 0]
        },
        { 
            position: [22.5, 3, 60],       // Walk towards door cookiemixer room
            target: [22.5, 3, 68],
            up: [0, 1, 0]
        },
        { 
            position: [22.5, 2, 66],       // Walk through door cookiemixer room
            target: [22.5, 1, 80],
            up: [0, 1, 0]
        },
        { 
            position: [22.5, 2, 66],       // Stand in Cookiemixer room (ALl RPMs should speed up, then alarm go off)
            target: [22.5, 1, 80],
            up: [0, 1, 0]
        },
        { 
            position: [22.5, 2, 66],       // Stand in Cookiemixer room (ALl RPMs should speed up, then alarm go off)
            target: [22.5, 1, 80],
            up: [0, 1, 0]
        },
        { 
            position: [22.5, 2, 71],         // turn around go up and whilst looking down to see the entire factory (the end)
            target: [31, 1, 71],
            up: [0, 1, 0]
        },
        { 
            position: [22.5, 2, 76],         // turn around go up and whilst looking down to see the entire factory (the end)
            target: [31, 1, 71],
            up: [0, 1, 0]
        },
        { 
            position: [22.5, 25, 100],      // turn around go up and whilst looking down to see the entire factory (the end)
            target: [0, 0, 0],
            up: [0, 1, 0]
        },
        {
            position: [22.5, 50, 120],        // turn around go up and whilst looking down to see the entire factory (the end)
            target: [0, 0, 0],
            up: [0, 1, 0]
        },
    ],
    
    // Property update patterns - how values change during simulation
    updatePatterns: {
        temperature: {
            base: 50,              // Starting temperature
            amplitude: 100,        // Max change amount
            period: 30,            // Seconds for full cycle
            mixerOffset: 5         // Phase offset between mixers
        },
        rpm: {
            base: 30,
            amplitude: 60,
            period: 15,
            mixerOffset: 2
        },
        waterFlow: {
            base: 40,
            amplitude: 40,
            period: 20
        },
        waterVolume: {
            base: 60,
            amplitude: 30,
            period: 45
        },
        // Scheduled events based on the timesheet
        scheduledEvents: [
            // 0:15 -> Box sealer -> Speed update
            { time: 15, component: 'BoxSealer', property: 'Speed', value: 1.5, duration: 2 },
            
            // 0:18 -> Plastic Liner -> RPM increase -> Alarm status: ACTIVE
            { time: 18, component: 'PlasticLiner', property: 'RPM', value: 90, duration: 2 },
            { time: 20, component: 'PlasticLiner', property: 'Status', value: 'ACTIVE', duration: 0 },
            
            // 0:23 -> Conveyor system -> Speed increase: (slow to high) -> Alarm: Acknowledged  
            { time: 24, component: 'Conveyor', property: 'Speed', value: 1.8, duration: 2 },
            { time: 26, component: 'Conveyor', property: 'Status', value: 'ACKNOWLEDGED', duration: 0 },
            
            // 0:35 -> Freezer tunnel -> Temperature: increase (above 0) -> Alarm: ACTIVE
            { time: 35, component: 'FreezerTunnel', property: 'Temperature', value: 5, duration: 2 },
            { time: 36, component: 'FreezerTunnel', property: 'Status', value: 'ACTIVE', duration: 0 },
            
            // 0:39 -> Water tank -> Flow rate: increase
            { time: 39, component: 'WaterTank', property: 'flowRate1', value: 80, duration: 2 },
            
            // 0:40 -> Cookie former -> Rate: increase -> Good parts: small decrease
            { time: 40, component: 'CookieFormer', property: 'Rate', value: 180, duration: 1 },
            { time: 40, component: 'CookieFormer', property: 'GoodParts', value: 94.5, duration: 1 },
            
            // 0:57 -> Mixer 0 -> Random rpm (between 0-120) and temperature change (above 0)
            { time: 57, component: 'Mixer_0', property: 'RPM', value: 115, duration: 1 },
            { time: 57, component: 'Mixer_0', property: 'Temperature', value: 140, duration: 1 },
            
            // 1:00 -> Mixer_1 -> Random rpm and temperature change -> Alarm status: Acknowledged
            { time: 60, component: 'Mixer_1', property: 'RPM', value: 90, duration: 1 },
            { time: 60, component: 'Mixer_1', property: 'Temperature', value: 120, duration: 1 },
            { time: 61, component: 'Mixer_1_AlarmComponent', property: 'alarm_status', value: 'ACKNOWLEDGED', duration: 0 },
            
            // 1:00 -> Mixer_2 -> Random rpm and temperature change
            { time: 60, component: 'Mixer_2', property: 'RPM', value: 75, duration: 1 },
            { time: 60, component: 'Mixer_2', property: 'Temperature', value: 95, duration: 1 },
            
            // 1:04 -> Mixer_3 -> RPM decrease -> Status: acknowledged
            { time: 64, component: 'Mixer_3', property: 'RPM', value: 15, duration: 1 },
            { time: 65, component: 'Mixer_3_AlarmComponent', property: 'alarm_status', value: 'ACKNOWLEDGED', duration: 0 },
            
            // 1:09 -> Mixer_4 -> High RPM increase and high temperature increase -> Status alarm: Active
            { time: 69, component: 'Mixer_4', property: 'RPM', value: 115, duration: 1 },
            { time: 69, component: 'Mixer_4', property: 'Temperature', value: 160, duration: 1 },
            { time: 70, component: 'Mixer_4_AlarmComponent', property: 'alarm_status', value: 'ACTIVE', duration: 0 },
            
            // 1:16 -> Mixer_5 -> RPM to 0 and Temperature to 19 -> Status alarm: active
            { time: 72, component: 'Mixer_5', property: 'RPM', value: 0, duration: 1 },
            { time: 72, component: 'Mixer_5', property: 'Temperature', value: 19, duration: 1 },
            { time: 73, component: 'Mixer_5_AlarmComponent', property: 'alarm_status', value: 'ACTIVE', duration: 0 }
        ]
    },
    
    // Event callbacks
    callbacks: {
        onProgress: null,          // Called with progress (0-1)
        onComplete: null,          // Called when simulation completes
        onDataUpdate: null,        // Called when data is updated
    },
    
    // Initialize simulation
    initialize(options = {}) {
        // Apply any provided options
        if (options.duration) this.config.duration = options.duration;
        if (options.cameraPathDuration) this.config.cameraPathDuration = options.cameraPathDuration;
        if (options.dataUpdateInterval) this.config.dataUpdateInterval = options.dataUpdateInterval;
        
        // Set callbacks
        if (options.onProgress) this.callbacks.onProgress = options.onProgress;
        if (options.onComplete) this.callbacks.onComplete = options.onComplete;
        if (options.onDataUpdate) this.callbacks.onDataUpdate = options.onDataUpdate;
        
        // Reset state
        this.reset();
        
        console.log('Simulation initialized with duration', this.config.duration, 'seconds');
        return this;
    },
    
    // Reset simulation state
    reset() {
        this.config.isRunning = false;
        this.config.isPaused = false;
        this.config.startTime = 0;
        this.config.pauseStartTime = 0;
        this.config.totalPauseTime = 0;
        this.config.elapsedTime = 0;
        this.config.waypointIndex = 0;
        this.config.waypointProgress = 0;
        this.config.lastDataUpdate = 0;
        this.config.cameraControlsEnabled = true;
        
        // Clear pending events array for clean state
        this._pendingEvents = [];
    },
    
    // Start the simulation
    start(activeInstance) {
        if (this.config.isRunning) return;
        
        this.config.isRunning = true;
        this.config.startTime = performance.now();
        this.config.activeInstance = activeInstance;
        
        // Use a much shorter data update interval for more precise control of scheduled events
        this.config.dataUpdateInterval = 100; // Check every 100ms instead of 2000ms
        
        // Disable camera controls when starting simulation
        if (activeInstance && typeof activeInstance.setCameraControlsEnabled === 'function') {
            activeInstance.setCameraControlsEnabled(false);
            this.config.cameraControlsEnabled = false;
        }
        
        // Start metrics collection specific to this simulation run
        if (MetricsCollector.startSimulation) {
            MetricsCollector.startSimulation();
        }
        
        // Pause normal polling during simulation to avoid conflicts
        DittoAPI.pausePolling();
        
        // Force an immediate initial data update - don't wait for the first interval
        this._updateDigitalTwinData();
        this.config.lastDataUpdate = performance.now();
        console.log('Initial data update triggered');
        
        // Start animation loop
        requestAnimationFrame(this._update.bind(this));
        
        console.log('Simulation started');
    },
    
    // Pause the simulation
    pause() {
        if (!this.config.isRunning || this.config.isPaused) return;
        
        this.config.isPaused = true;
        this.config.pauseStartTime = performance.now();
        console.log('Simulation paused');
    },
    
    // Resume the simulation
    resume() {
        if (!this.config.isRunning || !this.config.isPaused) return;
        
        // Calculate how long we were paused and add to total pause time
        const pauseDuration = performance.now() - this.config.pauseStartTime;
        this.config.totalPauseTime += pauseDuration;
        
        this.config.isPaused = false;
        requestAnimationFrame(this._update.bind(this));
        console.log('Simulation resumed after', Math.round(pauseDuration) / 1000, 'seconds pause');
    },
    
    // Stop the simulation
    stop() {
        if (!this.config.isRunning) return;
        
        this.config.isRunning = false;
        
        // Re-enable camera controls
        if (this.config.activeInstance && typeof this.config.activeInstance.setCameraControlsEnabled === 'function') {
            this.config.activeInstance.setCameraControlsEnabled(true);
            this.config.cameraControlsEnabled = true;
        }
        
        // Resume normal polling
        DittoAPI.resumePolling();
        
        // Reset all twin values to their defaults
        this._resetTwinToDefaultValues();
        
        // Finalize metrics
        if (MetricsCollector.stopSimulation) {
            MetricsCollector.stopSimulation();
        }
        
        if (this.callbacks.onComplete) {
            this.callbacks.onComplete();
        }
        
        console.log('Simulation stopped, camera controls restored, twin values reset to defaults');
    },
    
    // Main update loop
    _update(timestamp) {
        if (!this.config.isRunning) return;
        if (this.config.isPaused) {
            requestAnimationFrame(this._update.bind(this));
            return;
        }
        
        // Calculate elapsed time, accounting for pause time
        const now = performance.now();
        this.config.elapsedTime = (now - this.config.startTime - this.config.totalPauseTime) / 1000; // convert to seconds
        
        // Check if simulation is complete
        if (this.config.elapsedTime >= this.config.duration) {
            this.stop();
            return;
        }
        
        // Update camera position
        this._updateCameraPosition();
        
        // Update digital twin data if interval has passed
        if (now - this.config.lastDataUpdate > this.config.dataUpdateInterval) {
            this._updateDigitalTwinData();
            this.config.lastDataUpdate = now;
        }
        
        // Call progress callback
        const progress = this.config.elapsedTime / this.config.duration;
        if (this.callbacks.onProgress) {
            this.callbacks.onProgress(progress);
        }
        
        // Continue animation loop
        requestAnimationFrame(this._update.bind(this));
    },
    
    // Update camera position along waypoint path
    _updateCameraPosition() {
        if (!this.config.activeInstance || !this.config.activeInstance.setCameraPosition) {
            return;
        }
        
        // Calculate normalized time for entire path (0 to 1)
        const pathTime = (this.config.elapsedTime % this.config.cameraPathDuration) / this.config.cameraPathDuration;
        
        // Calculate current and next waypoint indices
        const waypointCount = this.waypoints.length;
        const totalProgress = pathTime * waypointCount;
        const currentIndex = Math.floor(totalProgress);
        const nextIndex = (currentIndex + 1) % waypointCount;
        
        // Calculate progress between the two waypoints (0 to 1)
        const segmentProgress = totalProgress - currentIndex;
        
        // Get the current and next waypoints
        const current = this.waypoints[currentIndex];
        const next = this.waypoints[nextIndex];
        
        // Interpolate between waypoints
        const position = this._interpolateVector(current.position, next.position, segmentProgress);
        const target = this._interpolateVector(current.target, next.target, segmentProgress);
        const up = this._interpolateVector(current.up, next.up, segmentProgress);
        
        // Update camera
        this.config.activeInstance.setCameraPosition(position, target, up);
    },
    
    // Helper to interpolate between two 3D vectors
    _interpolateVector(a, b, t) {
        return [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t
        ];
    },
    
    // Helper to interpolate a value over time for smooth transitions
    _interpolateValue(startValue, targetValue, startTime, duration, currentTime) {
        // If duration is 0 or very short, return target value immediately
        if (duration <= 0.1) return targetValue;
        
        // Calculate progress (0 to 1)
        const progress = Math.min(1, Math.max(0, (currentTime - startTime) / duration));
        
        // Linear interpolation
        return startValue + ((targetValue - startValue) * progress);
    },
    
    // Get current property value
    _getCurrentPropertyValue(component, property) {
        // Try to find a pending event for this component/property
        const pendingEvent = this._pendingEvents.find(e => 
            e.component === component && e.property === property);
            
        if (pendingEvent) {
            return pendingEvent.currentValue;
        }
        
        // Default values for common properties
        switch(property) {
            case 'RPM':
                return component.startsWith('Mixer') ? 60 : 45;
            case 'Temperature':
                return component.startsWith('Mixer') ? 100 : 
                      (component === 'FreezerTunnel' ? -15 : 20);
            case 'Speed':
                return 0.8;
            case 'flowRate1':
                return 40;
            case 'tankVolume1':
                return 75;
            case 'Rate':
                return 120;
            case 'GoodParts':
                return 98.5;
            default:
                return 0;
        }
    },
    
    // Track pending property changes for smooth transitions
    _pendingEvents: [],
    
    // Update digital twin data based on elapsed time
    _updateDigitalTwinData() {
        const time = this.config.elapsedTime;
        
        // Track if any updates were made
        let updatesPerformed = false;
        
        // Process scheduled events
        this.updatePatterns.scheduledEvents.forEach(event => {
            // Check if this event should be triggered (considering a small window to ensure it's not missed)
            if (time >= event.time && time < event.time + 0.1) {
                console.log(`Triggering scheduled event at ${time.toFixed(1)}s: ${event.component}.${event.property} = ${event.value}`);
                updatesPerformed = true;
                
                if (event.duration > 0) {
                    // For events with duration, add to pending events for smooth transition
                    const startValue = this._getCurrentPropertyValue(event.component, event.property);
                    this._pendingEvents.push({
                        component: event.component,
                        property: event.property,
                        startValue: startValue,
                        targetValue: event.value,
                        startTime: time,
                        duration: event.duration,
                        currentValue: startValue
                    });
                    console.log(`Added to pending events: ${event.component}.${event.property}: ${startValue} -> ${event.value} over ${event.duration}s`);
                } else {
                    // Immediate change for events without duration (like status changes)
                    DittoAPI.updateProperty(event.component, event.property, event.value);
                }
            }
        });
        
        // Process pending events (for smooth transitions)
        if (this._pendingEvents.length > 0) {
            console.log(`Processing ${this._pendingEvents.length} pending events at time ${time.toFixed(2)}s`);
            updatesPerformed = true;
        }
        
        for (let i = this._pendingEvents.length - 1; i >= 0; i--) {
            const event = this._pendingEvents[i];
            
            // Calculate interpolated value
            event.currentValue = this._interpolateValue(
                event.startValue,
                event.targetValue,
                event.startTime,
                event.duration,
                time
            );
            
            console.log(`Updating ${event.component}.${event.property} = ${event.currentValue} (progress: ${Math.min(1, Math.max(0, (time - event.startTime) / event.duration)).toFixed(2)})`);
            
            // Update the property with the interpolated value
            DittoAPI.updateProperty(event.component, event.property, 
                typeof event.currentValue === 'number' ? Math.round(event.currentValue) : event.currentValue);
            
            // Remove completed events
            if (time >= event.startTime + event.duration) {
                console.log(`Completed event: ${event.component}.${event.property} reached final value ${event.targetValue}`);
                this._pendingEvents.splice(i, 1);
            }
        }
        
        // Call data update callback
        if (this.callbacks.onDataUpdate) {
            this.callbacks.onDataUpdate();
        }
        
        // Important: Update the visualization with the latest twin state if updates were performed
        if (updatesPerformed || this._pendingEvents.length > 0) {
            this._updateVisualizationFromLatestState();
        }
    },
    
    // Fetch latest twin state and update the visualization
    async _updateVisualizationFromLatestState() {
        if (!this.config.activeInstance || !this.config.activeInstance.updateFromTwin) {
            console.log("No active instance or updateFromTwin method not available");
            return;
        }
        
        try {
            // Fetch the latest state directly
            const currentState = await DittoAPI.getTwinState();
            if (currentState) {
                console.log("Updating visualization from latest twin state");
                
                // Update the visualization directly - this will update the tags
                this.config.activeInstance.updateFromTwin(currentState);
                
                // Also update dashboard UI if the function is available globally
                if (typeof updateDashboardUI === 'function') {
                    updateDashboardUI(currentState);
                } else if (window.dashboardState && typeof window.dashboardState.updateDashboardUI === 'function') {
                    window.dashboardState.updateDashboardUI(currentState);
                }
            }
        } catch (error) {
            console.error("Error updating visualization from latest state:", error);
        }
    },
    
    // Add a waypoint to the camera path
    addWaypoint(position, target, up) {
        this.waypoints.push({ position, target, up });
    },
    
    // Clear all waypoints
    clearWaypoints() {
        this.waypoints = [];
    },
    
    // Get current simulation status
    getStatus() {
        return {
            isRunning: this.config.isRunning,
            isPaused: this.config.isPaused,
            elapsedTime: this.config.elapsedTime,
            progress: this.config.elapsedTime / this.config.duration,
            duration: this.config.duration
        };
    },
    
    // Reset all twin values to their defaults
    _resetTwinToDefaultValues() {
        console.log("Resetting all twin values to their original state...");
        
        // Define default values for all components
        const defaultValues = {
            // Mixers - all to default values
            'Mixer_0': { 'Temperature': 100, 'RPM': 60 },
            'Mixer_1': { 'Temperature': 100, 'RPM': 60 },
            'Mixer_2': { 'Temperature': 100, 'RPM': 60 },
            'Mixer_3': { 'Temperature': 100, 'RPM': 60 },
            'Mixer_4': { 'Temperature': 100, 'RPM': 60 },
            'Mixer_5': { 'Temperature': 100, 'RPM': 60 },
            
            // Mixer Alarm components - all to NORMAL
            'Mixer_0_AlarmComponent': { 'alarm_status': 'NORMAL' },
            'Mixer_1_AlarmComponent': { 'alarm_status': 'NORMAL' },
            'Mixer_2_AlarmComponent': { 'alarm_status': 'NORMAL' },
            'Mixer_3_AlarmComponent': { 'alarm_status': 'NORMAL' },
            'Mixer_4_AlarmComponent': { 'alarm_status': 'NORMAL' },
            'Mixer_5_AlarmComponent': { 'alarm_status': 'NORMAL' },
            
            // Water Tank
            'WaterTank': { 'flowRate1': 35, 'tankVolume1': 75, 'Status': 'NORMAL' },
            
            // Freezer Tunnel
            'FreezerTunnel': { 'Temperature': -15, 'Status': 'NORMAL' },
            
            // Plastic Liner
            'PlasticLiner': { 'RPM': 45, 'Status': 'NORMAL' },
            
            // Cookie Former
            'CookieFormer': { 'Rate': 120, 'GoodParts': 98.5, 'Status': 'NORMAL' },
            
            // Box Sealer
            'BoxSealer': { 'Speed': 0.8, 'Status': 'NORMAL' },
            
            // Conveyor
            'Conveyor': { 'Speed': 0.8, 'Status': 'NORMAL' }
        };
        
        // Updates for all components and their properties
        const updatePromises = [];
        
        // Reset each component to its default values
        for (const component in defaultValues) {
            for (const property in defaultValues[component]) {
                const value = defaultValues[component][property];
                updatePromises.push(DittoAPI.updateProperty(component, property, value));
            }
        }
        
        // Wait for all updates to complete, then update the visualization
        Promise.all(updatePromises)
            .then(() => {
                console.log("All twin values have been reset to defaults");
                // Update the visualization with the reset values
                this._updateVisualizationFromLatestState();
            })
            .catch(err => {
                console.error("Error during reset operation:", err);
            });
    }
};

// Export the simulation object to make it accessible globally
window.Simulation = Simulation;