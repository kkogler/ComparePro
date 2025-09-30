#!/bin/bash
# DigitalOcean Droplet Proxy Setup Script
# Run this script after creating your DO droplet with reserved IP

echo "Setting up proxy for vendor API calls..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install nginx
sudo apt install nginx -y

# Create nginx configuration for Lipsey's API proxy
sudo tee /etc/nginx/sites-available/vendor-proxy > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    
    # Lipsey's API proxy
    location /lipsey/ {
        proxy_pass https://api.lipseys.com/;
        proxy_set_header Host api.lipseys.com;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Handle CORS if needed
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
        
        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    # Health check endpoint
    location /health {
        return 200 'Proxy is running';
        add_header Content-Type text/plain;
    }
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/vendor-proxy /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Start and enable nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Configure firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw --force enable

echo "Proxy setup complete!"
echo "Test with: curl http://YOUR_DROPLET_IP/health"
echo "Proxy Lipsey's API calls to: http://YOUR_DROPLET_IP/lipsey/api/Integration/..."