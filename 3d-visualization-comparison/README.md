# 3D Digital Twin Visualization Framework Comparison

This framework provides a comprehensive platform for comparing different 3D visualization technologies in the context of digital twin applications.
It connects to Eclipse Ditto for real-time digital twin state management and renders an industrial cookie factory model using multiple visualization frameworks to enable performance benchmarking and comparative analysis.

## Overview

The framework enables researchers and developers to evaluate the performance characteristics of different WebGL-based 3D visualization technologies when used for digital twin applications.
All frameworks render the same industrial factory model and connect to the same Eclipse Ditto backend, ensuring fair comparison conditions.

## Frameworks Being Tested

1. **Three.js** - Lightweight WebGL-based JavaScript 3D library
2. **Babylon.js** - Feature-rich real-time 3D engine with advanced rendering capabilities
3. **PlayCanvas** - WebGL game engine with integrated editor and component system

## Architecture

The framework follows a modular architecture with clear separation between:

- **Dashboard UI** (`dashboard.html`) - Unified control interface for framework selection, digital twin controls, and performance monitoring
- **Common JavaScript Modules** (`js/`) - Shared utilities for Ditto API communication, model loading, metrics collection, and scene management
- **Framework Implementations** (`frameworks/`) - Specialized renderers for each visualization technology
- **3D Models** (`models/`) - Cookie factory GLB assets and scene definitions

## Digital Twin Integration

### Eclipse Ditto Backend

The framework connects to a containerized Eclipse Ditto deployment that manages the factory digital twin state.
The digital twin represents:

- **6 Mixer Units** - Temperature (°C) and RPM monitoring with alarm components
- **Water Tank System** - Flow rate and volume sensors
- **Freezer Tunnel** - Temperature control and status monitoring
- **Production Line** - Cookie former, plastic liner, box sealer, and conveyor systems

### Real-time Data Synchronization

All frameworks implement the same data binding approach:

1. **REST API Polling** - Periodic state retrieval from Ditto (configurable interval)
2. **Property Mapping** - Digital twin properties drive visual elements (colors, animations, indicators)
3. **Bidirectional Updates** - User interactions update digital twin state in real-time
4. **Automatic Pause/Resume** - Polling suspends during user interactions to prevent conflicts

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Web browser with WebGL support
- Eclipse Ditto backend running (see `../ditto-master/deployment/docker/`)

### Local Development Setup

#### Option 1: Automated Setup (Recommended)

This project includes a setup automation tool for quick local deployment:

1. **Start Ditto and create the digital twin:**
   ```bash
   ./setup.py start
   ```

2. **In a separate terminal, start the development server:**
   ```bash
   ./setup.py dev-server
   ```

3. **Access the dashboard:**
   Open `http://localhost:8000/dashboard.html` in your browser

**Other setup.py commands:**
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

#### Option 2: Manual Setup

1. **Start Eclipse Ditto Backend:**
   ```bash
   cd ../ditto-master/deployment/docker/
   docker-compose up -d
   ./create-factory-twin.sh
   ```

2. **Serve the Application:**
   ```bash
   # Simple HTTP server (Python)
   python -m http.server 8000
   
   # Or using Node.js
   npx http-server
   ```

3. **Access the Dashboard:**
   Open `http://localhost:8000/dashboard.html` in your browser

### Cloud Deployment

The framework supports automated deployment to AWS EC2 through GitHub Actions:
- **Frontend Instance** - Serves the dashboard and visualization assets
- **Backend Instance** - Runs Eclipse Ditto services and MongoDB
- **Automated CI/CD** - Triggered on repository updates

For AWS deployment, see the main project documentation and GitHub Actions workflow configuration.

## Using the Dashboard

### Framework Selection

Switch between Three.js, Babylon.js, and PlayCanvas implementations in real-time without page reload.
Each framework loads the same factory model and connects to identical data sources.

### Digital Twin Controls

- **Mixer Properties** - Adjust temperature (50-200°C) and RPM (20-120) for any mixer unit
- **System Status** - Control alarm states (NORMAL, ACTIVE, ACKNOWLEDGED)
- **Factory Components** - Modify water tank levels, conveyor speeds, and production rates
- **Real-time Updates** - All changes propagate immediately to the visualization

### Performance Monitoring

- **FPS (Frames Per Second)** - Real-time rendering performance
- **Memory Usage** - Browser memory consumption tracking
- **Load Time** - Framework initialization and model loading duration
- **Data Binding Latency** - Time between property updates and visual changes
- **Simulation Metrics** - Automated performance testing with camera movement

## Performance Testing Features

### Automated Simulation

The framework includes an automated camera tour that:

- Moves through predefined waypoints in the factory scene
- Triggers property updates at regular intervals
- Collects performance metrics throughout the simulation
- Provides comparative performance data across frameworks

### Metrics Collection

Performance data is captured using:

- **Browser Performance API** - High-precision timing measurements
- **Memory Usage Monitoring** - Heap size and garbage collection tracking
- **Custom Instrumentation** - Framework-specific rendering loop hooks
- **CSV Export** - Performance data export for offline analysis

## File Structure

```
3d-visualization-comparison/
├── dashboard.html              # Main application interface
├── index.html                 # Framework landing page
├── Dockerfile                 # Container deployment configuration
├── css/styles.css             # Dashboard styling
├── js/
│   ├── common.js              # Ditto API, model loading, utilities
│   ├── dashboard.js           # UI interactions and state management
│   ├── metrics.js             # Performance monitoring
│   ├── simulation.js          # Automated testing scenarios
│   └── ...
├── frameworks/
│   ├── threejs/visualizer.js  # Three.js implementation
│   ├── babylonjs/visualizer.js# Babylon.js implementation
│   └── playcanvas/visualizer.js# PlayCanvas implementation
└── models/CookieFactory/      # 3D assets and scene definitions
```

## Contributing

This framework is designed for extensibility:

- **Add New Frameworks** - Implement the common interface in `frameworks/`
- **Extend Metrics** - Add custom performance measurements in `metrics.js`
- **Enhance Models** - Include additional 3D assets in `models/`
- **Improve Scenarios** - Expand automated testing in `simulation.js`

## License

Released under the Apache License 2.0. See the root directory for full license information.