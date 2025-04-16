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
        latency: []
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
        this.metrics = {
            fps: [],
            memory: [],
            loadTime: 0,
            latency: []
        };
        this.config.frameTimeHistory = [];
        this.config.lastFrameTime = 0;
        this.config.lastMemoryCheck = 0;
    },
    
    // Record model load time
    recordLoadTime(loadTime) {
        this.metrics.loadTime = loadTime;
        this.updateDOMMetric('load-time', `${Math.round(loadTime)} ms`);
    },
    
    // Record data binding latency
    recordLatency(latencyMs) {
        this.metrics.latency.push(latencyMs);
        
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
        const lines = ['Framework,Timestamp,FPS,Memory(MB),LoadTime(ms),LatencyAvg(ms)'];
        
        const timestamp = new Date().toISOString();
        const avgFPS = this.getAverageFPS();
        const avgMemory = this.getAverageMemory();
        const avgLatency = this.getAverageLatency();
        
        lines.push(`${this.metrics.framework},${timestamp},${avgFPS},${avgMemory},${this.metrics.loadTime},${avgLatency}`);
        
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
    }
};