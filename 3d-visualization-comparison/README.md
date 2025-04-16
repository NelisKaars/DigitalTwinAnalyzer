# 3D Visualization Framework Comparison

This project provides a framework for comparing different 3D visualization technologies for digital twin applications.
It connects to Eclipse Ditto for real-time data and renders 3D models with various frameworks.

## Frameworks Being Tested

1. **Three.js** - WebGL-based JavaScript 3D library
2. **Babylon.js** - Real-time 3D engine using WebGL
3. **Unity WebGL** - Unity game engine exported to WebGL
4. **A-Frame** - Web framework for building VR experiences
5. **PlayCanvas** - WebGL Game Engine

## Project Setup

Each framework has its own implementation in a separate folder, but they all:
- Connect to the same Ditto backend
- Use the same 3D models
- Implement the same basic functionality 
- Track the same performance metrics

## Getting Started

### Quick Setup

This project includes a setup automation tool that helps you quickly get started:

1. Start Ditto and create the digital twin:
   ```bash
   ./setup.py start
   ```

2. In a separate terminal, start the development server:
   ```bash
   ./setup.py dev-server
   ```

3. Access the dashboard:
   http://localhost:8000/3d-visualization-comparison/dashboard.html

### Other Commands

```bash
# Stop the Ditto backend
./setup.py stop

# Restart everything
./setup.py restart

# Only create/check the digital twin
./setup.py create-twin

# Show project information, URLs, and requirements
./setup.py info
```

## Using the Dashboard

The dashboard provides a unified interface for:

1. Switching between different visualization frameworks:
   - Select from Three.js, Babylon.js, or Unity WebGL

2. Controlling the digital twin in real-time:
   - Adjust temperature (0-200°C)
   - Control RPM (0-120)
   - Set alarm status (NORMAL, ACTIVE, ACKNOWLEDGED)
   - All changes take effect immediately

3. Viewing performance metrics:
   - FPS (Frames Per Second)
   - Memory usage
   - Load time
   - Data binding latency

## Performance Testing

The testing framework tracks these metrics across all visualization libraries:
- **FPS (Frames Per Second)** - Rendering performance
- **Memory Usage** - RAM consumption during operation
- **Loading Time** - Initial loading and asset processing time
- **CPU Usage** - Processing overhead
- **Data Binding Latency** - Time to update visualizations when data changes
- **Interaction Responsiveness** - Response time to user input

## How the Integration Works

Each visualization connects to Eclipse Ditto via the REST API to:
1. Get the digital twin state
2. Subscribe to changes (using polling)
3. Map digital twin properties to visual elements:
   - Temperature affects light color and intensity
   - RPM controls animation speed
   - Alarm status changes indicator color

## Test Scenarios

All frameworks implement these standard test scenarios:
1. **Static Visualization** - Basic 3D model rendering
2. **Real-time Data Binding** - Mapping Ditto data to visual properties
3. **Animation and Transitions** - Smooth transitions between states
4. **Interactive Controls** - User manipulation of the 3D scene
5. **Scene Complexity Scaling** - Testing with increasing object counts