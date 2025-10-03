# DevOps Configuration Guide: Fixed IP Setup for BestPrice Platform

## Overview
This guide provides your DevOps team with the specific configuration needed to set up a DigitalOcean reverse proxy for the BestPrice platform, giving it a fixed IP address for vendor API whitelisting.

## Required Information for DevOps Team

### 1. Current Replit App Details
- **Replit App URL**: `https://pricecompare-pro.replit.app` (UPDATE THIS AFTER DEPLOYMENT)
- **Application Type**: Full-stack Node.js/Express application  
- **Key Endpoints**: REST APIs for vendor integrations (Lipsey's, Chattanooga, Sports South)
- **Required Headers**: Application expects `X-Real-IP` and `X-Forwarded-For` for proper client IP detection
- **Note**: Replace the URL above with your actual deployment URL from Replit Deployments

### 2. DigitalOcean Droplet Specifications
- **OS**: Ubuntu 22.04 LTS
- **Size**: Basic Droplet ($4/month) - 1GB RAM, 1 vCPU, 25GB SSD
- **Location**: Choose datacenter closest to primary users
- **Networking**: Enable IPv4, IPv6 optional

### 3. Nginx Configuration File
**File Location**: `/etc/nginx/sites-available/bestprice-proxy`

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_DROPLET_IP;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Main application proxy
    location / {
        proxy_pass https://pricecompare-pro.replit.app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        # WebSocket support for real-time features
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeout settings for API calls
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;
        
        # Handle large requests (file uploads)
        client_max_body_size 50M;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### 4. Firewall Configuration (UFW)
```bash
# Allow SSH (port 22)
ufw allow OpenSSH

# Allow HTTP and HTTPS
ufw allow 'Nginx Full'

# Enable firewall
ufw --force enable
```

### 5. SSL Configuration (If domain is available)
```bash
# Install SSL certificate
certbot --nginx -d yourdomain.com

# Auto-renewal test
certbot renew --dry-run
```

### 6. Required Software Installation Commands
```bash
# Update system
apt update && apt upgrade -y

# Install required packages
apt install nginx certbot python3-certbot-nginx ufw fail2ban -y

# Enable services
systemctl enable nginx
systemctl enable fail2ban
```

### 7. Monitoring and Logging Setup
```bash
# Create log directory
mkdir -p /var/log/bestprice

# Nginx log configuration (add to nginx config)
access_log /var/log/nginx/bestprice_access.log;
error_log /var/log/nginx/bestprice_error.log;

# Log rotation
cat > /etc/logrotate.d/bestprice << 'EOF'
/var/log/nginx/bestprice_*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx
    endscript
}
EOF
```

## Critical Configuration Steps

### Step 1: Enable Nginx Site
```bash
# Remove default site
rm /etc/nginx/sites-enabled/default

# Enable BestPrice proxy
ln -s /etc/nginx/sites-available/bestprice-proxy /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Restart nginx
systemctl restart nginx
```

### Step 2: Configure Application Trust Proxy
The Replit application needs this setting to properly handle proxy headers:
```javascript
// In Express server setup (already configured in BestPrice)
app.set('trust proxy', 1);
```

### Step 3: Test Configuration
```bash
# Test basic connectivity
curl -I http://DROPLET_IP

# Test with headers
curl -H "X-Forwarded-For: 192.168.1.1" http://DROPLET_IP/api/health

# Monitor logs
tail -f /var/log/nginx/access.log
```

## Security Enhancements

### 1. Fail2Ban Configuration
```bash
# Create jail for nginx
cat > /etc/fail2ban/jail.d/nginx.conf << 'EOF'
[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true

[nginx-botsearch]
enabled = true
EOF

systemctl restart fail2ban
```

### 2. Rate Limiting (Add to nginx config)
```nginx
# Add to http block in /etc/nginx/nginx.conf
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general:10m rate=2r/s;
}

# Add to server block
location /api/ {
    limit_req zone=api burst=20 nodelay;
    # ... rest of proxy config
}
```

## Vendor API Integration Benefits

Once this setup is complete, you'll have a fixed IP address that can be whitelisted with:

1. **Lipsey's API**: For enhanced rate limits and priority access
2. **Chattanooga Shooting Supplies**: For reliable API access
3. **Sports South**: When credentials are obtained
4. **Future Vendor Integrations**: Immediate compatibility

## Monthly Costs
- **DigitalOcean Droplet**: $4/month (Basic)
- **Bandwidth**: 1TB included (sufficient for most usage)
- **SSL Certificate**: Free (Let's Encrypt)
- **Total**: ~$4-5/month

## Maintenance Commands
```bash
# Security updates (monthly)
apt update && apt upgrade -y

# Check services
systemctl status nginx
systemctl status fail2ban

# View logs
tail -f /var/log/nginx/bestprice_access.log
tail -f /var/log/nginx/bestprice_error.log

# Test SSL renewal
certbot renew --dry-run
```

## Emergency Procedures

### If Nginx Fails
```bash
# Check configuration
nginx -t

# Restart service
systemctl restart nginx

# Check logs
journalctl -u nginx -f
```

### If Droplet Becomes Unresponsive
1. Use DigitalOcean console access
2. Check system resources: `htop`, `df -h`
3. Restart services: `systemctl restart nginx`
4. Reboot if necessary: `reboot`

## Contact Information
- **Platform**: BestPrice Multi-Tenant B2B Platform
- **Technology Stack**: Node.js, Express, PostgreSQL, React
- **Primary Use Case**: Vendor API integrations requiring fixed IP
- **Support**: [Your contact information for DevOps team]

---

**Note**: After deploying your Replit app, replace `https://pricecompare-pro.replit.app` with your actual deployment URL from the Replit Deployments overview tab.