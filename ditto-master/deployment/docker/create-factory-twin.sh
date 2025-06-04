#!/bin/bash
# Script to initialize the Factory digital twin in Ditto

# Define variables
DITTO_HOST="54.217.116.62"
DITTO_PORT="8080"
THING_ID="org.eclipse.ditto:Factory"
AUTH="ditto:ditto"
AUTH_HEADER=$(echo -n $AUTH | base64)

echo "Creating Factory digital twin on $DITTO_HOST:$DITTO_PORT"

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
      },
      "Mixer_1": {
        "properties": {
          "Temperature": 100,
          "RPM": 60
        }
      },
      "Mixer_1_AlarmComponent": {
        "properties": {
          "alarm_status": "NORMAL"
        }
      },
      "Mixer_2": {
        "properties": {
          "Temperature": 100,
          "RPM": 60
        }
      },
      "Mixer_2_AlarmComponent": {
        "properties": {
          "alarm_status": "NORMAL"
        }
      },
      "Mixer_3": {
        "properties": {
          "Temperature": 100,
          "RPM": 60
        }
      },
      "Mixer_3_AlarmComponent": {
        "properties": {
          "alarm_status": "NORMAL"
        }
      },
      "Mixer_4": {
        "properties": {
          "Temperature": 100,
          "RPM": 60
        }
      },
      "Mixer_4_AlarmComponent": {
        "properties": {
          "alarm_status": "NORMAL"
        }
      },
      "Mixer_5": {
        "properties": {
          "Temperature": 100,
          "RPM": 60
        }
      },
      "Mixer_5_AlarmComponent": {
        "properties": {
          "alarm_status": "NORMAL"
        }
      },
      "WaterTank": {
        "properties": {
          "flowRate1": 35,
          "tankVolume1": 75,
          "Status": "NORMAL"
        }
      },
      "FreezerTunnel": {
        "properties": {
          "Temperature": -15,
          "State": "NORMAL"
        }
      },
      "PlasticLiner": {
        "properties": {
          "RPM": 45,
          "Status": "NORMAL"
        }
      },
      "CookieFormer": {
        "properties": {
          "Rate": 120,
          "GoodParts": 98.5,
          "Status": "NORMAL"
        }
      },
      "BoxSealer": {
        "properties": {
          "Speed": 0.8,
          "Status": "NORMAL"
        }
      },
      "Conveyor": {
        "properties": {
          "Speed": 0.8,
          "Status": "NORMAL"
        }
      }
    }
  }'

echo -e "\nFactory digital twin setup complete."