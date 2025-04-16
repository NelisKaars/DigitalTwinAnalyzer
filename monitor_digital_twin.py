#!/usr/bin/env python3
import websocket
import json
import threading
import time
import base64
import getpass
import argparse

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
    
    return auth_b64

def on_message(ws, message):
    """Handle incoming WebSocket messages"""
    try:
        data = json.loads(message)
        
        # Print a cleaner representation of the data
        print("\n--- Digital Twin Update ---")
        
        if 'topic' in data:
            topic_parts = data['topic'].split('/')
            if len(topic_parts) >= 2:
                thing_id = topic_parts[1]
                print(f"Thing ID: {thing_id}")
            
        if 'path' in data:
            print(f"Path: {data['path']}")
            
        if 'value' in data:
            if isinstance(data['value'], dict):
                print("Value:")
                for key, val in data['value'].items():
                    print(f"  {key}: {val}")
            else:
                print(f"Value: {data['value']}")
                
            # Specifically track Mixer properties if they exist
            if 'features' in data['value']:
                features = data['value']['features']
                
                # Check for Mixer properties
                if 'Mixer' in features and 'properties' in features['Mixer']:
                    props = features['Mixer']['properties']
                    if 'Temperature' in props:
                        print(f"Temperature: {props['Temperature']}")
                    if 'RPM' in props:
                        print(f"RPM: {props['RPM']}")
                
                # Check for Alarm status
                if 'Alarm' in features and 'properties' in features['Alarm']:
                    props = features['Alarm']['properties']
                    if 'alarm_status' in props:
                        print(f"Alarm Status: {props['alarm_status']}")
    except Exception as e:
        print(f"Error processing message: {e}")
        print(f"Raw message: {message}")

def on_error(ws, error):
    print(f"Error: {error}")

def on_close(ws, close_status_code, close_reason):
    print("Connection closed")

def on_open(ws):
    print("Connection opened")
    
    # Subscribe to all changes of the Mixer thing
    subscribe_msg = {
        "topic": "org.eclipse.ditto/twin-1/things/twin/commands/modify",
        "path": "/",
        "headers": {},
        "value": {
            "topic": "org.eclipse.ditto/_/_/things/twin/commands/modify",
            "path": "/"
        }
    }
    ws.send(json.dumps(subscribe_msg))
    
    # Subscribe to events
    subscribe_events = {
        "topic": "org.eclipse.ditto/twin-1/things/twin/events/subscribe",
        "path": "/",
        "headers": {},
    }
    ws.send(json.dumps(subscribe_events))
    
    print("Subscribed to digital twin updates. Waiting for changes...")

def keep_alive(ws):
    """Send a ping every 30 seconds to keep the connection alive"""
    while ws.keep_running:
        time.sleep(30)
        ping_message = {
            "topic": "org.eclipse.ditto/ping/things/twin/commands/modify",
            "path": "/",
            "headers": {},
            "value": "ping"
        }
        ws.send(json.dumps(ping_message))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Monitor Digital Twin updates via WebSocket')
    parser.add_argument('--username', help='Username for Ditto authentication')
    parser.add_argument('--password', help='Password for Ditto authentication')
    parser.add_argument('--url', default='ws://localhost:8080/ws/2', help='Ditto WebSocket URL (default: ws://localhost:8080/ws/2)')
    
    args = parser.parse_args()
    
    # Get authentication
    auth_b64 = get_auth_header(args.username, args.password)
    
    # WebSocket URL for Ditto - adjust port if needed
    ws_url = args.url
    
    # Initialize WebSocket connection with authentication
    websocket.enableTrace(False)
    
    # Add auth headers in a custom header
    header = {
        "Authorization": f"Basic {auth_b64}"
    }
    
    ws = websocket.WebSocketApp(
        ws_url,
        header=header,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close
    )
    
    # Start a keep-alive thread
    keep_alive_thread = threading.Thread(target=keep_alive, args=(ws,))
    keep_alive_thread.daemon = True
    keep_alive_thread.start()
    
    print(f"Connecting to {ws_url}...")
    
    # Start the WebSocket connection
    ws.run_forever()