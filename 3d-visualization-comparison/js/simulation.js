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
        elapsedTime: 0,                // Total elapsed time
        duration: 60,                  // Total duration in seconds
        cameraPathDuration: 5,        // Time to complete full camera path in seconds
        dataUpdateInterval: 2000,      // How often to update digital twin data (ms)
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
        }
        // { 
        //     position: [7, 3, 0],        // Move toward production line
        //     target: [7, 3, 15],
        //     up: [0, 1, 0]
        // },
        // { 
        //     position: [7, 3, 15],       // Move toward production line
        //     target: [7, 3, 15],
        //     up: [0, 1, 0]
        // },
        // { 
        //     position: [8, 3, -10],       // Take a left to production line
        //     target: [2, 2, -10],
        //     up: [0, 1, 0]
        // },
        // { 
        //     position: [5, 3, -15],       // Walk to the left around production line
        //     target: [0, 2, -12],
        //     up: [0, 1, 0]
        // },
        // { 
        //     position: [0, 3, -15],       // Close up of production line (Data changed so plastic liner is sped up)
        //     target: [0, 1, -10],
        //     up: [0, 1, 0]
        // },
        // { 
        //     position: [-8, 4, -5],       // Walk through freezer tunnel (alarm should go off or something so visuals are affected)
        //     target: [-5, 2, 0],
        //     up: [0, 1, 0]
        // },
        // { 
        //     position: [-15, 3, 0],       // Walk towards door cookiemixer room
        //     target: [-8, 2, 0],
        //     up: [0, 1, 0]
        // },
        // { 
        //     position: [-10, 3, 5],       // Walk through door cookiemixer room
        //     target: [-8, 2, 5],
        //     up: [0, 1, 0]
        // },
        // { 
        //     position: [22, 3, 69],        /// Stand in Cookiemixer room (ALl RPMs should speed up, then alarm go off)
        //     target: [22, 3, 69],
        //     up: [0, 1, 0]
        // },
        // { 
        //     position: [0, 8, 0],         // turn around go up and whilst looking down to see the entire factory (the end)
        //     target: [0, 0, 0],
        //     up: [0, 0, 1]
        // }
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
        alarmSequence: [
            // Sequence of alarms to trigger during simulation
            { time: 10, mixer: 2, status: 'ACTIVE' },
            { time: 15, mixer: 2, status: 'ACKNOWLEDGED' },
            { time: 20, mixer: 2, status: 'NORMAL' },
            { time: 25, mixer: 4, status: 'ACTIVE' },
            { time: 35, mixer: 1, status: 'ACTIVE' },
            { time: 40, mixer: 1, status: 'ACKNOWLEDGED' }
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
        this.config.elapsedTime = 0;
        this.config.waypointIndex = 0;
        this.config.waypointProgress = 0;
        this.config.lastDataUpdate = 0;
        this.config.cameraControlsEnabled = true;
    },
    
    // Start the simulation
    start(activeInstance) {
        if (this.config.isRunning) return;
        
        this.config.isRunning = true;
        this.config.startTime = performance.now();
        this.config.activeInstance = activeInstance;
        
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
        
        // Start animation loop
        requestAnimationFrame(this._update.bind(this));
        
        console.log('Simulation started');
    },
    
    // Pause the simulation
    pause() {
        if (!this.config.isRunning || this.config.isPaused) return;
        
        this.config.isPaused = true;
        console.log('Simulation paused');
    },
    
    // Resume the simulation
    resume() {
        if (!this.config.isRunning || !this.config.isPaused) return;
        
        this.config.isPaused = false;
        requestAnimationFrame(this._update.bind(this));
        console.log('Simulation resumed');
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
        
        // Finalize metrics
        if (MetricsCollector.stopSimulation) {
            MetricsCollector.stopSimulation();
        }
        
        if (this.callbacks.onComplete) {
            this.callbacks.onComplete();
        }
        
        console.log('Simulation stopped, camera controls restored');
    },
    
    // Main update loop
    _update(timestamp) {
        if (!this.config.isRunning) return;
        if (this.config.isPaused) {
            requestAnimationFrame(this._update.bind(this));
            return;
        }
        
        // Calculate elapsed time
        const now = performance.now();
        this.config.elapsedTime = (now - this.config.startTime) / 1000; // convert to seconds
        
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
    
    // Update digital twin data based on elapsed time
    _updateDigitalTwinData() {
        const time = this.config.elapsedTime;
        
        // Update temperatures for all mixers
        for (let i = 0; i < 6; i++) {
            const pattern = this.updatePatterns.temperature;
            const phaseOffset = i * (pattern.mixerOffset / pattern.period) * Math.PI * 2;
            const value = pattern.base + pattern.amplitude * 
                Math.sin((time / pattern.period) * Math.PI * 2 + phaseOffset);
            
            DittoAPI.updateProperty(`Mixer_${i}`, 'Temperature', Math.round(value));
        }
        
        // Update RPMs for all mixers
        for (let i = 0; i < 6; i++) {
            const pattern = this.updatePatterns.rpm;
            const phaseOffset = i * (pattern.mixerOffset / pattern.period) * Math.PI * 2;
            const value = pattern.base + pattern.amplitude * 
                Math.sin((time / pattern.period) * Math.PI * 2 + phaseOffset);
            
            DittoAPI.updateProperty(`Mixer_${i}`, 'RPM', Math.round(value));
        }
        
        // Update water flow rate
        const flowPattern = this.updatePatterns.waterFlow;
        const flowValue = flowPattern.base + flowPattern.amplitude * 
            Math.sin((time / flowPattern.period) * Math.PI * 2);
        DittoAPI.updateProperty('WaterTank', 'flowRate1', Math.round(flowValue));
        
        // Update water tank volume
        const volumePattern = this.updatePatterns.waterVolume;
        const volumeValue = volumePattern.base + volumePattern.amplitude * 
            Math.sin((time / volumePattern.period) * Math.PI * 2);
        DittoAPI.updateProperty('WaterTank', 'tankVolume1', Math.round(volumeValue));
        
        // Check for alarm events
        this.updatePatterns.alarmSequence.forEach(alarm => {
            if (time >= alarm.time && time < alarm.time + 1) {
                // Trigger the alarm within a 1-second window of its scheduled time
                DittoAPI.updateProperty(`Mixer_${alarm.mixer}_AlarmComponent`, 'alarm_status', alarm.status);
            }
        });
        
        // Call data update callback
        if (this.callbacks.onDataUpdate) {
            this.callbacks.onDataUpdate();
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
    }
};

// Export the simulation object to make it accessible globally
window.Simulation = Simulation;