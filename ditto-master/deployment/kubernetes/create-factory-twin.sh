#!/bin/bash
# Script to initialize the Factory digital twin in Ditto for Kubernetes deployment

# Define variables
DITTO_HOST="nginx-service"  # Kubernetes service name
DITTO_PORT="80"             # Internal service port
THING_ID="org.eclipse.ditto:Factory"
AUTH="ditto:ditto"
AUTH_HEADER=$(echo -n $AUTH | base64)

echo "Creating Factory digital twin on $DITTO_HOST:$DITTO_PORT"

# Wait for Ditto services to be fully available
echo "Waiting for Ditto API to become available..."
MAX_RETRIES=30
RETRY_COUNT=0
RETRY_DELAY=5

# Function to check if Ditto API is available
check_ditto_available() {
  curl --silent --max-time 2 "http://$DITTO_HOST:$DITTO_PORT/status" > /dev/null
  return $?
}

# Wait for Ditto API to be available
while ! check_ditto_available; do
  RETRY_COUNT=$((RETRY_COUNT+1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "Ditto API not available after $MAX_RETRIES retries. Proceeding anyway..."
    break
  fi
  echo "Waiting for Ditto API to become available (retry $RETRY_COUNT/$MAX_RETRIES)..."
  sleep $RETRY_DELAY
done

# Check if the thing already exists
echo "Checking if Factory twin already exists..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 5 \
  -X GET \
  -H "Authorization: Basic $AUTH_HEADER" \
  "http://$DITTO_HOST:$DITTO_PORT/api/2/things/$THING_ID")

if [ "$STATUS" -eq 200 ]; then
  echo "Factory twin already exists."
  exit 0
fi

echo "Creating Factory twin..."

# Create policy first (required before creating a thing)
echo "Creating policy..."
curl --max-time 5 \
  -X PUT \
  -H "Authorization: Basic $AUTH_HEADER" \
  -H "Content-Type: application/json" \
  "http://$DITTO_HOST:$DITTO_PORT/api/2/policies/$THING_ID" \
  -d '{
    "entries": {
      "owner": {
        "subjects": {
          "nginx:ditto": {
            "type": "nginx basic auth user"
          }
        },
        "resources": {
          "thing:/": {
            "grant": ["READ", "WRITE"],
            "revoke": []
          },
          "policy:/": {
            "grant": ["READ", "WRITE"],
            "revoke": []
          },
          "message:/": {
            "grant": ["READ", "WRITE"],
            "revoke": []
          }
        }
      }
    }
  }'

echo -e "\nCreating thing with features..."
curl --max-time 5 \
  -X PUT \
  -H "Authorization: Basic $AUTH_HEADER" \
  -H "Content-Type: application/json" \
  "http://$DITTO_HOST:$DITTO_PORT/api/2/things/$THING_ID" \
  -d '{
    "policyId": "'"$THING_ID"'",
    "definition": "org.eclipse.ditto:factory:1.0.0",
    "features": {
      "Mixer_0": {
        "properties": {
          "Temperature": 100,
          "RPM": 60
        }
      },
      "Mixer_0_AlarmComponent": {
        "properties": {
          "alarm_status": "NORMAL"
        }
      }
    }
  }'

echo -e "\nFactory digital twin setup complete."