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
            position: [22.5, 2, 72],       // Walk through door cookiemixer room
            target: [28.75, 1, 80],
            up: [0, 1, 0]
        },
        { 
            position: [22.5, 2, 87],       // Stand in Cookiemixer room (ALl RPMs should speed up, then alarm go off)
            target: [34, 1, 71],
            up: [0, 1, 0]
        },
        { 
            position: [31.5, 2, 87],       // Stand in Cookiemixer room (ALl RPMs should speed up, then alarm go off)
            target: [31, 1, 71],
            up: [0, 1, 0]
        },
        { 
            position: [41, 2, 87],         // turn around go up and whilst looking down to see the entire factory (the end)
            target: [40, 1, 71],
            up: [0, 1, 0]
        },
        { 
            position: [50, 2, 87],         // turn around go up and whilst looking down to see the entire factory (the end)
            target: [40, 1, 71],
            up: [0, 1, 0]
        },
        { 
            position: [50, 25, 95],      // turn around go up and whilst looking down to see the entire factory (the end)
            target: [0, 0, 0],
            up: [0, 1, 0]
        },
        {
            position: [50, 50, 120],        // turn around go up and whilst looking down to see the entire factory (the end)
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
            { time: 40, component: 'CookieFormer', property: 'GoodParts', value: 81.5, duration: 1 },
            { time: 40 , component: 'CookieFormer', property: 'Status', value: 'ACTIVE', duration: 0 },
            
            // 0:57 -> Mixer 0 -> Random rpm (between 0-120) and temperature change (above 0)
            { time: 57, component: 'Mixer_0', property: 'RPM', value: 115, duration: 1 },
            { time: 57, component: 'Mixer_0', property: 'Temperature', value: 140, duration: 1 },
            
            // 1:00 - Multiple mixer updates
            { time: 60, component: 'Mixer_3', property: 'RPM', value: 85, duration: 1 },
            { time: 60, component: 'Mixer_7', property: 'Temperature', value: 145, duration: 1 },
            { time: 60, component: 'Mixer_12', property: 'RPM', value: 110, duration: 1 },
            { time: 60, component: 'Mixer_18', property: 'Temperature', value: 75, duration: 1 },
            { time: 60.5, component: 'Mixer_3_AlarmComponent', property: 'alarm_status', value: 'ACKNOWLEDGED', duration: 0 },
            
            // 1:01
            { time: 61, component: 'Mixer_1', property: 'RPM', value: 45, duration: 1 },
            { time: 61, component: 'Mixer_9', property: 'Temperature', value: 165, duration: 1 },
            { time: 61, component: 'Mixer_15', property: 'RPM', value: 0, duration: 1 },
            { time: 61, component: 'Mixer_22', property: 'Temperature', value: 95, duration: 1 },
            { time: 61.5, component: 'Mixer_15_AlarmComponent', property: 'alarm_status', value: 'ACTIVE', duration: 0 },
            
            // 1:02
            { time: 62, component: 'Mixer_5', property: 'RPM', value: 120, duration: 1 },
            { time: 62, component: 'Mixer_11', property: 'Temperature', value: 35, duration: 1 },
            { time: 62, component: 'Mixer_19', property: 'RPM', value: 75, duration: 1 },
            { time: 62, component: 'Mixer_25', property: 'Temperature', value: 180, duration: 1 },
            { time: 62.5, component: 'Mixer_25_AlarmComponent', property: 'alarm_status', value: 'ACTIVE', duration: 0 },
            
            // 1:03
            { time: 63, component: 'Mixer_2', property: 'Temperature', value: 125, duration: 1 },
            { time: 63, component: 'Mixer_8', property: 'RPM', value: 95, duration: 1 },
            { time: 63, component: 'Mixer_14', property: 'Temperature', value: 55, duration: 1 },
            { time: 63, component: 'Mixer_20', property: 'RPM', value: 30, duration: 1 },
            
            // 1:04
            { time: 64, component: 'Mixer_4', property: 'RPM', value: 105, duration: 1 },
            { time: 64, component: 'Mixer_10', property: 'Temperature', value: 170, duration: 1 },
            { time: 64, component: 'Mixer_16', property: 'RPM', value: 15, duration: 1 },
            { time: 64, component: 'Mixer_23', property: 'Temperature', value: 40, duration: 1 },
            { time: 64.5, component: 'Mixer_10_AlarmComponent', property: 'alarm_status', value: 'ACKNOWLEDGED', duration: 0 },
            
            // 1:05
            { time: 65, component: 'Mixer_6', property: 'Temperature', value: 115, duration: 1 },
            { time: 65, component: 'Mixer_13', property: 'RPM', value: 80, duration: 1 },
            { time: 65, component: 'Mixer_17', property: 'Temperature', value: 160, duration: 1 },
            { time: 65, component: 'Mixer_21', property: 'RPM', value: 55, duration: 1 },
            { time: 65, component: 'Mixer_24', property: 'Temperature', value: 25, duration: 1 },
            
            // 1:06
            { time: 66, component: 'Mixer_0', property: 'RPM', value: 65, duration: 1 },
            { time: 66, component: 'Mixer_7', property: 'RPM', value: 100, duration: 1 },
            { time: 66, component: 'Mixer_12', property: 'Temperature', value: 50, duration: 1 },
            { time: 66, component: 'Mixer_18', property: 'RPM', value: 90, duration: 1 },
            { time: 66.5, component: 'Mixer_7_AlarmComponent', property: 'alarm_status', value: 'NORMAL', duration: 0 },
            
            // 1:07
            { time: 67, component: 'Mixer_3', property: 'Temperature', value: 135, duration: 1 },
            { time: 67, component: 'Mixer_9', property: 'RPM', value: 20, duration: 1 },
            { time: 67, component: 'Mixer_15', property: 'Temperature', value: 85, duration: 1 },
            { time: 67, component: 'Mixer_22', property: 'RPM', value: 115, duration: 1 },
            
            // 1:08
            { time: 68, component: 'Mixer_1', property: 'Temperature', value: 155, duration: 1 },
            { time: 68, component: 'Mixer_5', property: 'Temperature', value: 70, duration: 1 },
            { time: 68, component: 'Mixer_11', property: 'RPM', value: 35, duration: 1 },
            { time: 68, component: 'Mixer_19', property: 'Temperature', value: 175, duration: 1 },
            { time: 68.5, component: 'Mixer_19_AlarmComponent', property: 'alarm_status', value: 'ACTIVE', duration: 0 },
            
            // 1:09
            { time: 69, component: 'Mixer_2', property: 'RPM', value: 70, duration: 1 },
            { time: 69, component: 'Mixer_8', property: 'Temperature', value: 45, duration: 1 },
            { time: 69, component: 'Mixer_14', property: 'RPM', value: 120, duration: 1 },
            { time: 69, component: 'Mixer_20', property: 'Temperature', value: 140, duration: 1 },
            { time: 69, component: 'Mixer_25', property: 'RPM', value: 5, duration: 1 },
            
            // 1:10
            { time: 70, component: 'Mixer_4', property: 'Temperature', value: 90, duration: 1 },
            { time: 70, component: 'Mixer_10', property: 'RPM', value: 110, duration: 1 },
            { time: 70, component: 'Mixer_16', property: 'Temperature', value: 30, duration: 1 },
            { time: 70, component: 'Mixer_23', property: 'RPM', value: 85, duration: 1 },
            { time: 70.5, component: 'Mixer_4_AlarmComponent', property: 'alarm_status', value: 'ACKNOWLEDGED', duration: 0 },
            
            // 1:11
            { time: 71, component: 'Mixer_6', property: 'RPM', value: 50, duration: 1 },
            { time: 71, component: 'Mixer_13', property: 'Temperature', value: 105, duration: 1 },
            { time: 71, component: 'Mixer_17', property: 'RPM', value: 95, duration: 1 },
            { time: 71, component: 'Mixer_21', property: 'Temperature', value: 150, duration: 1 },
            { time: 71, component: 'Mixer_24', property: 'RPM', value: 115, duration: 1 },
            
            // 1:12
            { time: 72, component: 'Mixer_0', property: 'Temperature', value: 120, duration: 1 },
            { time: 72, component: 'Mixer_7', property: 'Temperature', value: 65, duration: 1 },
            { time: 72, component: 'Mixer_12', property: 'RPM', value: 40, duration: 1 },
            { time: 72, component: 'Mixer_18', property: 'Temperature', value: 80, duration: 1 },
            { time: 72.5, component: 'Mixer_21_AlarmComponent', property: 'alarm_status', value: 'ACTIVE', duration: 0 },
            
            // 1:13
            { time: 73, component: 'Mixer_3', property: 'RPM', value: 25, duration: 1 },
            { time: 73, component: 'Mixer_9', property: 'Temperature', value: 110, duration: 1 },
            { time: 73, component: 'Mixer_15', property: 'RPM', value: 75, duration: 1 },
            { time: 73, component: 'Mixer_22', property: 'Temperature', value: 60, duration: 1 },
            
            // 1:14
            { time: 74, component: 'Mixer_1', property: 'RPM', value: 60, duration: 1 },
            { time: 74, component: 'Mixer_5', property: 'RPM', value: 105, duration: 1 },
            { time: 74, component: 'Mixer_11', property: 'Temperature', value: 175, duration: 1 },
            { time: 74, component: 'Mixer_19', property: 'RPM', value: 10, duration: 1 },
            { time: 74, component: 'Mixer_25', property: 'Temperature', value: 95, duration: 1 },
            
            // 1:15
            { time: 75, component: 'Mixer_2', property: 'Temperature', value: 130, duration: 1 },
            { time: 75, component: 'Mixer_8', property: 'RPM', value: 85, duration: 1 },
            { time: 75, component: 'Mixer_14', property: 'Temperature', value: 35, duration: 1 },
            { time: 75, component: 'Mixer_20', property: 'RPM', value: 100, duration: 1 },
            { time: 75.5, component: 'Mixer_11_AlarmComponent', property: 'alarm_status', value: 'ACTIVE', duration: 0 },
            
            // 1:16
            { time: 76, component: 'Mixer_4', property: 'RPM', value: 45, duration: 1 },
            { time: 76, component: 'Mixer_10', property: 'Temperature', value: 55, duration: 1 },
            { time: 76, component: 'Mixer_16', property: 'RPM', value: 120, duration: 1 },
            { time: 76, component: 'Mixer_23', property: 'Temperature', value: 165, duration: 1 },
            
            // 1:17
            { time: 77, component: 'Mixer_6', property: 'Temperature', value: 40, duration: 1 },
            { time: 77, component: 'Mixer_13', property: 'RPM', value: 90, duration: 1 },
            { time: 77, component: 'Mixer_17', property: 'Temperature', value: 125, duration: 1 },
            { time: 77, component: 'Mixer_21', property: 'RPM', value: 15, duration: 1 },
            { time: 77, component: 'Mixer_24', property: 'Temperature', value: 170, duration: 1 },
            { time: 77.5, component: 'Mixer_23_AlarmComponent', property: 'alarm_status', value: 'ACKNOWLEDGED', duration: 0 },
            
            // 1:18
            { time: 78, component: 'Mixer_0', property: 'RPM', value: 80, duration: 1 },
            { time: 78, component: 'Mixer_7', property: 'RPM', value: 35, duration: 1 },
            { time: 78, component: 'Mixer_12', property: 'Temperature', value: 100, duration: 1 },
            { time: 78, component: 'Mixer_18', property: 'RPM', value: 115, duration: 1 },
            
            // 1:19
            { time: 79, component: 'Mixer_3', property: 'Temperature', value: 85, duration: 1 },
            { time: 79, component: 'Mixer_9', property: 'RPM', value: 65, duration: 1 },
            { time: 79, component: 'Mixer_15', property: 'Temperature', value: 145, duration: 1 },
            { time: 79, component: 'Mixer_22', property: 'RPM', value: 95, duration: 1 },
            { time: 79.5, component: 'Mixer_24_AlarmComponent', property: 'alarm_status', value: 'ACTIVE', duration: 0 },
            
            // 1:20
            { time: 80, component: 'Mixer_1', property: 'Temperature', value: 30, duration: 1 },
            { time: 80, component: 'Mixer_5', property: 'Temperature', value: 180, duration: 1 },
            { time: 80, component: 'Mixer_11', property: 'RPM', value: 50, duration: 1 },
            { time: 80, component: 'Mixer_19', property: 'Temperature', value: 110, duration: 1 },
            { time: 80, component: 'Mixer_25', property: 'RPM', value: 120, duration: 1 },
            
            // 1:21
            { time: 81, component: 'Mixer_2', property: 'RPM', value: 20, duration: 1 },
            { time: 81, component: 'Mixer_8', property: 'Temperature', value: 75, duration: 1 },
            { time: 81, component: 'Mixer_14', property: 'RPM', value: 105, duration: 1 },
            { time: 81, component: 'Mixer_20', property: 'Temperature', value: 160, duration: 1 },
            { time: 81.5, component: 'Mixer_5_AlarmComponent', property: 'alarm_status', value: 'ACTIVE', duration: 0 },
            
            // 1:22
            { time: 82, component: 'Mixer_4', property: 'Temperature', value: 115, duration: 1 },
            { time: 82, component: 'Mixer_10', property: 'RPM', value: 25, duration: 1 },
            { time: 82, component: 'Mixer_16', property: 'Temperature', value: 70, duration: 1 },
            { time: 82, component: 'Mixer_23', property: 'RPM', value: 90, duration: 1 },
            
            // 1:23
            { time: 83, component: 'Mixer_6', property: 'RPM', value: 110, duration: 1 },
            { time: 83, component: 'Mixer_13', property: 'Temperature', value: 135, duration: 1 },
            { time: 83, component: 'Mixer_17', property: 'RPM', value: 55, duration: 1 },
            { time: 83, component: 'Mixer_21', property: 'Temperature', value: 45, duration: 1 },
            { time: 83, component: 'Mixer_24', property: 'RPM', value: 0, duration: 1 },
            { time: 83.5, component: 'Mixer_13_AlarmComponent', property: 'alarm_status', value: 'ACKNOWLEDGED', duration: 0 },
            
            // 1:24
            { time: 84, component: 'Mixer_0', property: 'Temperature', value: 155, duration: 1 },
            { time: 84, component: 'Mixer_7', property: 'Temperature', value: 90, duration: 1 },
            { time: 84, component: 'Mixer_12', property: 'RPM', value: 75, duration: 1 },
            { time: 84, component: 'Mixer_18', property: 'Temperature', value: 25, duration: 1 },
            
            // 1:25
            { time: 85, component: 'Mixer_3', property: 'RPM', value: 115, duration: 1 },
            { time: 85, component: 'Mixer_9', property: 'Temperature', value: 170, duration: 1 },
            { time: 85, component: 'Mixer_15', property: 'RPM', value: 30, duration: 1 },
            { time: 85, component: 'Mixer_22', property: 'Temperature', value: 80, duration: 1 },
            { time: 85.5, component: 'Mixer_9_AlarmComponent', property: 'alarm_status', value: 'ACTIVE', duration: 0 },
            
            // 1:26
            { time: 86, component: 'Mixer_1', property: 'RPM', value: 95, duration: 1 },
            { time: 86, component: 'Mixer_5', property: 'RPM', value: 40, duration: 1 },
            { time: 86, component: 'Mixer_11', property: 'Temperature', value: 60, duration: 1 },
            { time: 86, component: 'Mixer_19', property: 'RPM', value: 85, duration: 1 },
            { time: 86, component: 'Mixer_25', property: 'Temperature', value: 140, duration: 1 },
            
            // 1:27
            { time: 87, component: 'Mixer_2', property: 'Temperature', value: 105, duration: 1 },
            { time: 87, component: 'Mixer_8', property: 'RPM', value: 120, duration: 1 },
            { time: 87, component: 'Mixer_14', property: 'Temperature', value: 175, duration: 1 },
            { time: 87, component: 'Mixer_20', property: 'RPM', value: 10, duration: 1 } 
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
        
        // IMPORTANT: Stop metrics collection BEFORE resetting twin data
        // to avoid capturing the data binding latency spike from the reset
        if (MetricsCollector.stopSimulation) {
            MetricsCollector.stopSimulation();
        }
        
        // Resume normal polling
        DittoAPI.resumePolling();
        
        // Reset all twin values to their defaults
        this._resetTwinToDefaultValues();
        
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
            // Use appropriate stop method based on mode
            if (this.stressTest.enabled) {
                this.stopStressTest();
            } else {
                this.stop();
            }
            return;
        }
        
        // Update camera position - use stress test camera if in stress test mode
        if (this.stressTest.enabled) {
            this._updateCameraPositionStressTest();
        } else {
            this._updateCameraPosition();
        }
        
        // Update digital twin data if interval has passed - use stress test data updates if in stress test mode
        if (now - this.config.lastDataUpdate > this.config.dataUpdateInterval) {
            if (this.stressTest.enabled && this.stressTest.mode === 'maximum-throughput') {
                // Only use old method for maximum throughput mode
                this._handleMaximumThroughputUpdates(now);
            } else if (this.stressTest.enabled && this.stressTest.mode === 'frequency-stepped') {
                // For frequency-stepped, updates are handled by high-frequency timer
                // Just update the last data update time to prevent normal data updates
            } else {
                this._updateDigitalTwinData();
            }
            this.config.lastDataUpdate = now;
        }
        
        // Call progress callback
        const progress = this.config.elapsedTime / this.config.duration;
        if (this.callbacks.onProgress) {
            this.callbacks.onProgress(progress);
        }
        
        // Update timer display directly here to ensure it works
        if (typeof updateSimulationTimer === 'function') {
            updateSimulationTimer(this.config.elapsedTime, this.stressTest.enabled ? 'stress-test' : 'normal');
        } else if (window.dashboardState && typeof window.dashboardState.updateSimulationTimer === 'function') {
            window.dashboardState.updateSimulationTimer(this.config.elapsedTime, this.stressTest.enabled ? 'stress-test' : 'normal');
        } else {
            // Direct timer update as fallback
            const simulationType = this.stressTest.enabled ? 'stress-test' : 'normal';
            const timerId = simulationType === 'stress-test' ? 'stress-test-timer' : 'normal-simulation-timer';
            const timerElement = document.getElementById(timerId);
            
            if (timerElement) {
                const totalDuration = simulationType === 'stress-test' ? 30 : 90;
                const minutes = Math.floor(this.config.elapsedTime / 60);
                const secs = Math.floor(this.config.elapsedTime % 60);
                const totalMins = Math.floor(totalDuration / 60);
                const totalSecs = totalDuration % 60;
                const timeStr = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} / ${totalMins.toString().padStart(2, '0')}:${totalSecs.toString().padStart(2, '0')}`;
                timerElement.textContent = timeStr;
            }
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
        // Safety check: If we just finished a stress test, don't process normal events
        if (this.stressTest.enabled === false && this.stressTest.updateCycle > 0) {
            console.log('Skipping normal data updates - stress test recently completed');
            return;
        }
        
        const time = this.config.elapsedTime;
        
        // Track if any updates were made
        let updatesPerformed = false;
        
        // Process scheduled events (now includes hardcoded random mixer events from 1:00-1:30)
        this.updatePatterns.scheduledEvents.forEach(event => {
            // Check if this event should be triggered (considering a small window to ensure it's not missed)
            if (time >= event.time && time < event.time + 0.1) {
                // Identify if this is a random mixer event (between 1:00-1:30)
                const isRandomEvent = event.time >= 60 && event.time < 90 && 
                                    (event.component.startsWith('Mixer_') || event.component.includes('_AlarmComponent'));
                
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
                } else {
                    // Immediate change for events without duration (like status changes)
                    DittoAPI.updateProperty(event.component, event.property, event.value);
                }
            }
        });
        
        // Process pending events (for smooth transitions)
        if (this._pendingEvents.length > 0) {
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
    
    // Stress test configuration for performance testing
    stressTest: {
        enabled: false,
        mode: 'frequency-stepped',     // 'frequency-stepped' or 'maximum-throughput'
        duration: 30,                  // 30 seconds per frequency level
        currentPhase: 0,               // Current frequency phase index
        phaseStartTime: 0,             // When current phase started
        updateFrequencies: [1, 5, 10, 25, 50], // Hz frequencies to test
        updateInterval: 1,             // 1ms between data update checks
        lastMixerUpdate: 0,            // Timestamp of last update
        updateCycle: 0,                // Track total number of updates performed
        targetUpdatesPerSecond: 1,     // Current target frequency
        actualUpdateTimes: [],         // Track actual update timestamps for frequency analysis
        phaseResults: [],              // Store results for each frequency phase
        timeSeriesData: [],            // Store detailed time-series data every second
        lastTimeSeriesCapture: 0,      // Last time we captured time-series data
        maxUpdatesPerFrame: 1,         // Updates per frame (calculated based on frequency)
        droppedUpdates: 0,             // Track missed/dropped updates
        syncIssues: 0,                 // Track desync incidents
        timerId: null,                 // High-frequency timer ID
        timeSeriesTimerId: null,       // Time-series data collection timer ID
    },

    // Stress test camera waypoints - simple corner-to-corner loop focusing on mixers
    stressTestWaypoints: [
        { 
            position: [20, 12, 90],       // Corner 1: Front-left view of mixer room
            target: [35, 1, 75],          // Always looking at center of mixer area
            up: [0, 1, 0]
        },
        { 
            position: [50, 12, 90],       // Corner 2: Front-right view of mixer room
            target: [35, 1, 75],          // Always looking at center of mixer area
            up: [0, 1, 0]
        },
        { 
            position: [50, 12, 60],       // Corner 3: Back-right view of mixer room
            target: [35, 1, 75],          // Always looking at center of mixer area
            up: [0, 1, 0]
        },
        { 
            position: [20, 12, 60],       // Corner 4: Back-left view of mixer room
            target: [35, 1, 75],          // Always looking at center of mixer area
            up: [0, 1, 0]
        }
    ],
    
    // Reset all twin values to their defaults
    _resetTwinToDefaultValues() {
        console.log("Resetting all twin values to their original state...");
        
        // Define default values for all components
        const defaultValues = {
            // Mixers - all 26 mixers to default values
            ...Array.from({length: 26}, (_, i) => ({
                [`Mixer_${i}`]: { 'Temperature': 100, 'RPM': 60 }
            })).reduce((acc, obj) => ({...acc, ...obj}), {}),
            
            // Mixer Alarm components - all 26 to NORMAL
            ...Array.from({length: 26}, (_, i) => ({
                [`Mixer_${i}_AlarmComponent`]: { 'alarm_status': 'NORMAL' }
            })).reduce((acc, obj) => ({...acc, ...obj}), {}),
            
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
    },

    // Start stress test simulation
    startStressTest(activeInstance, mode = 'frequency-stepped') {
        if (this.config.isRunning) return;
        
        // Configure for stress test
        this.stressTest.enabled = true;
        this.stressTest.mode = mode;
        
        if (mode === 'frequency-stepped') {
            // Multi-phase frequency testing
            this.config.duration = this.stressTest.duration * this.stressTest.updateFrequencies.length;
            this.stressTest.currentPhase = 0;
            this.stressTest.targetUpdatesPerSecond = this.stressTest.updateFrequencies[0];
            this.stressTest.phaseResults = [];
            console.log('Starting frequency-stepped stress test');
            console.log('Testing frequencies:', this.stressTest.updateFrequencies, 'Hz');
            console.log('Total duration:', this.config.duration, 'seconds');
        } else {
            // Maximum throughput testing (original behavior)
            this.config.duration = this.stressTest.duration;
            this.stressTest.targetUpdatesPerSecond = 1000; // Unlimited
            this.stressTest.maxUpdatesPerFrame = 5;
            console.log('Starting maximum throughput stress test');
        }
        
        this.config.cameraPathDuration = this.config.duration;
        this.config.dataUpdateInterval = this.stressTest.updateInterval;
        
        // Replace normal waypoints with stress test waypoints
        this.originalWaypoints = [...this.waypoints];
        this.waypoints = [...this.stressTestWaypoints];
        
        // Reset stress test state
        this.stressTest.lastMixerUpdate = performance.now();
        this.stressTest.updateCycle = 0;
        this.stressTest.startTime = performance.now();
        this.stressTest.phaseStartTime = performance.now();
        this.stressTest.actualUpdateTimes = [];
        this.stressTest.droppedUpdates = 0;
        this.stressTest.syncIssues = 0;
        this.stressTest.timeSeriesData = []; // Reset time-series data for new test
        this.stressTest.lastTimeSeriesCapture = 0;
        
        console.log('Camera focused on mixer room for optimal observation of updates');
        
        // Start the simulation with stress test configuration
        this.start(activeInstance);
        
        // CRITICAL FIX: Start high-frequency timer independent of requestAnimationFrame
        if (mode === 'frequency-stepped') {
            this._startHighFrequencyTimer();
            this._startTimeSeriesCollection();
        }
    },

    // Stop stress test and restore normal simulation
    stopStressTest() {
        if (!this.stressTest.enabled) return;
        
        console.log('=== INITIATING STRESS TEST SHUTDOWN ===');
        
        // BULLETPROOF TIMER SHUTDOWN: Multiple layers of protection
        // Layer 1: Immediate flag disable to prevent new timer callbacks
        this.stressTest.enabled = false;
        this.config.isRunning = false;
        
        // Layer 2: Force-stop all timers with aggressive cleanup
        this._emergencyTimerShutdown();
        
        // Layer 3: Clear all pending state that could trigger updates
        this._pendingEvents = [];
        this.stressTest.actualUpdateTimes = [];
        
        // Layer 4: Add a delay to ensure all timer callbacks have time to check the disabled flag
        setTimeout(() => {
            // Final verification that timers are truly stopped
            if (this.stressTest.timerId !== null || this.stressTest.timeSeriesTimerId !== null) {
                console.error('CRITICAL: Timers still active after shutdown, forcing emergency stop');
                this._emergencyTimerShutdown();
            }
            console.log('Timer shutdown verification complete');
        }, 100);
        
        console.log('Multi-layer timer shutdown initiated');
        
        // Complete the final phase if in frequency-stepped mode
        if (this.stressTest.mode === 'frequency-stepped' && this.stressTest.phaseResults.length <= this.stressTest.currentPhase) {
            this._completeCurrentPhase();
        }
        
        // Calculate and log overall results
        const endTime = performance.now();
        const actualDuration = (endTime - this.stressTest.startTime) / 1000;
        
        console.log('=== STRESS TEST COMPLETE ===');
        console.log(`Total duration: ${actualDuration.toFixed(2)} seconds`);
        console.log(`Total updates sent: ${this.stressTest.updateCycle}`);
        
        if (this.stressTest.mode === 'frequency-stepped') {
            console.log('\n=== FREQUENCY ANALYSIS RESULTS ===');
            this.stressTest.phaseResults.forEach((result, index) => {
                console.log(`${result.targetFrequency}Hz: FPS=${result.fps}, Drop=${result.fpsDrop}%, Latency=${result.latency}ms, Memory=${result.memoryUsage}MB, Dropped=${result.droppedUpdates}`);
            });
            
            // Export detailed results to CSV
            this._exportStressTestResults();
        } else {
            const updatesPerSecond = this.stressTest.updateCycle / actualDuration;
            console.log(`Framework throughput: ${updatesPerSecond.toFixed(2)} updates/sec`);
        }
        
        console.log('============================');
        
        // Restore original waypoints
        if (this.originalWaypoints) {
            this.waypoints = [...this.originalWaypoints];
            this.originalWaypoints = null;
        }
        
        // Reset configuration to normal values
        this.config.duration = 90;
        this.config.cameraPathDuration = 95;
        this.config.dataUpdateInterval = 100;
        
        console.log('Stress test stopped, restored normal simulation configuration');
        
        // Re-enable camera controls
        if (this.config.activeInstance && typeof this.config.activeInstance.setCameraControlsEnabled === 'function') {
            this.config.activeInstance.setCameraControlsEnabled(true);
            this.config.cameraControlsEnabled = true;
        }
        
        // Stop metrics collection BEFORE resetting twin data
        if (MetricsCollector.stopSimulation) {
            MetricsCollector.stopSimulation();
        }
        
        // PAUSE polling temporarily during reset to prevent interference
        DittoAPI.pausePolling();
        
        // Reset all twin values to their defaults (but don't trigger further simulation)
        this._resetTwinToDefaultValues();
        
        // Resume polling after a brief delay to allow reset to complete
        setTimeout(() => {
            DittoAPI.resumePolling();
            console.log('DittoAPI polling resumed after reset');
        }, 1000);
        
        if (this.callbacks.onComplete) {
            this.callbacks.onComplete();
        }
        
        console.log('Stress test and simulation completely stopped, twin values reset to defaults');
    },

    // Export stress test results to CSV format
    _exportStressTestResults() {
        if (this.stressTest.mode !== 'frequency-stepped' || this.stressTest.phaseResults.length === 0) {
            return;
        }
        
        const framework = MetricsCollector.metrics.framework || 'unknown';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Export phase summary data
        this._exportPhaseSummaryCSV(framework, timestamp);
        
        // Export detailed time-series data
        this._exportTimeSeriesCSV(framework, timestamp);
        
        console.log('Stress test results exported: phase summary and detailed time-series data');
    },

    // Export phase summary CSV (original format for overview)
    _exportPhaseSummaryCSV(framework, timestamp) {
        const lines = [];
        
        // Header
        lines.push('=== STRESS TEST PHASE SUMMARY ===');
        lines.push(`Framework: ${framework}`);
        lines.push(`Test Date: ${timestamp}`);
        lines.push('');
        
        // Phase summary CSV data
        lines.push('Target_Frequency_Hz,Actual_Frequency_Hz,FPS,FPS_Drop_Percent,Latency_ms,Memory_MB,Dropped_Updates,Sync_Issues,Updates_Performed,Phase_Duration_s');
        
        this.stressTest.phaseResults.forEach(result => {
            lines.push(`${result.targetFrequency},${result.actualFrequency},${result.fps},${result.fpsDrop},${result.latency},${result.memoryUsage},${result.droppedUpdates},${result.syncIssues},${result.updatesPerformed},${result.duration}`);
        });
        
        // Summary statistics
        lines.push('');
        lines.push('=== SUMMARY STATISTICS ===');
        const maxStableFreq = this._calculateMaxStableFrequency();
        const avgFpsDrop = this._calculateAverageFpsDrop();
        const totalDropped = this.stressTest.phaseResults.reduce((sum, r) => sum + r.droppedUpdates, 0);
        
        lines.push(`Max_Stable_Frequency_Hz: ${maxStableFreq}`);
        lines.push(`Average_FPS_Drop_Percent: ${avgFpsDrop.toFixed(1)}`);
        lines.push(`Total_Dropped_Updates: ${totalDropped}`);
        lines.push(`Performance_Rating: ${this._calculatePerformanceRating()}`);
        
        // Download the phase summary CSV file
        const csvContent = lines.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${framework}_stress_test_summary_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // Export detailed time-series CSV for smooth graphs
    _exportTimeSeriesCSV(framework, timestamp) {
        if (this.stressTest.timeSeriesData.length === 0) {
            console.log('No time-series data to export');
            return;
        }
        
        const lines = [];
        
        // Header
        lines.push('=== STRESS TEST TIME-SERIES DATA ===');
        lines.push(`Framework: ${framework}`);
        lines.push(`Test Date: ${timestamp}`);
        lines.push(`Total Data Points: ${this.stressTest.timeSeriesData.length}`);
        lines.push('');
        
        // Time-series CSV header
        lines.push('Timestamp_ms,Test_Time_s,Phase,Phase_Elapsed_s,Target_Frequency_Hz,Actual_Frequency_Hz,Frequency_Ratio,FPS,Render_Time_ms,Memory_MB,Total_Updates,Dropped_Updates,Sync_Issues');
        
        // Calculate test start time for relative timestamps
        const testStartTime = this.stressTest.timeSeriesData[0].timestamp;
        
        // Export each data point
        this.stressTest.timeSeriesData.forEach(point => {
            const testTime = Math.round((point.timestamp - testStartTime) / 100) / 10; // Round to 0.1s
            lines.push(`${point.timestamp},${testTime},${point.phase},${point.phaseElapsed},${point.targetFrequency},${point.actualFrequency},${point.frequencyRatio.toFixed(3)},${point.fps},${point.renderTime},${point.memoryUsage},${point.updateCycle},${point.droppedUpdates},${point.syncIssues}`);
        });
        
        // Download the time-series CSV file
        const csvContent = lines.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${framework}_stress_test_timeseries_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`Time-series data exported: ${this.stressTest.timeSeriesData.length} data points`);
    },

    // Calculate maximum stable frequency (highest freq with <30% FPS drop)
    _calculateMaxStableFrequency() {
        for (let i = this.stressTest.phaseResults.length - 1; i >= 0; i--) {
            const result = this.stressTest.phaseResults[i];
            if (parseFloat(result.fpsDrop) < 30) {
                return result.targetFrequency;
            }
        }
        return this.stressTest.phaseResults[0]?.targetFrequency || 1;
    },

    // Calculate average FPS drop across all phases
    _calculateAverageFpsDrop() {
        if (this.stressTest.phaseResults.length === 0) return 0;
        const totalDrop = this.stressTest.phaseResults.reduce((sum, r) => sum + parseFloat(r.fpsDrop), 0);
        return totalDrop / this.stressTest.phaseResults.length;
    },

    // Calculate overall performance rating
    _calculatePerformanceRating() {
        const maxStable = this._calculateMaxStableFrequency();
        const avgDrop = this._calculateAverageFpsDrop();
        const totalDropped = this.stressTest.phaseResults.reduce((sum, r) => sum + r.droppedUpdates, 0);
        
        let rating = 'Poor';
        if (maxStable >= 25 && avgDrop < 25 && totalDropped < 10) {
            rating = 'Excellent';
        } else if (maxStable >= 10 && avgDrop < 40 && totalDropped < 20) {
            rating = 'Good';
        } else if (maxStable >= 5 && avgDrop < 60) {
            rating = 'Fair';
        }
        
        return rating;
    },

    // Override the data update method for stress test - supports both modes
    _updateDigitalTwinDataStressTest() {
        const now = performance.now();
        
        // Initialize lastMixerUpdate if not set
        if (!this.stressTest.lastMixerUpdate) {
            this.stressTest.lastMixerUpdate = now;
        }
        
        if (this.stressTest.mode === 'frequency-stepped') {
            // Frequency-stepped updates are now handled by high-frequency timer
            // This method is only called for maximum-throughput mode
            console.log('Note: Frequency-stepped updates handled by high-frequency timer');
        } else {
            this._handleMaximumThroughputUpdates(now);
        }
        
        // Call data update callback
        if (this.callbacks.onDataUpdate) {
            this.callbacks.onDataUpdate();
        }
    },

    // Handle frequency-stepped stress test updates
    _handleFrequencySteppedUpdates(now) {
        // BULLETPROOF: Check ALL stop conditions at the start of every method call
        if (!this.stressTest.enabled || 
            !this.config.isRunning || 
            this.stressTest.mode !== 'frequency-stepped' ||
            this.stressTest.timerId === null ||
            this.stressTest.timerId === undefined) {
            console.log('_handleFrequencySteppedUpdates: ABORT - stop condition detected');
            return;
        }
        
        const phaseElapsed = (now - this.stressTest.phaseStartTime) / 1000;
        
        // Check if we need to advance to the next phase
        if (phaseElapsed >= this.stressTest.duration) {
            this._completeCurrentPhase();
            
            // Move to next phase or complete test
            this.stressTest.currentPhase++;
            if (this.stressTest.currentPhase >= this.stressTest.updateFrequencies.length) {
                this.stopStressTest();
                return;
            }
            
            this._startNextPhase();
            return;
        }
        
        // FIXED: Use high-precision timing with no dependency on animation frames
        const targetInterval = 1000 / this.stressTest.targetUpdatesPerSecond; // ms between updates
        const timeSinceLastUpdate = now - this.stressTest.lastMixerUpdate;
        
        // Send multiple updates if we're behind schedule to catch up
        const updatesDue = Math.floor(timeSinceLastUpdate / targetInterval);
        
        if (updatesDue >= 1) {
            // Send up to 5 updates per call to catch up, but don't overwhelm
            const updatesToSend = Math.min(updatesDue, 5);
            
            for (let i = 0; i < updatesToSend; i++) {
                // Double-check that stress test is still enabled before each update
                if (!this.stressTest.enabled) {
                    return;
                }
                
                this._performSingleRandomUpdate();
                
                // Track actual update time for frequency analysis
                this.stressTest.actualUpdateTimes.push(now);
                this.stressTest.updateCycle++;
            }
            
            this.stressTest.lastMixerUpdate = now;
            
            // Update visualization after batch of updates
            this._updateVisualizationFromLatestState();
        }
    },

    // Handle maximum throughput stress test updates (original behavior)
    _handleMaximumThroughputUpdates(now) {
        // Send multiple updates per frame for maximum stress
        for (let i = 0; i < this.stressTest.maxUpdatesPerFrame; i++) {
            this._performSingleRandomUpdate();
            this.stressTest.updateCycle++;
        }
        
        this.stressTest.lastMixerUpdate = now;
        
        // Update visualization immediately after batch of updates
        this._updateVisualizationFromLatestState();
    },

    // Perform a single random mixer update
    _performSingleRandomUpdate() {
        // Safety check: ensure stress test is still enabled
        if (!this.stressTest.enabled) {
            return;
        }
        
        // Pick a completely random mixer (0-25)
        const randomMixerIndex = Math.floor(Math.random() * 26);
        const mixerComponent = `Mixer_${randomMixerIndex}`;
        const alarmComponent = `${mixerComponent}_AlarmComponent`;
        
        // Pick a random property to update (40% RPM, 40% Temperature, 20% Alarm Status)
        const randomProperty = Math.random();
        
        try {
            if (randomProperty < 0.4) {
                // Update RPM with completely random value
                const randomRpm = Math.floor(Math.random() * 121); // 0-120
                DittoAPI.updateProperty(mixerComponent, 'RPM', randomRpm);
                
            } else if (randomProperty < 0.8) {
                // Update Temperature with random value
                const randomTemp = Math.floor(Math.random() * 161) + 20; // 20-180
                DittoAPI.updateProperty(mixerComponent, 'Temperature', randomTemp);
                
            } else {
                // Update Alarm Status with random value
                const statusOptions = ['NORMAL', 'ACTIVE', 'ACKNOWLEDGED'];
                const randomStatus = statusOptions[Math.floor(Math.random() * statusOptions.length)];
                DittoAPI.updateProperty(alarmComponent, 'alarm_status', randomStatus);
            }
        } catch (error) {
            // Count dropped updates if API call fails
            this.stressTest.droppedUpdates++;
            console.warn('Update failed, counted as dropped update:', error);
        }
    },

    // Complete current frequency phase and collect metrics
    _completeCurrentPhase() {
        // BULLETPROOF: Check if stress test is still enabled before doing ANY phase completion work
        if (!this.stressTest.enabled || !this.config.isRunning) {
            console.log('Phase completion aborted - stress test already stopped');
            return;
        }
        
        const currentFreq = this.stressTest.updateFrequencies[this.stressTest.currentPhase];
        const phaseEnd = performance.now();
        const phaseDuration = (phaseEnd - this.stressTest.phaseStartTime) / 1000;
        
        // Calculate actual update frequency achieved
        const updatesInPhase = this.stressTest.actualUpdateTimes.length;
        const actualFrequency = updatesInPhase / phaseDuration;
        
        // Calculate FPS metrics during this phase
        const currentFPS = MetricsCollector.getAverageFPS();
        const baselineFPS = this.stressTest.phaseResults.length === 0 ? currentFPS : this.stressTest.phaseResults[0].fps;
        const fpsDrop = ((baselineFPS - currentFPS) / baselineFPS) * 100;
        
        // Calculate average latency during this phase
        const avgLatency = MetricsCollector.getAverageLatency();
        
        // Calculate memory usage
        const memoryUsage = MetricsCollector.getAverageMemory();
        
        // Store phase results
        const phaseResult = {
            targetFrequency: currentFreq,
            actualFrequency: actualFrequency.toFixed(2),
            fps: currentFPS,
            fpsDrop: fpsDrop.toFixed(1),
            latency: avgLatency,
            memoryUsage: memoryUsage,
            droppedUpdates: this.stressTest.droppedUpdates,
            syncIssues: this.stressTest.syncIssues,
            updatesPerformed: updatesInPhase,
            duration: phaseDuration.toFixed(2)
        };
        
        this.stressTest.phaseResults.push(phaseResult);
        
        console.log(`=== PHASE ${this.stressTest.currentPhase + 1} COMPLETE (${currentFreq}Hz) ===`);
        console.log(`Target: ${currentFreq}Hz, Actual: ${actualFrequency.toFixed(2)}Hz`);
        console.log(`FPS: ${currentFPS}, Drop: ${fpsDrop.toFixed(1)}%`);
        console.log(`Latency: ${avgLatency}ms, Memory: ${memoryUsage}MB`);
        console.log(`Dropped: ${this.stressTest.droppedUpdates}, Updates: ${updatesInPhase}`);
        console.log('================================================');
        
        // Reset phase-specific counters
        this.stressTest.actualUpdateTimes = [];
        this.stressTest.droppedUpdates = 0;
        this.stressTest.syncIssues = 0;
    },

    // Start high-frequency timer for precise update timing (independent of render loop)
    _startHighFrequencyTimer() {
        // Ensure any existing timer is stopped first
        this._stopHighFrequencyTimer();
        
        // Use setInterval with 1ms precision for maximum update frequency
        this.stressTest.timerId = setInterval(() => {
            // BULLETPROOF: Triple-check ALL stop conditions to prevent ANY execution after stop
            if (!this.stressTest.enabled || 
                this.stressTest.mode !== 'frequency-stepped' || 
                this.stressTest.timerId === null || 
                this.stressTest.timerId === undefined ||
                !this.config.isRunning) {
                
                console.log('Timer callback detected stop condition - IMMEDIATE ABORT');
                
                // Self-destruct: Clear this interval immediately
                if (this.stressTest.timerId) {
                    clearInterval(this.stressTest.timerId);
                    this.stressTest.timerId = null;
                }
                return; // CRITICAL: Exit immediately, no further processing
            }
            
            // Additional safety: Verify stress test is still in correct state
            if (this.stressTest.mode !== 'frequency-stepped') {
                console.log('Timer callback detected mode change - ABORTING');
                clearInterval(this.stressTest.timerId);
                this.stressTest.timerId = null;
                return;
            }
            
            const now = performance.now();
            this._handleFrequencySteppedUpdates(now);
        }, 1); // Check every 1ms for maximum precision
        
        console.log('High-frequency timer started for precise update control');
    },

    // Stop high-frequency timer
    _stopHighFrequencyTimer() {
        if (this.stressTest.timerId) {
            console.log(`Stopping high frequency timer: ${this.stressTest.timerId}`);
            clearInterval(this.stressTest.timerId);
            this.stressTest.timerId = null;
            console.log('High-frequency timer stopped');
        }
        
        // Also forcefully disable the timer flag to prevent any race conditions
        if (this.stressTest.timerId !== null) {
            console.warn('Timer ID was not properly cleared, forcing to null');
            this.stressTest.timerId = null;
        }
    },

    // BULLETPROOF EMERGENCY TIMER SHUTDOWN
    _emergencyTimerShutdown() {
        console.log('=== EMERGENCY TIMER SHUTDOWN ===');
        
        // Force clear high frequency timer with multiple safety checks
        if (this.stressTest.timerId !== null && this.stressTest.timerId !== undefined) {
            console.log(`Force clearing high frequency timer: ${this.stressTest.timerId}`);
            clearInterval(this.stressTest.timerId);
            this.stressTest.timerId = null;
        }
        
        // Force clear time series timer with multiple safety checks
        if (this.stressTest.timeSeriesTimerId !== null && this.stressTest.timeSeriesTimerId !== undefined) {
            console.log(`Force clearing time series timer: ${this.stressTest.timeSeriesTimerId}`);
            clearInterval(this.stressTest.timeSeriesTimerId);
            this.stressTest.timeSeriesTimerId = null;
        }
        
        // Nuclear option: Clear ALL intervals on the page (last resort for persistent timers)
        for (let i = 1; i < 10000; i++) {
            clearInterval(i);
        }
        
        console.log('Emergency timer shutdown complete - ALL intervals cleared');
    },

    // Start the next frequency phase
    _startNextPhase() {
        this.stressTest.targetUpdatesPerSecond = this.stressTest.updateFrequencies[this.stressTest.currentPhase];
        this.stressTest.phaseStartTime = performance.now();
        
        console.log(`Starting Phase ${this.stressTest.currentPhase + 1}: ${this.stressTest.targetUpdatesPerSecond}Hz`);
    },

    // Override camera update for stress test to use simple corner-to-corner movement
    _updateCameraPositionStressTest() {
        if (!this.config.activeInstance || !this.config.activeInstance.setCameraPosition) {
            return;
        }
        
        // Simple repeating corner-to-corner movement throughout the entire 2.5 minutes
        // Each complete cycle takes 30 seconds (7.5 seconds per corner)
        const cycleTime = 30; // seconds for one complete cycle
        const pathTime = (this.config.elapsedTime % cycleTime) / cycleTime;
        
        const waypointCount = this.stressTestWaypoints.length;
        const totalProgress = pathTime * waypointCount;
        const currentIndex = Math.floor(totalProgress);
        const nextIndex = (currentIndex + 1) % waypointCount;
        const segmentProgress = totalProgress - currentIndex;
        
        const current = this.stressTestWaypoints[currentIndex];
        const next = this.stressTestWaypoints[nextIndex];
        
        // Smooth interpolation between waypoints
        const position = this._interpolateVector(current.position, next.position, segmentProgress);
        const target = this._interpolateVector(current.target, next.target, segmentProgress);
        const up = this._interpolateVector(current.up, next.up, segmentProgress);
        
        this.config.activeInstance.setCameraPosition(position, target, up);
    },

    // Start time-series data collection for detailed performance tracking
    _startTimeSeriesCollection() {
        // Ensure any existing timer is stopped first
        this._stopTimeSeriesCollection();
        
        // Start timer to capture data every second (1000ms)
        this.stressTest.timeSeriesTimerId = setInterval(() => {
            // BULLETPROOF: Check ALL possible stop conditions
            if (!this.stressTest.enabled || 
                this.stressTest.timeSeriesTimerId === null || 
                this.stressTest.timeSeriesTimerId === undefined ||
                !this.config.isRunning ||
                this.stressTest.mode !== 'frequency-stepped') {
                
                console.log('Time-series callback: ABORT - stop condition detected');
                
                // Self-destruct: Clear this interval immediately
                if (this.stressTest.timeSeriesTimerId) {
                    clearInterval(this.stressTest.timeSeriesTimerId);
                    this.stressTest.timeSeriesTimerId = null;
                }
                return; // CRITICAL: Exit immediately
            }
            
            this._captureTimeSeriesDataPoint();
        }, 1000); // Capture every 1 second
        
        this.stressTest.lastTimeSeriesCapture = performance.now();
        console.log('Time-series data collection started (1-second intervals)');
    },

    // Stop time-series data collection
    _stopTimeSeriesCollection() {
        if (this.stressTest.timeSeriesTimerId !== null && this.stressTest.timeSeriesTimerId !== undefined) {
            console.log(`Stopping time series timer: ${this.stressTest.timeSeriesTimerId}`);
            clearInterval(this.stressTest.timeSeriesTimerId);
            this.stressTest.timeSeriesTimerId = null;
            console.log('Time-series data collection stopped');
        }
        
        // Force clear the ID if it wasn't properly cleared
        if (this.stressTest.timeSeriesTimerId !== null) {
            console.warn('Time-series timer ID was not properly cleared, forcing to null');
            this.stressTest.timeSeriesTimerId = null;
        }
    },

    // Capture a single time-series data point
    _captureTimeSeriesDataPoint() {
        // CRITICAL SAFETY CHECK: Don't capture data if stress test is disabled
        if (!this.stressTest.enabled || !this.config.isRunning) {
            console.log('Skipping time-series data capture - stress test disabled');
            return;
        }
        
        const now = performance.now();
        const currentPhase = this.stressTest.currentPhase;
        const targetFreq = this.stressTest.updateFrequencies[currentPhase] || 1;
        
        // Calculate phase elapsed time
        const phaseElapsed = (now - this.stressTest.phaseStartTime) / 1000;
        
        // Calculate actual frequency over the last second
        const actualFreq = this.stressTest.actualUpdateTimes.filter(
            time => time > now - 1000
        ).length;
        
        // Get current performance metrics
        const fps = MetricsCollector.getAverageFPS ? MetricsCollector.getAverageFPS() : 0;
        const memoryUsage = MetricsCollector.getAverageMemory ? MetricsCollector.getAverageMemory() : 0;
        const renderTime = MetricsCollector.getAverageLatency ? MetricsCollector.getAverageLatency() : 0;
        
        // Create time-series data point
        const dataPoint = {
            timestamp: now,
            phase: currentPhase + 1,
            phaseElapsed: Math.round(phaseElapsed * 10) / 10, // Round to 1 decimal
            targetFrequency: targetFreq,
            actualFrequency: Math.round(actualFreq * 10) / 10,
            frequencyRatio: targetFreq > 0 ? actualFreq / targetFreq : 0,
            fps: Math.round(fps * 10) / 10,
            renderTime: Math.round(renderTime * 100) / 100,
            memoryUsage: Math.round(memoryUsage * 100) / 100,
            updateCycle: this.stressTest.updateCycle,
            droppedUpdates: this.stressTest.droppedUpdates,
            syncIssues: this.stressTest.syncIssues
        };
        
        this.stressTest.timeSeriesData.push(dataPoint);
        this.stressTest.lastTimeSeriesCapture = now;
        
        // Log progress occasionally
        if (this.stressTest.timeSeriesData.length % 10 === 0) {
            console.log(`Time-series: ${this.stressTest.timeSeriesData.length} data points collected`);
        }
    },
};

// Export the simulation object to make it accessible globally
window.Simulation = Simulation;