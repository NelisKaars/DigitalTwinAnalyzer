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
            { time: 87, component: 'Mixer_20', property: 'RPM', value: 10, duration: 1 },
            { time: 87.5, component: 'Mixer_14_AlarmComponent', property: 'alarm_status', value: 'ACTIVE', duration: 0 },
            
            // 1:28
            { time: 88, component: 'Mixer_4', property: 'RPM', value: 65, duration: 1 },
            { time: 88, component: 'Mixer_10', property: 'Temperature', value: 35, duration: 1 },
            { time: 88, component: 'Mixer_16', property: 'RPM', value: 100, duration: 1 },
            { time: 88, component: 'Mixer_23', property: 'Temperature', value: 120, duration: 1 },
            
            // 1:29
            { time: 89, component: 'Mixer_6', property: 'Temperature', value: 165, duration: 1 },
            { time: 89, component: 'Mixer_13', property: 'RPM', value: 15, duration: 1 },
            { time: 89, component: 'Mixer_17', property: 'Temperature', value: 50, duration: 1 },
            { time: 89, component: 'Mixer_21', property: 'RPM', value: 110, duration: 1 },
            { time: 89, component: 'Mixer_24', property: 'Temperature', value: 95, duration: 1 },
            { time: 89.5, component: 'Mixer_6_AlarmComponent', property: 'alarm_status', value: 'ACKNOWLEDGED', duration: 0 }
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
            if (this.stressTest.enabled) {
                this._updateDigitalTwinDataStressTest();
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
                
                if (isRandomEvent) {
                    console.log(`🎲 RANDOM MIXER EVENT at ${time.toFixed(1)}s: ${event.component}.${event.property} = ${event.value}`);
                } else {
                    console.log(`Triggering scheduled event at ${time.toFixed(1)}s: ${event.component}.${event.property} = ${event.value}`);
                }
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
    
    // Stress test configuration for performance testing
    stressTest: {
        enabled: false,
        duration: 30,                  // 30 seconds stress test
        updateInterval: 5,             // 5ms between updates (much more intensive)
        mixerUpdateDelay: 5,           // 5ms delay between each mixer property update
        currentMixerIndex: 0,          // Track which mixer to update next
        currentPropertyIndex: 0,       // Track which property to update next (RPM, Temperature, Alarm)
        lastUpdate: 0,                 // Timestamp of last update
        updateCycle: 0,                // Track update cycles
        maxRpmVariation: 100,          // Maximum RPM variation for stress test
        baseRpm: 60,                   // Base RPM value
        propertyCycle: ['RPM', 'Temperature', 'alarm_status'], // Properties to cycle through
    },

    // Stress test camera waypoints - focused on mixer room corners
    stressTestWaypoints: [
        { 
            position: [5, 15, 90],       // High corner view of mixer room - corner 1 (mixers 0-6)
            target: [15, 0, 75],
            up: [0, 1, 0]
        },
        { 
            position: [35, 15, 90],      // High corner view of mixer room - corner 2 (mixers 7-13)
            target: [25, 0, 75],
            up: [0, 1, 0]
        },
        { 
            position: [35, 15, 60],      // High corner view of mixer room - corner 3 (mixers 14-19)
            target: [25, 0, 75],
            up: [0, 1, 0]
        },
        { 
            position: [5, 15, 60],       // High corner view of mixer room - corner 4 (mixers 20-25)
            target: [15, 0, 75],
            up: [0, 1, 0]
        },
        { 
            position: [20, 25, 75],      // High overhead center view (all mixers)
            target: [20, 0, 75],
            up: [0, 1, 0]
        },
        { 
            position: [10, 8, 85],       // Low angle view - front half
            target: [30, 3, 65],
            up: [0, 1, 0]
        },
        { 
            position: [30, 8, 65],       // Low angle view - back half
            target: [10, 3, 85],
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
    startStressTest(activeInstance) {
        if (this.config.isRunning) return;
        
        // Configure for stress test
        this.stressTest.enabled = true;
        this.config.duration = this.stressTest.duration;
        this.config.cameraPathDuration = this.stressTest.duration;
        this.config.dataUpdateInterval = this.stressTest.updateInterval;
        
        // Replace normal waypoints with stress test waypoints
        this.originalWaypoints = [...this.waypoints];
        this.waypoints = [...this.stressTestWaypoints];
        
        // Reset stress test state
        this.stressTest.currentMixerIndex = 0;
        this.stressTest.lastMixerUpdate = 0;
        this.stressTest.updateCycle = 0;
        
        console.log('Starting stress test - rapid mixer updates for', this.stressTest.duration, 'seconds');
        console.log('Camera focused on mixer room, updating all 26 mixers every', this.stressTest.mixerUpdateDelay * 26, 'ms');
        
        // Start the simulation with stress test configuration
        this.start(activeInstance);
    },

    // Stop stress test and restore normal simulation
    stopStressTest() {
        if (!this.stressTest.enabled) return;
        
        this.stressTest.enabled = false;
        
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
        
        // Call normal stop method
        this.stop();
    },

    // Override the data update method for stress test
    _updateDigitalTwinDataStressTest() {
        const now = performance.now();
        
        // Check if it's time to update the next mixer
        if (now - this.stressTest.lastMixerUpdate >= this.stressTest.mixerUpdateDelay) {
            const mixerIndex = this.stressTest.currentMixerIndex;
            const mixerComponent = `Mixer_${mixerIndex}`;
            
            // Generate varying RPM values for visual impact
            const baseRpm = this.stressTest.baseRpm;
            const variation = this.stressTest.maxRpmVariation;
            const cycleOffset = (this.stressTest.updateCycle + mixerIndex) * 0.1;
            
            // Create oscillating RPM pattern with different phases for each mixer
            const rpmValue = Math.round(baseRpm + 
                Math.sin(this.config.elapsedTime * 2 + cycleOffset) * variation * 0.5 +
                Math.cos(this.config.elapsedTime * 1.5 + mixerIndex * 0.3) * variation * 0.3);
            
            // Ensure RPM is within reasonable bounds
            const clampedRpm = Math.max(0, Math.min(120, rpmValue));
            
            // Generate varying temperature values
            const tempVariation = 50;
            const tempValue = Math.round(100 + 
                Math.sin(this.config.elapsedTime * 1.8 + mixerIndex * 0.4) * tempVariation * 0.4 +
                Math.cos(this.config.elapsedTime * 2.2 + cycleOffset) * tempVariation * 0.2);
            
            const clampedTemp = Math.max(20, Math.min(180, tempValue));
            
            // Update the mixer
            DittoAPI.updateProperty(mixerComponent, 'RPM', clampedRpm);
            DittoAPI.updateProperty(mixerComponent, 'Temperature', clampedTemp);
            
            // Log every 5th mixer update to avoid spam
            if (mixerIndex % 5 === 0) {
                console.log(`Stress test: Updated ${mixerComponent} - RPM: ${clampedRpm}, Temp: ${clampedTemp}`);
            }
            
            // Move to next mixer
            this.stressTest.currentMixerIndex = (this.stressTest.currentMixerIndex + 1) % 26;
            this.stressTest.lastMixerUpdate = now;
            
            // If we've completed a full cycle through all mixers
            if (this.stressTest.currentMixerIndex === 0) {
                this.stressTest.updateCycle++;
                console.log(`Stress test: Completed update cycle ${this.stressTest.updateCycle}`);
                
                // Update visualization after each complete cycle
                this._updateVisualizationFromLatestState();
            }
        }
        
        // Call data update callback
        if (this.callbacks.onDataUpdate) {
            this.callbacks.onDataUpdate();
        }
    },

    // Override camera update for stress test to use mixer room waypoints
    _updateCameraPositionStressTest() {
        if (!this.config.activeInstance || !this.config.activeInstance.setCameraPosition) {
            return;
        }
        
        // Use stress test waypoints with slower transitions for better observation
        const pathTime = (this.config.elapsedTime % this.config.cameraPathDuration) / this.config.cameraPathDuration;
        
        const waypointCount = this.stressTestWaypoints.length;
        const totalProgress = pathTime * waypointCount;
        const currentIndex = Math.floor(totalProgress);
        const nextIndex = (currentIndex + 1) % waypointCount;
        const segmentProgress = totalProgress - currentIndex;
        
        const current = this.stressTestWaypoints[currentIndex];
        const next = this.stressTestWaypoints[nextIndex];
        
        const position = this._interpolateVector(current.position, next.position, segmentProgress);
        const target = this._interpolateVector(current.target, next.target, segmentProgress);
        const up = this._interpolateVector(current.up, next.up, segmentProgress);
        
        this.config.activeInstance.setCameraPosition(position, target, up);
    },
};

// Export the simulation object to make it accessible globally
window.Simulation = Simulation;