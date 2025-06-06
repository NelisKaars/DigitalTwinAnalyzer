# Eclipse Ditto :: Docker Deployment (Modified for AWS)

⚠️ **This is a modified version of Eclipse Ditto** configured for AWS deployment and digital twin visualization research.

## Modifications from Original Eclipse Ditto

This deployment includes custom modifications to support:
- AWS EC2 deployment with proper CORS configuration
- Fixed Ditto UI localhost connection issues for cloud deployment  
- Pre-configured Factory digital twin for visualization testing
- Cross-origin communication between separate frontend/backend instances

### Files Added:
- `ui-environments.json` - UI environment configuration for AWS deployment
- `create-factory-twin.sh` - Factory digital twin initialization script

### Files Modified:
- `nginx.conf` - Added AWS server IP (54.217.116.62) and custom endpoints
- `nginx-cors.conf` - Updated CORS settings for cross-origin access
- `docker-compose.yml` - Added UI environment configuration mounting

## AWS Deployment Instructions

### Prerequisites
- AWS EC2 instance with Docker and Docker Compose installed
- Security group allowing inbound traffic on port 8080
- At least 4GB RAM and 2 CPU cores

### Deployment Steps

1. **Clone and navigate to deployment directory:**
   ```bash
   git clone https://github.com/NelisKaars/DigitalTwinAnalyzer.git
   cd DigitalTwinAnalyzer/ditto-master/deployment/docker/
   ```

2. **Update server configuration (if using different IP):**
   - Edit `nginx.conf` and replace `54.217.116.62` with your server IP
   - Edit `ui-environments.json` and update the `api_uri` field
   - Edit `create-factory-twin.sh` and update `DITTO_HOST`

3. **Start Ditto services:**
   ```bash
   docker-compose up -d
   ```

4. **Wait for services to start (typically 30-60 seconds):**
   ```bash
   docker-compose logs -f
   ```

5. **Initialize Factory digital twin:**
   ```bash
   chmod +x create-factory-twin.sh
   ./create-factory-twin.sh
   ```

### Verification

1. **Check Ditto UI:** `http://YOUR_SERVER_IP:8080/ui/`
   - Should load without "CONNECTION_REFUSED" errors
   - Environment should automatically select "aws_production"

2. **Verify API access:** `http://YOUR_SERVER_IP:8080/api/2/things`
   - Should return Factory digital twin data

3. **Test CORS:** Cross-origin requests from your frontend should work

### Factory Digital Twin Structure

The pre-configured Factory twin includes:
- **Mixers (0-5):** Temperature and RPM monitoring with alarm components
- **Water Tank:** Flow rate and volume monitoring  
- **Freezer Tunnel:** Temperature control
- **Plastic Liner:** RPM monitoring
- **Cookie Former:** Production rate and quality metrics
- **Box Sealer & Conveyor:** Speed monitoring

Access via: `GET /api/2/things/org.eclipse.ditto:Factory`

## Troubleshooting

### Common Issues:

1. **UI shows "CONNECTION_REFUSED":**
   - Verify `ui-environments.json` has correct server IP
   - Check nginx container has the file mounted properly

2. **CORS errors from frontend:**
   - Verify `nginx-cors.conf` allows your frontend domain
   - Check nginx configuration is loaded correctly

3. **Factory twin not created:**
   - Run `./create-factory-twin.sh` manually
   - Check Ditto services are fully started before running script

### Logs and Debugging:
```bash
# Check all service logs
docker-compose logs

# Check specific service
docker-compose logs gateway

# Verify nginx configuration
docker exec <nginx-container> nginx -t
```

## License and Attribution

- **Base Project:** Eclipse Ditto - https://github.com/eclipse-ditto/ditto
- **License:** Eclipse Public License 2.0
- **Modifications:** Custom deployment configuration for digital twin visualization research

For the original Eclipse Ditto documentation, see: https://www.eclipse.dev/ditto/