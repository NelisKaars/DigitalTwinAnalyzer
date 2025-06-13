# Stress Testing Guide

## Overview
The stress testing functionality has been enhanced to support comprehensive frequency analysis for your thesis research.

## Two Stress Test Modes

### 1. Frequency-Stepped Analysis (Default)
- Tests 5 frequency levels: 1Hz, 5Hz, 10Hz, 25Hz, 50Hz
- Each level runs for 30 seconds (150 seconds total)
- Collects detailed metrics at each frequency
- Generates CSV with phase-by-phase results

### 2. Maximum Throughput Test
- Sends updates as fast as possible for 30 seconds
- Tests absolute framework limits
- Measures raw processing capability

## How to Run Stress Tests

### From Dashboard
1. Load your 3D framework (Three.js, Babylon.js, or PlayCanvas)
2. Click "Start Stress Test" button
3. Wait for completion (150 seconds for frequency analysis)
4. CSV results automatically download

### Programmatically
```javascript
// Frequency analysis (default)
Simulation.startStressTest(activeInstance, 'frequency-stepped');

// Maximum throughput
Simulation.startStressTest(activeInstance, 'maximum-throughput');
```

## Data Collection

### Metrics Collected at Each Frequency:
- **FPS**: Average frames per second
- **FPS Drop**: Percentage drop from baseline (1Hz)
- **Latency**: Average update latency in milliseconds
- **Memory**: Browser memory usage in MB
- **Dropped Updates**: Failed/missed updates
- **Sync Issues**: Desynchronization incidents

### CSV Output Format:
```csv
Target_Frequency_Hz,Actual_Frequency_Hz,FPS,FPS_Drop_Percent,Latency_ms,Memory_MB,Dropped_Updates,Sync_Issues,Updates_Performed,Phase_Duration_s
1,1.00,60,0.0,25,45,0,0,30,30.0
5,4.98,58,3.3,28,47,1,0,149,30.1
10,9.95,55,8.3,32,50,2,0,298,30.0
25,24.87,48,20.0,45,55,8,1,746,30.1
50,47.23,35,41.7,78,62,25,3,1417,30.0
```

## Generating Graphs for Thesis

### 1. Run Stress Tests for All Frameworks
```bash
# Run stress tests and save CSV files for:
# - Three.js → threejs_stress_test_YYYY-MM-DD.csv
# - Babylon.js → babylonjs_stress_test_YYYY-MM-DD.csv  
# - PlayCanvas → playcanvas_stress_test_YYYY-MM-DD.csv
```

### 2. Generate Analysis Graphs
```bash
cd data/
python3 generate_stress_test_graphs.py --output-dir figures/
```

### 3. Generated Files
- `fps_under_stress.png` - FPS vs frequency graph
- `memory_stress_bar.png` - Memory usage at 50Hz
- `latency_heatmap.png` - Latency across frequencies
- `stress_test_summary.csv` - Summary table data

## Expected Results Analysis

### Performance Indicators
- **Max Stable Rate**: Highest frequency with <30% FPS drop
- **Performance Rating**: 
  - Excellent: 25+Hz stable, <25% avg drop, <10 missed
  - Good: 10+Hz stable, <40% avg drop, <20 missed
  - Fair: 5+Hz stable, <60% avg drop
  - Poor: <5Hz stable or >60% drop

### Framework Expectations
- **Three.js**: Consistent performance, may plateau at mid-range
- **Babylon.js**: Potentially best stability due to engine optimizations
- **PlayCanvas**: Good performance with possible memory efficiency

## Integration with MetricsCollector

The stress test automatically integrates with the existing MetricsCollector:
- FPS tracking continues during stress test
- Memory monitoring at 1-second intervals
- Update accuracy calculation (expected vs received)
- User interaction latency (if applicable)

## Console Output Example
```
Starting frequency-stepped stress test
Testing frequencies: [1, 5, 10, 25, 50] Hz
Total duration: 150 seconds

=== PHASE 1 COMPLETE (1Hz) ===
Target: 1Hz, Actual: 1.00Hz
FPS: 60, Drop: 0.0%
Latency: 25ms, Memory: 45MB
Dropped: 0, Updates: 30
================================================

... (continues for each phase)

=== STRESS TEST COMPLETE ===
Total duration: 150.23 seconds
Total updates sent: 2440

=== FREQUENCY ANALYSIS RESULTS ===
1Hz: FPS=60, Drop=0.0%, Latency=25ms, Memory=45MB, Dropped=0
5Hz: FPS=58, Drop=3.3%, Latency=28ms, Memory=47MB, Dropped=1
10Hz: FPS=55, Drop=8.3%, Latency=32ms, Memory=50MB, Dropped=2
25Hz: FPS=48, Drop=20.0%, Latency=45ms, Memory=55MB, Dropped=8
50Hz: FPS=35, Drop=41.7%, Latency=78ms, Memory=62MB, Dropped=25
```

## Usage Tips

1. **Run Multiple Tests**: Run 3-5 stress tests per framework for statistical significance
2. **System State**: Ensure consistent system state (close other applications)
3. **Browser Cache**: Clear cache between framework tests
4. **Monitor Console**: Watch for errors or warnings during high-frequency phases
5. **CSV Analysis**: Use the generated summary table directly in your thesis

This comprehensive stress testing approach will provide robust data for your thesis analysis of framework performance under varying load conditions.
