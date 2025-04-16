#!/usr/bin/env python3
import requests
import json
import argparse
import time
import base64
import getpass

def get_auth_header(username=None, password=None):
    """
    Get authentication header for Ditto
    
    If username/password not provided, will prompt the user
    """
    if username is None:
        username = input("Enter Ditto username (default: ditto): ") or "ditto"
    
    if password is None:
        password = getpass.getpass(f"Enter password for {username}: ")
    
    auth_string = f"{username}:{password}"
    auth_bytes = auth_string.encode('ascii')
    auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
    
    return {"Authorization": f"Basic {auth_b64}"}

def update_mixer_property(property_name, value, ditto_url="http://localhost:8080", auth_headers=None):
    """
    Update a property of the Mixer digital twin in Ditto
    
    Args:
        property_name: Name of the property (Temperature, RPM, etc.)
        value: New value for the property
        ditto_url: Base URL of the Ditto instance
        auth_headers: Authentication headers
    """
    # Define the API endpoint for the specific thing
    thing_id = "org.eclipse.ditto:Mixer"
    feature_id = "Mixer"
    
    url = f"{ditto_url}/api/2/things/{thing_id}/features/{feature_id}/properties/{property_name}"
    
    headers = {
        "Content-Type": "application/json"
    }
    
    # Add authentication headers if provided
    if auth_headers:
        headers.update(auth_headers)
    
    try:
        # Send the update
        response = requests.put(url, data=json.dumps(value), headers=headers)
        
        if response.status_code == 204:
            print(f"Successfully updated {property_name} to {value}")
            return True
        else:
            print(f"Failed to update: Status code {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

def update_alarm_status(status, ditto_url="http://localhost:8080", auth_headers=None):
    """
    Update the alarm status of the Mixer
    
    Args:
        status: New alarm status ('NORMAL', 'ACTIVE', 'ACKNOWLEDGED')
        ditto_url: Base URL of the Ditto instance
        auth_headers: Authentication headers
    """
    thing_id = "org.eclipse.ditto:Mixer"
    feature_id = "Alarm"
    property_name = "alarm_status"
    
    url = f"{ditto_url}/api/2/things/{thing_id}/features/{feature_id}/properties/{property_name}"
    
    headers = {
        "Content-Type": "application/json"
    }
    
    # Add authentication headers if provided
    if auth_headers:
        headers.update(auth_headers)
    
    try:
        # Send the update
        response = requests.put(url, data=json.dumps(status), headers=headers)
        
        if response.status_code == 204:
            print(f"Successfully updated alarm status to {status}")
            return True
        else:
            print(f"Failed to update: Status code {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

def simulate_temperature_change(start, end, step, interval=1.0, ditto_url="http://localhost:8080", auth_headers=None):
    """
    Simulate a gradual temperature change
    
    Args:
        start: Starting temperature
        end: Ending temperature
        step: Step size for each change
        interval: Time in seconds between updates
        ditto_url: Base URL of the Ditto instance
        auth_headers: Authentication headers
    """
    if start < end:
        values = range(int(start), int(end) + 1, abs(int(step)))
    else:
        values = range(int(start), int(end) - 1, -abs(int(step)))
        
    for temp in values:
        update_mixer_property("Temperature", temp, ditto_url, auth_headers)
        time.sleep(interval)

def simulate_rpm_change(start, end, step, interval=0.5, ditto_url="http://localhost:8080", auth_headers=None):
    """
    Simulate a gradual RPM change
    
    Args:
        start: Starting RPM
        end: Ending RPM
        step: Step size for each change
        interval: Time in seconds between updates
        ditto_url: Base URL of the Ditto instance
        auth_headers: Authentication headers
    """
    if start < end:
        values = range(int(start), int(end) + 1, abs(int(step)))
    else:
        values = range(int(start), int(end) - 1, -abs(int(step)))
        
    for rpm in values:
        update_mixer_property("RPM", rpm, ditto_url, auth_headers)
        time.sleep(interval)

def create_mixer_if_not_exists(ditto_url="http://localhost:8080", auth_headers=None):
    """
    Create the Mixer thing if it doesn't exist yet
    """
    thing_id = "org.eclipse.ditto:Mixer"
    url = f"{ditto_url}/api/2/things/{thing_id}"
    
    headers = {
        "Content-Type": "application/json"
    }
    
    # Add authentication headers if provided
    if auth_headers:
        headers.update(auth_headers)
    
    # Check if thing exists
    try:
        response = requests.get(url, headers=headers)
        
        if response.status_code == 404:
            # Thing doesn't exist, create it
            mixer_thing = {
                "thingId": thing_id,
                "features": {
                    "Mixer": {
                        "properties": {
                            "Temperature": 100,
                            "RPM": 60
                        }
                    },
                    "Alarm": {
                        "properties": {
                            "alarm_status": "NORMAL"
                        }
                    }
                }
            }
            
            create_response = requests.put(url, data=json.dumps(mixer_thing), headers=headers)
            
            if create_response.status_code in (201, 204):
                print(f"Successfully created Mixer thing")
                return True
            else:
                print(f"Failed to create Mixer thing: Status code {create_response.status_code}")
                print(f"Response: {create_response.text}")
                return False
        elif response.status_code == 200:
            print("Mixer thing already exists")
            return True
        else:
            print(f"Error checking if thing exists: Status code {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"Error checking if thing exists: {str(e)}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Update Digital Twin properties')
    
    parser.add_argument('--check', action='store_true', help='Check if Mixer thing exists and create it if needed')
    parser.add_argument('--username', help='Username for Ditto authentication')
    parser.add_argument('--password', help='Password for Ditto authentication')
    parser.add_argument('--url', default='http://localhost:8080', help='Ditto URL (default: http://localhost:8080)')
    
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Temperature command
    temp_parser = subparsers.add_parser('temperature', help='Set mixer temperature')
    temp_parser.add_argument('value', type=float, help='Temperature value')
    
    # RPM command
    rpm_parser = subparsers.add_parser('rpm', help='Set mixer RPM')
    rpm_parser.add_argument('value', type=float, help='RPM value')
    
    # Alarm command
    alarm_parser = subparsers.add_parser('alarm', help='Set alarm status')
    alarm_parser.add_argument('value', choices=['NORMAL', 'ACTIVE', 'ACKNOWLEDGED'], 
                            help='Alarm status (NORMAL, ACTIVE, ACKNOWLEDGED)')
    
    # Simulate temperature command
    sim_temp_parser = subparsers.add_parser('sim-temp', help='Simulate temperature change')
    sim_temp_parser.add_argument('start', type=float, help='Starting temperature')
    sim_temp_parser.add_argument('end', type=float, help='Ending temperature')
    sim_temp_parser.add_argument('--step', type=float, default=1.0, help='Step size')
    sim_temp_parser.add_argument('--interval', type=float, default=1.0, help='Time between updates (seconds)')
    
    # Simulate RPM command
    sim_rpm_parser = subparsers.add_parser('sim-rpm', help='Simulate RPM change')
    sim_rpm_parser.add_argument('start', type=float, help='Starting RPM')
    sim_rpm_parser.add_argument('end', type=float, help='Ending RPM')
    sim_rpm_parser.add_argument('--step', type=float, default=5.0, help='Step size')
    sim_rpm_parser.add_argument('--interval', type=float, default=0.5, help='Time between updates (seconds)')
    
    args = parser.parse_args()
    
    # Get authentication headers
    auth_headers = get_auth_header(args.username, args.password)
    
    # Default URL where Ditto is running
    ditto_url = args.url
    
    if args.check or not args.command:
        create_mixer_if_not_exists(ditto_url, auth_headers)
        
    if not args.command:
        parser.print_help()
    elif args.command == 'temperature':
        update_mixer_property("Temperature", args.value, ditto_url, auth_headers)
    elif args.command == 'rpm':
        update_mixer_property("RPM", args.value, ditto_url, auth_headers)
    elif args.command == 'alarm':
        update_alarm_status(args.value, ditto_url, auth_headers)
    elif args.command == 'sim-temp':
        simulate_temperature_change(args.start, args.end, args.step, args.interval, ditto_url, auth_headers)
    elif args.command == 'sim-rpm':
        simulate_rpm_change(args.start, args.end, args.step, args.interval, ditto_url, auth_headers)