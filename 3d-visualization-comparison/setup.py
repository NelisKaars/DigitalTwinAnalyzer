#!/usr/bin/env python3
"""
Digital Twin Visualization Setup Script
This script reads the setup.yaml file and executes the commands defined in it
"""

import os
import sys
import yaml
import subprocess
import time
import argparse
import requests
import json
import base64
from typing import Dict, List, Any, Optional
import signal

# ANSI color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

# Digital Twin Management Functions
def get_auth_header():
    """Get authentication header for Ditto API using default credentials"""
    # Always use the default credentials: ditto/ditto
    username = "ditto"
    password = "ditto"
    
    auth_string = f"{username}:{password}"
    auth_bytes = auth_string.encode('ascii')
    auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
    
    return {"Authorization": f"Basic {auth_b64}"}

def wait_for_ditto(ditto_url="http://localhost:8080", timeout=120, interval=5):
    """
    Wait for Ditto to become available by repeatedly checking its health endpoints
    
    Args:
        ditto_url: Base URL of the Ditto instance
        timeout: Maximum time to wait in seconds
        interval: Time between checks in seconds
    
    Returns:
        bool: True if Ditto becomes available, False if timeout is reached
    """
    print_step(f"Waiting for Ditto to become available (may take up to {timeout}s)")
    
    auth_headers = get_auth_header()
    headers = {
        "Content-Type": "application/json",
        **auth_headers
    }
    
    # Use Ditto's API endpoint for health check
    health_url = f"{ditto_url}/api/2/things"
    start_time = time.time()
    
    # Initialize progress indicator
    sys.stdout.write("  Progress: ")
    sys.stdout.flush()
    
    first_check = True
    dots_count = 0
    
    while time.time() - start_time < timeout:
        try:
            # Show progress indicator
            if not first_check:
                sys.stdout.write(".")
                sys.stdout.flush()
                dots_count += 1
                
                # Add elapsed time every 10 dots
                if dots_count % 10 == 0:
                    elapsed = int(time.time() - start_time)
                    sys.stdout.write(f" {elapsed}s ")
                    sys.stdout.flush()
            else:
                first_check = False
            
            # Try to access the things API
            response = requests.get(health_url, headers=headers, timeout=5)
            
            if response.status_code == 200:
                elapsed = int(time.time() - start_time)
                sys.stdout.write(f" done ({elapsed}s)\n")
                sys.stdout.flush()
                print_success(f"Ditto is now available")
                # Wait a bit more to ensure all services are fully initialized
                time.sleep(2)
                return True
                
        except requests.exceptions.ConnectionError:
            pass
            
        except requests.exceptions.Timeout:
            pass
            
        except requests.exceptions.RequestException:
            pass
            
        time.sleep(interval)
    
    # Add a newline after the progress indicator
    sys.stdout.write("\n")
    sys.stdout.flush()
    
    print_error(f"Timeout reached after {timeout} seconds. Ditto is still not available.")
    print_warning("Check Docker logs with: docker logs -f docker-gateway-1")
    print_warning("Or try restarting with: ./setup.py restart")
    return False

def create_factory_digital_twin(ditto_url="http://localhost:8080"):
    """Create the Factory digital twin if it doesn't exist"""
    thing_id = "org.eclipse.ditto:Factory"
    url = f"{ditto_url}/api/2/things/{thing_id}"
    
    # Get authentication headers with default credentials
    auth_headers = get_auth_header()
    
    headers = {
        "Content-Type": "application/json",
        **auth_headers
    }
    
    # Check if thing exists
    try:
        response = requests.get(url, headers=headers)
        
        if response.status_code == 404:
            # Thing doesn't exist, create it
            print_step("Creating Factory digital twin...")
            
            # Create features for multiple mixers
            features = {}
            
            # Add 6 mixers with properties
            for i in range(6):
                mixer_id = f"Mixer_{i}"
                # Each mixer has temperature and RPM
                features[mixer_id] = {
                    "properties": {
                        "Temperature": 100,
                        "RPM": 60
                    }
                }
                
                # Each mixer also has an alarm component
                features[f"{mixer_id}_AlarmComponent"] = {
                    "properties": {
                        "alarm_status": "NORMAL"
                    }
                }
            
            # Add water tank with flow rate and tank volume
            features["WaterTank"] = {
                "properties": {
                    "flowRate1": 35,
                    "tankVolume1": 75  # Added tank volume property (percentage)
                }
            }
            
            # Create the factory digital twin with all features
            factory_thing = {
                "thingId": thing_id,
                "features": features
            }
            
            create_response = requests.put(url, data=json.dumps(factory_thing), headers=headers)
            
            if create_response.status_code in (201, 204):
                print_success(f"Successfully created Factory digital twin with 6 mixers and water tank")
                return True
            else:
                print_error(f"Failed to create Factory digital twin: Status code {create_response.status_code}")
                print(f"Response: {create_response.text}")
                return False
        elif response.status_code == 200:
            print_success("Factory digital twin already exists")
            
            # Check if we need to update the water tank to add tankVolume1 property
            water_tank_url = f"{url}/features/WaterTank/properties/tankVolume1"
            tank_response = requests.get(water_tank_url, headers=headers)
            
            if tank_response.status_code == 404:
                # Need to add tankVolume1 property
                print_step("Adding tankVolume1 property to existing WaterTank...")
                tank_update = requests.put(
                    water_tank_url,
                    data=json.dumps(75),  # Initial value of 75%
                    headers=headers
                )
                if tank_update.status_code in (201, 204):
                    print_success("Added tankVolume1 property to WaterTank")
                else:
                    print_warning(f"Could not add tankVolume1 property: Status code {tank_update.status_code}")
            
            return True
        else:
            print_error(f"Error checking if Factory digital twin exists: Status code {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Error checking if Factory digital twin exists: {str(e)}")
        return False

def print_header(text: str) -> None:
    """Print a formatted header"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}= {text} ={Colors.ENDC}\n")

def print_step(text: str) -> None:
    """Print a formatted step"""
    print(f"{Colors.BLUE}-> {text}{Colors.ENDC}")

def print_success(text: str) -> None:
    """Print a success message"""
    print(f"{Colors.GREEN}✓ {text}{Colors.ENDC}")

def print_warning(text: str) -> None:
    """Print a warning message"""
    print(f"{Colors.YELLOW}⚠ {text}{Colors.ENDC}")

def print_error(text: str) -> None:
    """Print an error message"""
    print(f"{Colors.RED}✗ {text}{Colors.ENDC}")

def run_command(command: str, shell: bool = True) -> tuple:
    """Execute a shell command and return the result"""
    try:
        result = subprocess.run(
            command, 
            shell=shell, 
            check=False, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            text=True
        )
        return (result.returncode, result.stdout, result.stderr)
    except Exception as e:
        return (1, "", str(e))

def execute_step(step_name: str, step_data: Dict[str, Any]) -> bool:
    """Execute a single setup step"""
    print_step(f"{step_data.get('description', step_name)}")
    
    for command in step_data.get('commands', []):
        print(f"  Running: {command}")
        code, stdout, stderr = run_command(command)
        
        if code != 0:
            print_error(step_data.get('failure_message', f"Command failed with exit code {code}"))
            print(f"  STDERR: {stderr}")
            return False
    
    # Run check command if provided
    check_command = step_data.get('check_command')
    if check_command:
        code, stdout, stderr = run_command(check_command)
        if code != 0:
            print_warning("Check command failed, but continuing anyway...")
    
    print_success(step_data.get('success_message', "Command completed successfully"))
    return True

def execute_setup_phase(config: Dict[str, Any], phase: str) -> bool:
    """Execute a setup phase (setup, shutdown, etc.)"""
    if phase not in config:
        print_warning(f"Phase '{phase}' not found in configuration")
        return False

    print_header(f"Executing {phase} phase")
    
    phase_steps = config[phase]
    for step_name, step_data in phase_steps.items():
        if not execute_step(step_name, step_data):
            print_error(f"Phase '{phase}' failed at step '{step_name}'")
            return False
            
    print_success(f"Phase '{phase}' completed successfully")
    return True

def start_dev_server() -> None:
    """Start the development server in the foreground"""
    print_header("Starting development server")
    print_step("Starting local development server for the visualization dashboard")
    print("  Running: python -m http.server 8000")
    print_warning("Press Ctrl+C to stop the server")
    
    # Run the server in the foreground
    try:
        # Use os.system to keep the server in the foreground
        os.system("python -m http.server 8000")
    except KeyboardInterrupt:
        print_warning("\nDevelopment server stopped by user")

def show_urls(config: Dict[str, Any]) -> None:
    """Display useful URLs defined in the configuration"""
    urls = config.get('urls', {})
    if not urls:
        return
    
    print_header("Useful URLs")
    for name, url in urls.items():
        print(f"  {name}: {url}")
        
    print("\nRemember to start the development server in another terminal with:")
    print(f"{Colors.BOLD}  ./setup.py dev-server{Colors.ENDC}")

def show_instructions(config: Dict[str, Any]) -> None:
    """Display instructions from the configuration"""
    instructions = config.get('instructions')
    if not instructions:
        return
    
    print_header("Instructions")
    print(instructions)

def show_requirements(config: Dict[str, Any]) -> None:
    """Display requirements from the configuration"""
    requirements = config.get('requirements', [])
    if not requirements:
        return
    
    print_header("Requirements")
    for req in requirements:
        print(f"  - {req}")

def main() -> None:
    """Main function"""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Digital Twin Visualization Setup Script")
    parser.add_argument('action', choices=['start', 'stop', 'restart', 'dev-server', 'info', 'create-twin'],
                        help='Action to perform: start, stop, restart, dev-server, info, or create-twin')
    parser.add_argument('--skip-ditto', action='store_true', help='Skip starting Ditto (for development)')
    parser.add_argument('--config', default='setup.yaml', help='Path to the configuration file')
    parser.add_argument('--ditto-url', default='http://localhost:8080', help='Ditto API URL')
    parser.add_argument('--ditto-timeout', type=int, default=180, help='Maximum time in seconds to wait for Ditto to start')
    
    args = parser.parse_args()
    
    # Load configuration file
    try:
        with open(args.config, 'r') as f:
            config = yaml.safe_load(f)
    except Exception as e:
        print_error(f"Failed to load configuration file: {e}")
        sys.exit(1)
    
    # Execute the requested action
    if args.action == 'create-twin':
        # Wait for Ditto to be available first
        if wait_for_ditto(args.ditto_url, args.ditto_timeout):
            # Create factory digital twin
            if not create_factory_digital_twin(args.ditto_url):
                sys.exit(1)
        else:
            print_error("Ditto is not available, cannot create digital twin")
            sys.exit(1)
            
    elif args.action == 'dev-server':
        # Just start the development server, nothing else
        start_dev_server()
            
    elif args.action == 'start':
        if not args.skip_ditto:
            # When action is 'start', execute setup phase first
            if not execute_setup_phase(config, 'setup'):
                sys.exit(1)
                
            # Wait for Ditto to be fully available
            if not wait_for_ditto(args.ditto_url, args.ditto_timeout):
                print_error("Failed to start Ditto properly. Check Docker container logs for errors.")
                print_warning("You can try again or use './setup.py stop' to clean up.")
                sys.exit(1)
        else:
            print_warning("Skipping Ditto setup as requested")
            # Still wait for Ditto to be available
            if not wait_for_ditto(args.ditto_url, args.ditto_timeout):
                print_error("Ditto is not available, cannot create digital twin")
                sys.exit(1)
            
        # Create factory digital twin
        create_factory_digital_twin(args.ditto_url)
        
        # Show URLs and remind user to start the dev server
        show_urls(config)
        
    elif args.action == 'stop':
        if not execute_setup_phase(config, 'shutdown'):
            sys.exit(1)
            
    elif args.action == 'restart':
        execute_setup_phase(config, 'shutdown')
        
        if not execute_setup_phase(config, 'setup'):
            sys.exit(1)
            
        # Wait for Ditto to be fully available
        if not wait_for_ditto(args.ditto_url, args.ditto_timeout):
            print_error("Failed to restart Ditto properly. Check Docker container logs for errors.")
            print_warning("You can try again or use './setup.py stop' to clean up.")
            sys.exit(1)
        
        # Create factory digital twin
        create_factory_digital_twin(args.ditto_url)
        
        # Show URLs and remind user to start the dev server
        show_urls(config)
        
    elif args.action == 'info':
        show_requirements(config)
        show_urls(config)
        show_instructions(config)
    
if __name__ == "__main__":
    main()