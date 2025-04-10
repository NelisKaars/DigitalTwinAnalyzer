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

1. Place your 3D models in the `models` directory
2. Make sure your Eclipse Ditto instance is running
3. Run the test suite or individual framework tests

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
2. Subscribe to changes (using WebSocket where available)
3. Map digital twin properties to visual elements

## Test Scenarios

All frameworks implement these standard test scenarios:
1. **Static Visualization** - Basic 3D model rendering
2. **Real-time Data Binding** - Mapping Ditto data to visual properties
3. **Animation and Transitions** - Smooth transitions between states
4. **Interactive Controls** - User manipulation of the 3D scene
5. **Scene Complexity Scaling** - Testing with increasing object counts