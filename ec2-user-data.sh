#!/bin/bash
# EC2 User Data script for the Ditto Backend instance

# Update system packages
dnf update -y

# Install required packages
dnf install -y git docker socat

# Enable and start Docker service
systemctl enable --now docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create app directory and set permissions
mkdir -p /home/ec2-user/app
chown ec2-user:ec2-user /home/ec2-user/app

# Set up SSH directory with proper permissions
mkdir -p /home/ec2-user/.ssh
chmod 700 /home/ec2-user/.ssh
touch /home/ec2-user/.ssh/authorized_keys
chmod 600 /home/ec2-user/.ssh/authorized_keys
chown -R ec2-user:ec2-user /home/ec2-user/.ssh

# Create port forwarding service for Ditto
cat > /etc/systemd/system/ditto-redirect.service << 'EOF'
[Unit]
Description=Ditto Port Redirect
After=docker.service

[Service]
ExecStart=/usr/bin/socat TCP-LISTEN:8080,fork TCP:localhost:80
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Enable the port forwarding service
systemctl daemon-reload
systemctl enable ditto-redirect.service
systemctl start ditto-redirect.service

# Allow ec2-user to use docker without sudo
usermod -aG docker ec2-user

# Add your public key to authorized_keys
cat >> /home/ec2-user/.ssh/authorized_keys << 'EOF'
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC1nGmIzJIfpHWmWtDnUDbdW4toTYQZxMJRzcnbK8Da3fL9ZWpqx8HBnLuh0Rg6UsPpvquEN1mQMpiuykT32WmHfey4l5sGPYdHTn5P0bFnlk2vp+u+LvHvbeGow5NbH315pUBIxdqRjjWHQ3+rU6z1CaM/5JPELp6qw+2gJMucMPwWXL5NBN/UlO37zZQJCrsicFDksD+ludpO1WSzPUJdgcKcAR3kcaMMLFTXSvnXjXV7V1YYkgM3v3oILJmW4ypxsSytcdd3URO2A/hfCvoEE6fMI++gULbTuIYDGCrghZ87E2lH/s2M5Mx3rlViUJTjkx1qsHDlZuC/A/o9/HhtooboW/VywKlNZAhD4K2xjTlF4VRn6xbd+YN1HMMSaRn2Q5yMtJdgemeCNeVT9LwZWgSyOalUZ4IC6NrLX1ZOxuDNAsYYe1R4EhA7iFN4VB06GAHNEJ/BtehC/L31k1Bg5Or/IQ+eJmL7tt9wSSGeh0rkMGpRQV+7F2r/mU7pw3M= deploy_key
EOF

# Set correct ownership for authorized_keys
chown ec2-user:ec2-user /home/ec2-user/.ssh/authorized_keys

echo "EC2 instance setup complete!"