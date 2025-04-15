#!/usr/bin/env python3
"""
Simulate CSV Updates for Eclipse Ditto Digital Twins

This script reads sensor data from a CSV file and updates digital twins in Eclipse Ditto
via its REST API, simulating real-time data updates with configurable delay between updates.

Usage:
    python simulate_csv_updates.py [--csv PATH_TO_CSV] [--interval SECONDS]

Requirements:
    - requests library (install with pip install requests)
    - A running Eclipse Ditto instance (default: http://localhost:8080)
    - CSV file with at least these columns: thingId, value, timestamp

The CSV file should be located in the DTs directory or specified via command line argument.
"""
import csv
import json
import time
import argparse
import re
from pathlib import Path
import os
import requests


def ensure_namespaced_id(thing_id, default_namespace="org.eclipse.ditto"):
    """
    Ensures the thing_id follows Ditto's namespaced entity ID format.
    If it doesn't contain a namespace, adds the default namespace.
    
    Format should be: namespace:name
    """
    
    # Check if already has namespace format (contains a colon)
    if ':' in thing_id:
        return thing_id 
    # Replace invalid characters with hyphens (only alphanumeric, period, underscore, hyphen allowed)
    # First convert spaces to hyphens
    sanitized_id = thing_id.replace(' ', '-')
    # Then replace any other invalid characters
    sanitized_id = re.sub(r'[^a-zA-Z0-9._-]', '-', sanitized_id)
    
    # Return with default namespace
    return f"{default_namespace}:{sanitized_id}"

def simulate_csv_updates(csv_file, ditto_url, ditto_user=None, ditto_pass=None, 
                        update_interval=1, auth_token=None, debug=False, default_namespace="org.eclipse.ditto"):
    """
    Simulates real-time sensor data updates by reading from a CSV file and sending updates to Eclipse Ditto.

    Parameters:
      csv_file (str): Path to the CSV file containing sensor data.
      ditto_url (str): Base URL for the Eclipse Ditto REST API (e.g., "http://localhost:8080/api/2/things").
      ditto_user (str): Ditto username for Basic Authentication.
      ditto_pass (str): Ditto password for Basic Authentication.
      update_interval (int): The time in seconds between each update.
      auth_token (str): Authentication token for Bearer auth.
      debug (bool): Enable debug mode for verbose output.
      default_namespace (str): Default namespace to use for Thing IDs that don't have one.
    """
    print(f"Reading sensor data from: {csv_file}")
    print(f"Sending updates to Ditto at: {ditto_url}")
    print(f"Update interval: {update_interval} seconds")
    print(f"Authentication: {'Bearer Token' if auth_token else 'Basic Auth'}")
    print(f"Default namespace: {default_namespace}")
    
    try:
        with open(csv_file, newline='') as f:
            # Check if the CSV has headers
            first_line = f.readline().strip()
            f.seek(0)
            
            # Detect the Cookie Factory format (no headers, 6 columns)
            is_cookie_factory_format = False
            if len(first_line.split(',')) >= 5 and not first_line.lower().startswith('thingid'):
                is_cookie_factory_format = True
                print("Detected Cookie Factory CSV format")
                columns = ['timestamp', 'component_type', 'component_id', 'property_name', 'value', 'data_type']
                reader = csv.DictReader(f, fieldnames=columns)
            else:
                reader = csv.DictReader(f)
            
            # Check if the CSV has the required columns
            sample_row = next(reader, None)
            if not sample_row:
                print("Error: CSV file is empty.")
                return
            
            # Reset file pointer to start
            f.seek(0)
            
            if is_cookie_factory_format:
                reader = csv.DictReader(f, fieldnames=columns)
            else:
                reader = csv.DictReader(f)
            
            # Determine which columns to use
            thing_id_col = None
            value_col = None
            timestamp_col = None
            property_name_col = None
            
            if is_cookie_factory_format:
                thing_id_col = 'component_id'
                value_col = 'value'
                timestamp_col = 'timestamp'
                property_name_col = 'property_name'
            else:
                # Look for standard column names
                headers = reader.fieldnames
                if 'thingId' in headers:
                    thing_id_col = 'thingId'
                elif 'thing_id' in headers:
                    thing_id_col = 'thing_id'
                elif 'id' in headers:
                    thing_id_col = 'id'
                
                if 'value' in headers:
                    value_col = 'value'
                elif 'sensor_value' in headers:
                    value_col = 'sensor_value'
                elif 'measurement' in headers:
                    value_col = 'measurement'
                
                if 'timestamp' in headers:
                    timestamp_col = 'timestamp'
                elif 'time' in headers:
                    timestamp_col = 'time'
                elif 'date' in headers:
                    timestamp_col = 'date'
            
            # If we couldn't find standard columns, use the first few columns
            if thing_id_col is None and headers:
                thing_id_col = headers[0]
                print(f"Warning: No thingId column found. Using '{thing_id_col}' as thingId.")
            
            if value_col is None and len(headers) > 1:
                value_col = headers[1]
                print(f"Warning: No value column found. Using '{value_col}' as value.")
            
            if timestamp_col is None and len(headers) > 2:
                timestamp_col = headers[2]
                print(f"Warning: No timestamp column found. Using '{timestamp_col}' as timestamp.")
            
            print(f"Using columns: thingId='{thing_id_col}', value='{value_col}', timestamp='{timestamp_col}'")
            if property_name_col:
                print(f"Using property name column: '{property_name_col}'")
            
            # Reset file pointer to start again
            f.seek(0)
            
            if is_cookie_factory_format:
                reader = csv.DictReader(f, fieldnames=columns)
            else:
                reader = csv.DictReader(f)
            
            row_count = 0
            success_count = 0
            current_things = {}  # Track current state of things
            
            for row in reader:
                row_count += 1
                
                # Extract data from CSV
                raw_thing_id = row.get(thing_id_col, 'default-thing')
                thing_id = ensure_namespaced_id(raw_thing_id, default_namespace)
                sensor_value = row.get(value_col, '0')
                timestamp = row.get(timestamp_col, time.strftime("%Y-%m-%dT%H:%M:%SZ"))
                
                # Handle property name for Cookie Factory format
                property_name = "value"
                if property_name_col and row.get(property_name_col):
                    property_name = row.get(property_name_col)
                
                # For Cookie Factory format, group by component type and ID
                if is_cookie_factory_format:
                    component_type = row.get('component_type', 'Unknown')
                    
                    # Initialize the component if it doesn't exist in our tracking
                    if thing_id not in current_things:
                        current_things[thing_id] = {
                            'component_type': component_type,
                            'properties': {}
                        }
                    
                    # Update the property value
                    current_things[thing_id]['properties'][property_name] = sensor_value
                    
                    # Construct Ditto update payload for this thing with all its properties
                    payload = {
                        "features": {
                            component_type: {
                                "properties": current_things[thing_id]['properties']
                            }
                        }
                    }
                else:
                    # Construct standard Ditto update payload
                    payload = {
                        "features": {
                            "sensor": {
                                "properties": {
                                    "value": sensor_value,
                                    "timestamp": timestamp
                                }
                            }
                        }
                    }
                
                if debug:
                    print(f"DEBUG: Raw thing ID: {raw_thing_id}")
                    print(f"DEBUG: Formatted thing ID: {thing_id}")
                
                # Construct the full API URL for this digital twin
                url = f"{ditto_url}/{thing_id}"
                headers = {'Content-Type': 'application/merge-patch+json'}
                
                # Add authentication header if token is provided
                if auth_token:
                    headers['Authorization'] = f'Bearer {auth_token}'
                
                try:
                    if debug:
                        print(f"DEBUG: Sending to URL: {url}")
                        print(f"DEBUG: Headers: {headers}")
                        print(f"DEBUG: Payload: {json.dumps(payload)}")
                    
                    # Send a PATCH request to update Ditto's state
                    if auth_token:
                        # Use Bearer token authentication
                        response = requests.patch(url,
                                                data=json.dumps(payload),
                                                headers=headers,
                                                timeout=5)
                    else:
                        # Use Basic authentication
                        response = requests.patch(url,
                                                data=json.dumps(payload),
                                                headers=headers,
                                                auth=(ditto_user, ditto_pass),
                                                timeout=5)
                    
                    if response.status_code in (200, 201, 204):
                        success_count += 1
                        print(f"✓ Update for {thing_id}: {response.status_code}")
                    else:
                        print(f"✗ Update for {thing_id}: {response.status_code} - {response.text}")
                        
                        # If Thing doesn't exist, try to create it first
                        if response.status_code == 404:
                            print(f"  Thing {thing_id} not found. Attempting to create it...")
                            create_url = f"{ditto_url.split('/api')[0]}/api/2/things/{thing_id}"
                            
                            create_payload = {
                                "thingId": thing_id,
                                "policyId": thing_id,  # Using same ID for policy
                                "features": payload["features"]
                            }
                            
                            try:
                                if auth_token:
                                    create_response = requests.put(create_url,
                                                           data=json.dumps(create_payload),
                                                           headers=headers,
                                                           timeout=5)
                                else:
                                    create_response = requests.put(create_url,
                                                           data=json.dumps(create_payload),
                                                           headers=headers,
                                                           auth=(ditto_user, ditto_pass),
                                                           timeout=5)
                                
                                if create_response.status_code in (200, 201, 204):
                                    print(f"  ✓ Created Thing {thing_id}: {create_response.status_code}")
                                    success_count += 1
                                else:
                                    print(f"  ✗ Failed to create Thing {thing_id}: {create_response.status_code} - {create_response.text}")
                            except Exception as e:
                                print(f"  ✗ Error creating Thing {thing_id}: {str(e)}")
                                
                except Exception as e:
                    print(f"Error updating {thing_id}: {str(e)}")
                
                # Wait before sending next update
                time.sleep(update_interval)
            
            print(f"Processed {row_count} updates from {csv_file}, {success_count} successful")
            
    except FileNotFoundError:
        print(f"Error: CSV file not found at {csv_file}")
    except Exception as e:
        print(f"An error occurred: {str(e)}")

def find_csv_files_in_dts():
    """Find available CSV files in the DTs directory structure."""
    dts_dir = Path('/home/niels/Documents/Master/Thesis/Code/DTs')
    if not dts_dir.exists():
        # Try relative path
        current_dir = Path.cwd()
        dts_dir = current_dir / 'DTs'
    
    if not dts_dir.exists():
        return []
    
    csv_files = list(dts_dir.glob('**/*.csv'))
    return [str(file) for file in csv_files]

def test_ditto_connection(url, user=None, password=None, auth_token=None):
    """Test the connection to Ditto API."""
    print(f"Testing connection to Ditto at: {url}")
    
    headers = {'Content-Type': 'application/json'}
    if auth_token:
        headers['Authorization'] = f'Bearer {auth_token}'
    
    try:
        if auth_token:
            response = requests.get(url, headers=headers, timeout=5)
        else:
            response = requests.get(url, headers=headers, auth=(user, password), timeout=5)
        
        print(f"Connection test: {response.status_code}")
        if response.status_code == 200:
            print("✓ Connection successful!")
            return True
        elif response.status_code == 401:
            print("✗ Authentication failed. Check your credentials.")
            return False
        else:
            print(f"✗ Connection failed with status code {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("✗ Connection failed. Make sure Ditto is running.")
        return False
    except Exception as e:
        print(f"✗ Connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Simulate CSV-based updates to Eclipse Ditto digital twins.')
    parser.add_argument('--csv', help='Path to the CSV file containing sensor data')
    parser.add_argument('--interval', type=float, default=1.0, help='Time in seconds between updates')
    parser.add_argument('--url', default='http://localhost:8080/api/2/things', help='Base URL for Ditto API')
    parser.add_argument('--user', default='ditto', help='Ditto username')
    parser.add_argument('--password', default='ditto', help='Ditto password')
    parser.add_argument('--token', help='Bearer token for authentication')
    parser.add_argument('--namespace', default='org.eclipse.ditto', help='Default namespace for Thing IDs')
    parser.add_argument('--list-csv', action='store_true', help='List available CSV files in DTs directory')
    parser.add_argument('--test-connection', action='store_true', help='Test connection to Ditto API')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    
    args = parser.parse_args()
    
    if args.list_csv:
        csv_files = find_csv_files_in_dts()
        if csv_files:
            print("Available CSV files in DTs directory:")
            for i, file in enumerate(csv_files, 1):
                print(f"{i}. {file}")
        else:
            print("No CSV files found in DTs directory.")
        exit(0)
    
    # Configuration settings
    CSV_FILE = args.csv
    DITTO_URL = args.url
    DITTO_USER = args.user
    DITTO_PASS = args.password
    AUTH_TOKEN = args.token
    DEFAULT_NAMESPACE = args.namespace
    UPDATE_INTERVAL = args.interval
    DEBUG = args.debug
    
    # Test connection if requested
    if args.test_connection:
        # Strip any thing ID from URL for the test
        base_url = DITTO_URL.split('/api')[0] + '/api/2/things'
        test_ditto_connection(base_url, DITTO_USER, DITTO_PASS, AUTH_TOKEN)
        exit(0)
    
    # If no CSV file is specified, look for one in the DTs directory
    if not CSV_FILE:
        csv_files = find_csv_files_in_dts()
        if csv_files:
            CSV_FILE = csv_files[0]
            print(f"No CSV file specified. Using: {CSV_FILE}")
        else:
            print("Error: No CSV file specified and none found in DTs directory.")
            print("Please specify a CSV file with --csv option or place a CSV file in the DTs directory.")
            exit(1)
    
    simulate_csv_updates(CSV_FILE, DITTO_URL, DITTO_USER, DITTO_PASS, 
                         UPDATE_INTERVAL, AUTH_TOKEN, DEBUG, DEFAULT_NAMESPACE)
