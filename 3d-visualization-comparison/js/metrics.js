/**
 * metrics.js - Performance metrics collection for visualization frameworks
 * Tracks FPS, memory usage, load times, and data binding latency.
 */

const MetricsCollector = {
    // Metrics storage
    metrics: {
        fps: [],
        memory: [],
        loadTime: 0,
        latency: [],
        updateAccuracy: {
            expectedUpdates: 0,      // Total updates that should have occurred
            receivedUpdates: 0,      // Updates that were successfully processed
            missedUpdates: 0,        // Updates that failed or were dropped
            pendingUpdates: {},      // Track pending updates by component+property
            updateTimeouts: {}       // Track update timeout handlers
        }
    },
    
    // Configuration
    config: {
        sampleSize: 60, // Number of samples to keep for averaging
        frameTimeHistory: [], // Store frame times for FPS calculation
        lastFrameTime: 0, // Last frame timestamp
        lastMemoryCheck: 0, // Last memory check timestamp
        memoryCheckInterval: 1000, // Check memory every second
        isRunning: false // Whether metrics collection is active
    },
    
    // Start metrics collection
    start(framework) {
        this.reset();
        this.config.isRunning = true;
        this.metrics.framework = framework;
        this.metrics.startTime = performance.now();
        this.initMemoryTracking();
        
        // Request first animation frame for FPS tracking
        this.config.lastFrameTime = performance.now();
        requestAnimationFrame(this.trackFrame.bind(this));
        
        console.log(`Started metrics collection for ${framework}`);
    },
    
    // Stop metrics collection
    stop() {
        this.config.isRunning = false;
        this.metrics.endTime = performance.now();
        this.metrics.totalRunTime = this.metrics.endTime - this.metrics.startTime;
        console.log('Stopped metrics collection');
    },
    
    // Reset all metrics
    reset() {
        this.stop();
        
        // Stop any ongoing time-series collection
        this.stopTimeSeriesCollection();
        
        this.metrics = {
            fps: [],
            memory: [],
            loadTime: 0,
            latency: [],
            updateAccuracy: {
                expectedUpdates: 0,
                receivedUpdates: 0,
                missedUpdates: 0,
                pendingUpdates: {},
                updateTimeouts: {}
            }
        };
        
        // Reset user interaction latency tracking
        this.userInteractionLatency = {
            pendingInteractions: {},
            completedLatencies: [],
            timeouts: {}
        };
        
        // Reset simulation metrics
        this.simulationMetrics = {
            fps: [],
            memory: [],
            latency: [],
            userInteractionLatencies: [],
            startTime: 0,
            endTime: 0,
            finalUpdateAccuracy: 100,
            timeSeries: [],
            updateAccuracy: {
                expectedUpdates: 0,
                receivedUpdates: 0,
                missedUpdates: 0
            }
        };
        
        this.config.frameTimeHistory = [];
        this.config.lastFrameTime = 0;
        this.config.lastMemoryCheck = 0;
        
        // Clear DOM display values
        this.updateDOMMetric('fps', 0);
        this.updateDOMMetric('memory', '0 MB');
        this.updateDOMMetric('load-time', '0 ms');
        this.updateDOMMetric('latency', '0 ms');
        this.updateDOMMetric('user-latency', '0 ms');
        this.updateDOMMetric('update-accuracy', '100%');
        
        console.log('All metrics reset for framework switch');
    },
    
    // Record model load time
    recordLoadTime(loadTime) {
        this.metrics.loadTime = loadTime;
        this.updateDOMMetric('load-time', `${Math.round(loadTime)} ms`);
    },
    
    // Record data binding latency
    recordLatency(latencyMs) {
        this.metrics.latency.push(latencyMs);
        
        // Store simulation latency if simulation is running
        if (this.simulationMetrics && this.simulationMetrics.startTime > 0 && this.simulationMetrics.endTime === 0) {
            this.simulationMetrics.latency.push(latencyMs);
        }
        
        // Trim the array if it exceeds the sample size
        if (this.metrics.latency.length > this.config.sampleSize) {
            this.metrics.latency.shift();
        }
        
        // Calculate average latency
        const avgLatency = this.metrics.latency.reduce((sum, val) => sum + val, 0) / 
                          this.metrics.latency.length;
        
        this.updateDOMMetric('latency', `${Math.round(avgLatency)} ms`);
    },
    
    // Track frame for FPS calculation
    trackFrame(timestamp) {
        if (!this.config.isRunning) return;
        
        const frameTime = timestamp - this.config.lastFrameTime;
        this.config.lastFrameTime = timestamp;
        
        // Add to history
        this.config.frameTimeHistory.push(frameTime);
        
        // Limit history size
        if (this.config.frameTimeHistory.length > this.config.sampleSize) {
            this.config.frameTimeHistory.shift();
        }
        
        // Calculate FPS from average frame time
        const avgFrameTime = this.config.frameTimeHistory.reduce((sum, time) => sum + time, 0) / 
                           this.config.frameTimeHistory.length;
        
        const currentFPS = 1000 / avgFrameTime;
        this.metrics.fps.push(currentFPS);
        
        // Limit FPS history size
        if (this.metrics.fps.length > this.config.sampleSize) {
            this.metrics.fps.shift();
        }
         // Update DOM
        this.updateDOMMetric('fps', Math.round(currentFPS));

        // Store simulation FPS if simulation is running
        if (this.simulationMetrics && this.simulationMetrics.startTime > 0 && this.simulationMetrics.endTime === 0) {
            this.simulationMetrics.fps.push(currentFPS);
        }

        // Check memory if interval has passed
        const now = performance.now();
        if (now - this.config.lastMemoryCheck > this.config.memoryCheckInterval) {
            this.checkMemoryUsage();
            this.config.lastMemoryCheck = now;
        }
        
        // Request next frame
        requestAnimationFrame(this.trackFrame.bind(this));
    },
    
    // Initialize memory tracking if performance.memory is available
    initMemoryTracking() {
        if (window.performance && window.performance.memory) {
            console.log('Memory API available, tracking enabled');
        } else {
            console.log('Memory API not available, tracking disabled');
        }
    },
    
    // Check current memory usage
    checkMemoryUsage() {
        if (window.performance && window.performance.memory) {
            const memory = window.performance.memory;
            const usedHeapMB = Math.round(memory.usedJSHeapSize / (1024 * 1024));
             this.metrics.memory.push(usedHeapMB);
            
            // Store simulation memory if simulation is running
            if (this.simulationMetrics && this.simulationMetrics.startTime > 0 && this.simulationMetrics.endTime === 0) {
                this.simulationMetrics.memory.push(usedHeapMB);
            }

            // Limit memory history size
            if (this.metrics.memory.length > this.config.sampleSize) {
                this.metrics.memory.shift();
            }

            this.updateDOMMetric('memory', `${usedHeapMB} MB`);
        }
    },
    
    // Update a metric value in the DOM
    updateDOMMetric(metricId, value) {
        const element = document.getElementById(`metric-${metricId}`);
        if (element) {
            element.textContent = value;
        }
    },
    
    // Export metrics to CSV format
    exportToCSV() {
        const lines = [];
        
        // Header for summary metrics
        lines.push('=== SUMMARY METRICS ===');
        lines.push('Framework,Timestamp,FPS,Memory(MB),LoadTime(ms),LatencyAvg(ms),UserInteractionLatency(ms),UpdateAccuracy(%),ExpectedUpdates,ReceivedUpdates,MissedUpdates');
        
        const timestamp = new Date().toISOString();
        const avgFPS = this.getAverageFPS();
        const avgMemory = this.getAverageMemory();
        const avgLatency = this.getAverageLatency();
        const avgUserLatency = this.getAverageUserInteractionLatency();
        const accuracyStats = this.getUpdateAccuracyStats();
        
        lines.push(`${this.metrics.framework},${timestamp},${avgFPS},${avgMemory},${this.metrics.loadTime},${avgLatency},${Math.round(avgUserLatency)},${accuracyStats.accuracyPercentage},${accuracyStats.expectedUpdates},${accuracyStats.receivedUpdates},${accuracyStats.missedUpdates}`);
        
        // Add simulation summary if available
        if (this.simulationMetrics.startTime > 0) {
            lines.push('');
            lines.push('=== SIMULATION SUMMARY ===');
            lines.push('SimulationFPS,SimulationMemory(MB),SimulationLatency(ms),SimulationUserLatency(ms),SimulationUpdateAccuracy(%),SimulationDuration(s)');
            const simDuration = this.simulationMetrics.endTime > 0 ? 
                (this.simulationMetrics.endTime - this.simulationMetrics.startTime) / 1000 : 0;
            lines.push(`${this.getSimulationAverageFPS()},${this.getSimulationAverageMemory()},${this.getSimulationAverageLatency()},${this.getSimulationAverageUserInteractionLatency()},${this.getSimulationUpdateAccuracy()},${simDuration.toFixed(1)}`);
        }
        
        // Add time-series data if available
        if (this.simulationMetrics.timeSeries && this.simulationMetrics.timeSeries.length > 0) {
            lines.push('');
            lines.push('=== TIME-SERIES DATA ===');
            lines.push('ElapsedTime(s),FPS,Memory(MB),Latency(ms)');
            
            this.simulationMetrics.timeSeries.forEach(dataPoint => {
                lines.push(`${dataPoint.timestamp.toFixed(1)},${dataPoint.fps},${dataPoint.memory},${dataPoint.latency}`);
            });
        }
        
        return lines.join('\n');
    },
    
    // Get average FPS
    getAverageFPS() {
        if (this.metrics.fps.length === 0) return 0;
        return Math.round(this.metrics.fps.reduce((sum, val) => sum + val, 0) / this.metrics.fps.length);
    },
    
    // Get average memory usage
    getAverageMemory() {
        if (this.metrics.memory.length === 0) return 0;
        return Math.round(this.metrics.memory.reduce((sum, val) => sum + val, 0) / this.metrics.memory.length);
    },
    
    // Get average latency
    getAverageLatency() {
        if (this.metrics.latency.length === 0) return 0;
        return Math.round(this.metrics.latency.reduce((sum, val) => sum + val, 0) / this.metrics.latency.length);
    },
    
    // Download metrics as CSV
    downloadCSV() {
        const csv = this.exportToCSV();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${this.metrics.framework}_metrics_${new Date().toISOString()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },
    
    // Download simulation metrics as CSV
    downloadSimulationCSV() {
        
        // Check if we have ANY simulation data to export
        const hasSimulationData = this.simulationMetrics.startTime > 0 || 
                                 (this.simulationMetrics.timeSeries && this.simulationMetrics.timeSeries.length > 0) ||
                                 (this.simulationMetrics.fps && this.simulationMetrics.fps.length > 0);
        
        if (!hasSimulationData) {
            // Fallback: export regular metrics with a note that no simulation was run
            console.log('No simulation data found, exporting general metrics instead');
            alert('No simulation data available. Downloading general metrics instead. Run a simulation for simulation-specific data.');
            this.downloadCSV();
            return;
        }
        
        const csv = this.exportSimulationToCSV();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${this.metrics.framework}_simulation_metrics_${new Date().toISOString()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // Export simulation metrics to CSV format
    exportSimulationToCSV() {
        const lines = [];
        
        // Header for simulation summary
        lines.push('=== SIMULATION METRICS ===');
        lines.push('Framework,SimulationDate,Duration(s),AvgFPS,AvgMemory(MB),AvgLatency(ms),AvgUserInteractionLatency(ms),UpdateAccuracy(%),ExpectedUpdates,ReceivedUpdates,MissedUpdates');
        
        const timestamp = new Date().toISOString();
        const simDuration = this.simulationMetrics.endTime > 0 ? 
            (this.simulationMetrics.endTime - this.simulationMetrics.startTime) / 1000 : 0;
        const simAccuracy = this.getSimulationUpdateAccuracy();
        
        lines.push(`${this.metrics.framework},${timestamp},${simDuration.toFixed(1)},${this.getSimulationAverageFPS()},${this.getSimulationAverageMemory()},${this.getSimulationAverageLatency()},${this.getSimulationAverageUserInteractionLatency()},${simAccuracy},${this.simulationMetrics.updateAccuracy.expectedUpdates},${this.simulationMetrics.updateAccuracy.receivedUpdates},${this.simulationMetrics.updateAccuracy.missedUpdates}`);
        
        // Add time-series data if available
        if (this.simulationMetrics.timeSeries && this.simulationMetrics.timeSeries.length > 0) {
            lines.push('');
            lines.push('=== SIMULATION TIME-SERIES DATA ===');
            lines.push('Timestamp,FPS,Memory (MB),Data Binding Latency (ms)');
            
            this.simulationMetrics.timeSeries.forEach(dataPoint => {
                lines.push(`${dataPoint.timestamp.toFixed(1)},${dataPoint.fps},${dataPoint.memory},${dataPoint.latency}`);
            });
        }
        
        // Add user interaction data if available
        if (this.simulationMetrics.userInteractionLatency && this.simulationMetrics.userInteractionLatency.length > 0) {
            lines.push('');
            lines.push('=== SIMULATION USER INTERACTION DATA ===');
            lines.push('InteractionType,Latency(ms),Timestamp');
            
            this.simulationMetrics.userInteractionLatency.forEach(interaction => {
                lines.push(`${interaction.type || 'unknown'},${interaction.latency},${interaction.timestamp}`);
            });
        }
        
        return lines.join('\n');
    },

    // Record an expected update (before sending to API)
    recordExpectedUpdate(component, property, value, timeout = 5000) {
        if (!this.config.isRunning) return;
        
        const updateKey = `${component}.${property}`;
        const updateId = `${updateKey}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.metrics.updateAccuracy.expectedUpdates++;
        
        // Also track in simulation if simulation is running
        if (this.simulationMetrics && this.simulationMetrics.startTime > 0 && this.simulationMetrics.endTime === 0) {
            this.simulationMetrics.updateAccuracy.expectedUpdates++;
        }
        
        // Store pending update with expected value
        this.metrics.updateAccuracy.pendingUpdates[updateId] = {
            component,
            property,
            expectedValue: value,
            timestamp: performance.now(),
            key: updateKey
        };
        // Set timeout to mark as missed if not confirmed
        this.metrics.updateAccuracy.updateTimeouts[updateId] = setTimeout(() => {
            if (this.metrics.updateAccuracy.pendingUpdates[updateId]) {
                this.metrics.updateAccuracy.missedUpdates++;
                
                // Also track in simulation if simulation is running
                if (this.simulationMetrics && this.simulationMetrics.startTime > 0 && this.simulationMetrics.endTime === 0) {
                    this.simulationMetrics.updateAccuracy.missedUpdates++;
                }
                
                delete this.metrics.updateAccuracy.pendingUpdates[updateId];
                
                // Update DOM with new accuracy percentage
                this.updateDOMMetric('update-accuracy', `${this.getUpdateAccuracy()}%`);
                
                console.warn(`Update missed: ${updateKey} = ${value} (timeout after ${timeout}ms)`);
            }
            delete this.metrics.updateAccuracy.updateTimeouts[updateId];
        }, timeout);
        
        return updateId;
    },

    // Confirm an update was received (after getting from API or visual confirmation)
    confirmUpdate(component, property, receivedValue, tolerance = 0.01) {
        if (!this.config.isRunning) return false;
        
        const updateKey = `${component}.${property}`;
        
        // Find matching pending update
        let matchedUpdateId = null;
        let matchedUpdate = null;
        
        for (const [updateId, update] of Object.entries(this.metrics.updateAccuracy.pendingUpdates)) {
            if (update.key === updateKey) {
                // Check if values match within tolerance
                const valuesMatch = this.valuesMatch(update.expectedValue, receivedValue, tolerance);
                
                if (valuesMatch) {
                    matchedUpdateId = updateId;
                    matchedUpdate = update;
                    break;
                }
            }
        }
        
        if (matchedUpdateId && matchedUpdate) {
            this.metrics.updateAccuracy.receivedUpdates++;
            
            // Also track in simulation if simulation is running
            if (this.simulationMetrics && this.simulationMetrics.startTime > 0 && this.simulationMetrics.endTime === 0) {
                this.simulationMetrics.updateAccuracy.receivedUpdates++;
            }
            
            // Clear timeout and remove from pending
            if (this.metrics.updateAccuracy.updateTimeouts[matchedUpdateId]) {
                clearTimeout(this.metrics.updateAccuracy.updateTimeouts[matchedUpdateId]);
                delete this.metrics.updateAccuracy.updateTimeouts[matchedUpdateId];
            }
            delete this.metrics.updateAccuracy.pendingUpdates[matchedUpdateId];
            
            // Update DOM with new accuracy percentage
            this.updateDOMMetric('update-accuracy', `${this.getUpdateAccuracy()}%`);
            
            return true;
        }
        
        return false;
    },

    // Helper to compare values with tolerance for numbers
    valuesMatch(expected, received, tolerance = 0.01) {
        if (expected === received) return true;
        
        // For numbers, check within tolerance
        if (typeof expected === 'number' && typeof received === 'number') {
            return Math.abs(expected - received) <= tolerance;
        }
        
        // For strings, exact match
        return String(expected) === String(received);
    },

    // Get current update accuracy percentage
    getUpdateAccuracy() {
        const total = this.metrics.updateAccuracy.expectedUpdates;
        if (total === 0) return 100; // No updates sent yet
        
        const successful = this.metrics.updateAccuracy.receivedUpdates;
        return Math.round((successful / total) * 100 * 100) / 100; // Round to 2 decimal places
    },

    // Get update accuracy statistics
    getUpdateAccuracyStats() {
        const accuracy = this.metrics.updateAccuracy;
        const totalProcessed = accuracy.receivedUpdates + accuracy.missedUpdates;
        const pendingCount = Object.keys(accuracy.pendingUpdates).length;
        
        return {
            expectedUpdates: accuracy.expectedUpdates,
            receivedUpdates: accuracy.receivedUpdates,
            missedUpdates: accuracy.missedUpdates,
            pendingUpdates: pendingCount,
            accuracyPercentage: this.getUpdateAccuracy(),
            successRate: accuracy.expectedUpdates > 0 ? 
                        Math.round((accuracy.receivedUpdates / accuracy.expectedUpdates) * 100 * 100) / 100 : 100
        };
    },

    // === SIMULATION-SPECIFIC METHODS ===
    
    // Simulation-specific metrics storage
    simulationMetrics: {
        fps: [],
        memory: [],
        latency: [],
        startTime: 0,
        endTime: 0,
        finalUpdateAccuracy: 100,
        timeSeries: [] // Store timestamped metrics for time-series analysis
    },

    // Start simulation-specific metrics collection
    startSimulation() {
        console.log('Starting simulation-specific metrics collection');
        
        // Reset simulation metrics
        this.simulationMetrics = {
            fps: [],
            memory: [],
            latency: [],
            userInteractionLatencies: [], // Track user interaction latencies during simulation
            startTime: performance.now(),
            endTime: 0,
            finalUpdateAccuracy: 100, // Start with 100% assumption
            timeSeries: [],
            updateAccuracy: {
                expectedUpdates: 0,
                receivedUpdates: 0,
                missedUpdates: 0
            }
        };
        
        // Reset main update accuracy tracking for clean simulation start
        this.metrics.updateAccuracy = {
            expectedUpdates: 0,
            receivedUpdates: 0,
            missedUpdates: 0,
            pendingUpdates: {},
            updateTimeouts: {}
        };
        
        // Clear main latency data to avoid contamination from pre-simulation operations
        this.metrics.latency = [];
        
        // Start time-series data collection every second
        this.startTimeSeriesCollection();
    },

    // Stop simulation-specific metrics collection
    stopSimulation() {
        console.log('Stopping simulation-specific metrics collection');
        
        // Safety check: ensure simulationMetrics exists
        if (!this.simulationMetrics) {
            console.log('Warning: simulationMetrics not found during stop');
            return;
        }
        
        this.simulationMetrics.endTime = performance.now();
        
        // Stop time-series collection
        this.stopTimeSeriesCollection();
        
        // Wait for any pending updates to be confirmed before calculating final accuracy
        setTimeout(() => {
            // Now calculate the final accuracy based on the updated main metrics data
            // Use the main updateAccuracy data since simulation-specific counters aren't being updated properly
            const mainAccuracy = this.metrics.updateAccuracy;
            if (mainAccuracy.expectedUpdates === 0) {
                this.simulationMetrics.finalUpdateAccuracy = 100; // No updates = 100%
                console.log('No updates expected, setting accuracy to 100%');
            } else {
                this.simulationMetrics.finalUpdateAccuracy = Math.round(
                    (mainAccuracy.receivedUpdates / mainAccuracy.expectedUpdates) * 100 * 100
                ) / 100;
            }
            
            console.log('Simulation metrics captured after waiting for pending updates');
        }, 2000); // Wait 2 seconds to allow any last updates to be processed
    },

    // Get simulation-specific average FPS
    getSimulationAverageFPS() {
        if (this.simulationMetrics.fps.length === 0) return this.getAverageFPS();
        return Math.round(this.simulationMetrics.fps.reduce((sum, val) => sum + val, 0) / this.simulationMetrics.fps.length);
    },

    // Get simulation-specific average memory
    getSimulationAverageMemory() {
        if (this.simulationMetrics.memory.length === 0) return this.getAverageMemory();
        return Math.round(this.simulationMetrics.memory.reduce((sum, val) => sum + val, 0) / this.simulationMetrics.memory.length);
    },

    // Get simulation-specific average latency
    getSimulationAverageLatency() {
        if (this.simulationMetrics.latency.length === 0) return 0; // Return 0 if no latency during simulation
        return Math.round(this.simulationMetrics.latency.reduce((sum, val) => sum + val, 0) / this.simulationMetrics.latency.length);
    },

    // Get simulation-specific update accuracy
    getSimulationUpdateAccuracy() {
        // Return the captured final accuracy, or current accuracy if not captured yet
        return this.simulationMetrics.finalUpdateAccuracy || this.getUpdateAccuracy();
    },

    // === TIME-SERIES DATA COLLECTION ===
    
    // Start collecting time-series data every second during simulation
    startTimeSeriesCollection() {
        this.timeSeriesInterval = setInterval(() => {
            if (this.simulationMetrics.startTime > 0 && this.simulationMetrics.endTime === 0) {
                const currentTime = performance.now();
                const elapsedSeconds = (currentTime - this.simulationMetrics.startTime) / 1000;
                
                // Get current metrics
                const currentFPS = this.metrics.fps.length > 0 ? 
                    Math.round(this.metrics.fps[this.metrics.fps.length - 1]) : 0;
                const currentMemory = this.metrics.memory.length > 0 ? 
                    this.metrics.memory[this.metrics.memory.length - 1] : 0;
                const currentLatency = this.metrics.latency.length > 0 ? 
                    Math.round(this.metrics.latency.reduce((sum, val) => sum + val, 0) / this.metrics.latency.length) : 0;
                
                // Store time-series data point
                this.simulationMetrics.timeSeries.push({
                    timestamp: elapsedSeconds,
                    fps: currentFPS,
                    memory: currentMemory,
                    latency: currentLatency
                });               
            }
        }, 1000); // Collect every second
    },

    // Stop time-series data collection
    stopTimeSeriesCollection() {
        if (this.timeSeriesInterval) {
            clearInterval(this.timeSeriesInterval);
            this.timeSeriesInterval = null;
        }
    },

    // === USER INTERACTION LATENCY TRACKING ===
    
    // User interaction latency storage
    userInteractionLatency: {
        pendingInteractions: {},    // Track pending user interactions by ID
        completedLatencies: [],     // Store completed interaction latencies
        timeouts: {}                // Track interaction timeout handlers
    },

    /**
     * Start tracking a user interaction
     * @param {string} controlId - ID of the control that was interacted with
     * @param {string} controlType - Type of control (slider, dropdown, checkbox)
     * @param {any} value - The value that was set
     * @param {number} timeout - Timeout in ms to mark as failed (default 3000)
     * @returns {string} - Interaction ID for tracking
     */
    startUserInteraction(controlId, controlType, value, timeout = 3000) {
        if (!this.config.isRunning) {
            console.log('MetricsCollector not running, skipping user interaction tracking');
            return null;
        }
        
        const interactionId = `${controlId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = performance.now();
        
        this.userInteractionLatency.pendingInteractions[interactionId] = {
            controlId,
            controlType,
            value,
            startTime,
            timestamp: new Date().toISOString()
        };
        
        // Set timeout to mark as missed if not confirmed
        this.userInteractionLatency.timeouts[interactionId] = setTimeout(() => {
            if (this.userInteractionLatency.pendingInteractions[interactionId]) {
                console.warn(`User interaction timeout: ${controlId} (${controlType}) = ${value}`);
                delete this.userInteractionLatency.pendingInteractions[interactionId];
            }
            delete this.userInteractionLatency.timeouts[interactionId];
        }, timeout);
        
        return interactionId;
    },

    /**
     * Confirm a user interaction has completed (visual change detected)
     * @param {string} interactionId - The interaction ID returned by startUserInteraction
     * @returns {number|null} - The latency in ms, or null if interaction not found
     */
    confirmUserInteraction(interactionId) {
        if (!interactionId || !this.userInteractionLatency.pendingInteractions[interactionId]) {
            // Interaction already confirmed or doesn't exist
            return null;
        }
        
        const interaction = this.userInteractionLatency.pendingInteractions[interactionId];
        const endTime = performance.now();
        const latency = endTime - interaction.startTime;
        
        // Store completed latency
        this.userInteractionLatency.completedLatencies.push({
            controlId: interaction.controlId,
            controlType: interaction.controlType,
            value: interaction.value,
            latency: latency,
            timestamp: interaction.timestamp
        });
        
        // Store simulation latency if simulation is running
        if (this.simulationMetrics && this.simulationMetrics.startTime > 0 && this.simulationMetrics.endTime === 0) {
            if (!this.simulationMetrics.userInteractionLatencies) {
                this.simulationMetrics.userInteractionLatencies = [];
            }
            this.simulationMetrics.userInteractionLatencies.push(latency);
        }
        
        // Clean up
        if (this.userInteractionLatency.timeouts[interactionId]) {
            clearTimeout(this.userInteractionLatency.timeouts[interactionId]);
            delete this.userInteractionLatency.timeouts[interactionId];
        }
        delete this.userInteractionLatency.pendingInteractions[interactionId];
        
        
        // Update DOM with latest user interaction latency if available
        this.updateDOMMetric('user-latency', `${Math.round(latency)} ms`);
        
        return latency;
    },

    /**
     * Try to confirm user interactions based on content changes (for tag updates)
     * @param {string} componentId - The component ID that was updated
     * @param {object} data - The data that was updated
     */
    confirmUserInteractionByContent(componentId, data) {
        // Early return if metrics collection is not running
        if (!this.config.isRunning) {
            return;
        }
        
        // Early return if no pending interactions
        if (!this.userInteractionLatency.pendingInteractions || 
            Object.keys(this.userInteractionLatency.pendingInteractions).length === 0) {
            return;
        }
        
        // Look for pending interactions that might match this update
        for (const [interactionId, interaction] of Object.entries(this.userInteractionLatency.pendingInteractions)) {
            const shouldConfirm = this.shouldConfirmInteraction(interaction, componentId, data);
            
            if (shouldConfirm) {
                this.confirmUserInteraction(interactionId);
                break; // Only confirm one interaction per update
            }
        }
    },

    /**
     * Check if an interaction should be confirmed based on component update
     * @param {object} interaction - The pending interaction
     * @param {string} componentId - The component that was updated
     * @param {object} data - The updated data
     * @returns {boolean} - Whether this interaction should be confirmed
     */
    shouldConfirmInteraction(interaction, componentId, data) {
        const { controlId, controlType, value } = interaction;
        
        // Map control IDs to component IDs and data fields
        const controlMappings = {
            'temp-control': { components: ['Mixer_'], dataField: 'temperature' },
            'rpm-control': { components: ['Mixer_'], dataField: 'rpm' },
            'alarm-status': { components: ['Mixer_'], dataField: 'status' },
            'water-flow-control': { components: ['WaterTank'], dataField: 'flowRate' },
            'water-volume-control': { components: ['WaterTank'], dataField: 'volume' },
            'water-tank-status': { components: ['WaterTank'], dataField: 'status' },
            'freezer-temp-control': { components: ['FreezerTunnel'], dataField: 'temperature' },
            'freezer-status': { components: ['FreezerTunnel'], dataField: 'status' },
            'liner-rpm-control': { components: ['PlasticLiner'], dataField: 'rpm' },
            'liner-status': { components: ['PlasticLiner'], dataField: 'status' },
            'cookie-rate-control': { components: ['CookieFormer'], dataField: 'productionRate' },
            'cookie-quality-control': { components: ['CookieFormer'], dataField: 'goodParts' },
            'cookie-former-status': { components: ['CookieFormer'], dataField: 'status' },
            'box-sealer-speed': { components: ['BoxSealer'], dataField: 'speed' },
            'box-sealer-status': { components: ['BoxSealer'], dataField: 'status' },
            'conveyor-speed-control': { components: ['ConveyorSystem'], dataField: 'speed' },
            'conveyor-status': { components: ['ConveyorSystem'], dataField: 'status' }
        };
        
        const mapping = controlMappings[controlId];
        if (!mapping) {
            return false;
        }
        
        // Check if component matches
        const componentMatches = mapping.components.some(comp => 
            comp.endsWith('_') ? componentId.startsWith(comp) : componentId === comp
        );
        
        if (!componentMatches) return false;
        
        // Check if the data field was updated with expected value
        const dataValue = data[mapping.dataField];
        
        if (dataValue === undefined) return false;
        
        // For numeric values, check with tolerance
        if (typeof value === 'number' && typeof dataValue === 'number') {
            const matches = Math.abs(dataValue - value) <= 0.1;
            return matches;
        }
        
        // For strings, exact match
        const matches = String(dataValue) === String(value);
        return matches;
    },

    /**
     * Get average user interaction latency
     * @returns {number} - Average latency in ms
     */
    getAverageUserInteractionLatency() {
        if (this.userInteractionLatency.completedLatencies.length === 0) return 0;
        const sum = this.userInteractionLatency.completedLatencies.reduce((total, item) => total + item.latency, 0);
        return Math.round(sum / this.userInteractionLatency.completedLatencies.length);
    },

    /**
     * Get simulation-specific average user interaction latency
     * @returns {number} - Average latency in ms during simulation
     */
    getSimulationUserInteractionLatency() {
        if (!this.simulationMetrics.userInteractionLatencies || this.simulationMetrics.userInteractionLatencies.length === 0) {
            return 0;
        }
        const sum = this.simulationMetrics.userInteractionLatencies.reduce((total, latency) => total + latency, 0);
        return Math.round(sum / this.simulationMetrics.userInteractionLatencies.length);
    }
};