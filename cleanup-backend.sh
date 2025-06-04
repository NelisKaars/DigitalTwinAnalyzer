#!/bin/bash
# Cleanup script for backend EC2 instance
# Run with: ssh -i path/to/your-key.pem ec2-user@your-backend-ip 'bash -s' < cleanup-backend.sh

echo "===== STARTING COMPLETE BACKEND CLEANUP ====="

# Stop running containers and services
echo "Stopping running containers and services..."
sudo systemctl stop ditto-redirect || true
sudo systemctl disable ditto-redirect || true
sudo systemctl stop k3s || true
sudo systemctl disable k3s || true
sudo pkill socat || true

# Stop and remove Docker containers
echo "Cleaning up Docker..."
sudo docker ps -a -q | xargs -r sudo docker stop || true
sudo docker ps -a -q | xargs -r sudo docker rm || true
sudo docker volume prune -f || true
sudo docker network prune -f || true
sudo docker system prune -af || true

# Remove all Docker images
echo "Removing all Docker images..."
sudo docker rmi $(sudo docker images -q) || true

# Remove K3s if installed
echo "Removing K3s if installed..."
if [ -f /usr/local/bin/k3s-uninstall.sh ]; then
  sudo /usr/local/bin/k3s-uninstall.sh || true
fi

# Clean up systemd services
echo "Cleaning up systemd services..."
sudo rm -f /etc/systemd/system/ditto-redirect.service || true
sudo rm -f /etc/systemd/system/local-proxy.service || true
sudo systemctl daemon-reload || true

# Clean up app directory
echo "Cleaning up application directory..."
rm -rf ~/app/* || true

# Clean up SSH keys and configuration
echo "Cleaning up SSH configuration..."
rm -f ~/.ssh/id_rsa* || true
rm -f ~/.backend_url || true

# Clean up temporary files
echo "Cleaning up temporary files and cache..."
sudo dnf clean all || true
sudo rm -rf /var/cache/dnf/* || true
sudo rm -rf /tmp/* || true
sudo journalctl --vacuum-size=1M || true

# Check disk space after cleanup
echo "Current disk space:"
df -h /

echo "===== CLEANUP COMPLETE ====="
echo "You can now run the deployment workflow again."