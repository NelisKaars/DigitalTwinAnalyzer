# Digital Twin Visualization Framework

This repository contains tools and frameworks for building and comparing interactive 3D visualizations of digital twins. It offers a comprehensive approach to evaluating, selecting, and implementing visualization techniques and frameworks for digital twin applications.

## Repository Structure

This codebase is organized into the following major components:

### 1. [3D Visualization Framework Comparison](./3d-visualization-comparison/README.md)

A testing framework that provides side-by-side comparisons of different CAD-based 3D visualization frameworks for digital twin applications. Features include:

- Performance metrics collection for FPS, memory usage, load time, etc.
- Standardized test scenarios across frameworks
- Real-time data binding to Eclipse Ditto
- Interactive controls for digital twin manipulation

Supported frameworks include Three.js, Babylon.js, Unity WebGL, and more.

[→ View 3D Visualization Comparison Documentation](./3d-visualization-comparison/README.md)

### 2. [Visualization Technique Selection Wizard](./wizard/README.md)

An interactive tool that helps you select the most appropriate visualization technique based on your specific requirements. The wizard:

- Guides you through key considerations for digital twin visualization
- Evaluates suitability of different techniques (AR, VR, CAD, Neural Rendering, etc.)
- Uses research-based criteria to recommend visualization approaches
- Provides rationale for each recommendation
- Considers factors like immersion needs, hardware constraints, and user interaction requirements

[→ View Visualization Wizard Documentation](./wizard/README.md)

### 3. [Eclipse Ditto Integration](./ditto-master)

Integration with Eclipse Ditto for digital twin data management:

- Different ways of deploying Ditto (Docker, Kubernetes, HELM, etc.)
- REST API access for digital twin state management
- Real-time data updates

### 4. [AWS IoT TwinMaker Samples](./aws-iot-twinmaker-samples-main)

Reference implementations and samples using AWS IoT TwinMaker for cloud-based digital twins.

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Python 3.6+
- Modern web browser (Chrome or Firefox recommended)
- Node.js (for some components)

### Quick Setup

1. Start by exploring the visualization selection wizard to determine the best visualization technique for your needs:
   ```bash
   cd wizard
   # Open dt_visualization_wizard.html in your browser
   ```

2. If the wizard recommends a CAD-based approach, you can use the comparison tool to evaluate different CAD visualization frameworks:
   ```bash
   cd 3d-visualization-comparison
   ./setup.py start
   # In another terminal
   ./setup.py dev-server
   ```

3. Access the framework comparison dashboard at http://localhost:8000/3d-visualization-comparison/dashboard.html

## Project Context

This codebase was developed as part of a Master's thesis on digital twin visualization techniques. The research focused on identifying the most effective visualization approaches for different types of digital twin applications, with an emphasis on performance, interactivity, and integration capabilities.

## License

This project contains components with various licenses. Please refer to individual component directories for specific licensing information.