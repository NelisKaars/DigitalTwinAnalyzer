#!/usr/bin/env python3
"""
Example script demonstrating how to use the performance graph generator
and install dependencies.

This script shows how to:
1. Install required Python packages
2. Run the graph generator
3. View the generated graphs
"""

import subprocess
import sys
import os

def install_requirements():
    """Install required Python packages"""
    print("Installing required Python packages...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✓ Requirements installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install requirements: {e}")
        return False

def run_graph_generator():
    """Run the performance graph generator"""
    print("\nGenerating performance graphs...")
    try:
        # Run the graph generator
        result = subprocess.run([sys.executable, "generate_performance_graphs.py"], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✓ Graphs generated successfully")
            print(result.stdout)
            return True
        else:
            print("✗ Graph generation failed")
            print(result.stderr)
            return False
            
    except Exception as e:
        print(f"✗ Error running graph generator: {e}")
        return False

def main():
    """Main function"""
    print("3D Visualization Framework Performance Graph Generator")
    print("=" * 55)
    
    # Check if we're in the right directory
    if not os.path.exists("generate_performance_graphs.py"):
        print("Error: Please run this script from the 3d-visualization-comparison directory")
        return 1
    
    # Install requirements
    if not install_requirements():
        return 1
    
    # Run graph generator
    if not run_graph_generator():
        return 1
    
    print("\n" + "=" * 55)
    print("Example Usage:")
    print("  python generate_performance_graphs.py                    # Use current directory")
    print("  python generate_performance_graphs.py ./test_data        # Specify data directory")
    print("  python generate_performance_graphs.py -o ./my_graphs     # Specify output directory")
    print("\nGenerated graphs will be saved as PNG files in the output directory.")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
