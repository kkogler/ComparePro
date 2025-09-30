# Fixed IP Proxy Setup Guide for Lipsey's API Integration

## Overview
This guide details the setup of a fixed IP proxy server to enable Lipsey's API integration. Lipsey's requires all API requests to come from a whitelisted IP address. This proxy solution provides a static IP that works for both development and production environments.

---

## Part 1: Infrastructure Setup (Digital Ocean)

### Step 1: Create Digital Ocean Droplet

1. **Log in to Digital Ocean** and navigate to "Create" → "Droplets"

2. **Select Configuration:**
   - **Image:** Ubuntu 22.04 LTS
   - **Plan:** Basic ($4-6/month)
   - **CPU Options:** Regular Intel (1GB RAM / 1 vCPU is sufficient)
   - **Datacenter Region:** Choose closest to your primary user base
   - **Authentication:** SSH keys (recommended) or password

3. **Create the Droplet** and note the assigned **Static IP Address**

4. **Important:** This IP address is **permanent** and will not change unless you delete the droplet

---

### Step 2: Install and Configure Squid Proxy

SSH into your droplet:

```bash
ssh root@YOUR_DROPLET_IP
```

#### Install Squid:

```bash
# Update system packages
apt update && apt upgrade -y

# Install Squid proxy server
apt install squid -y

# Install Apache utilities for password management
apt install apache2-utils -y
```

#### Configure Squid:

1. **Backup the original config:**
```bash
cp /etc/squid/squid.conf /etc/squid/squid.conf.backup
```

2. **Create new configuration:**
```bash
nano /etc/squid/squid.conf
```

3. **Replace with this configuration:**

```squid
# Squid Proxy Configuration for Lipsey's API
# Authentication and access control

# Define authentication program
auth_param basic program /usr/lib/squid/basic_ncsa_auth /etc/squid/passwords
auth_param basic realm Lipsey's API Proxy
auth_param basic credentialsttl 2 hours

# Define ACLs (Access Control Lists)
acl authenticated_users proxy_auth REQUIRED
acl SSL_ports port 443
acl CONNECT method CONNECT
acl lipsey_api dstdomain .lipseys.com

# Allow authenticated users to access Lipsey's API
http_access allow authenticated_users lipsey_api
http_access allow authenticated_users CONNECT SSL_ports lipsey_api

# Deny all other access
http_access deny all

# Proxy port
http_port 3128

# Disable caching (pass-through proxy)
cache deny all

# Logging
access_log /var/log/squid/access.log squid
cache_log /var/log/squid/cache.log

# Forwarded-For header (shows original client IP in logs)
forwarded_for on

# DNS settings
dns_nameservers 8.8.8.8 8.8.4.4
```

#### Create Proxy Authentication:

```bash
# Create password file with username and password
# Replace YOUR_USERNAME and YOUR_PASSWORD with secure credentials
htpasswd -c /etc/squid/passwords YOUR_USERNAME

# You'll be prompted to enter a password
# Generate a strong password (minimum 20 characters recommended)

# Set proper permissions
chmod 640 /etc/squid/passwords
chown root:proxy /etc/squid/passwords
```

#### Start and Enable Squid:

```bash
# Test configuration
squid -k parse

# If no errors, restart Squid
systemctl restart squid

# Enable Squid to start on boot
systemctl enable squid

# Check status
systemctl status squid
```

---

### Step 3: Configure Firewall

```bash
# Install UFW (Uncomplicated Firewall)
apt install ufw -y

# Allow SSH (IMPORTANT: Do this first to avoid lockout)
ufw allow 22/tcp

# Allow proxy port
ufw allow 3128/tcp

# Enable firewall
ufw enable

# Check status
ufw status
```

---

### Step 4: Configure SSL/TLS Support (for HTTPS proxying)

```bash
# Generate SSL certificate (self-signed for proxy use)
mkdir -p /etc/squid/ssl
cd /etc/squid/ssl

openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509 \
  -keyout squid-proxy.key \
  -out squid-proxy.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=proxy.yourdomain.com"

# Set permissions
chmod 400 squid-proxy.key
chmod 444 squid-proxy.crt

# Restart Squid
systemctl restart squid
```

---

### Step 5: Test Proxy Connectivity

From your local machine:

```bash
# Test HTTP connectivity through proxy
curl -x http://YOUR_USERNAME:YOUR_PASSWORD@YOUR_DROPLET_IP:3128 http://api.checkip.org

# Test HTTPS connectivity
curl -x http://YOUR_USERNAME:YOUR_PASSWORD@YOUR_DROPLET_IP:3128 https://api.checkip.org

# Both should return the proxy's IP address
```

---

### Step 6: Whitelist Proxy IP with Lipsey's

**Contact Lipsey's support and provide:**
- **Proxy IP Address:** `YOUR_DROPLET_IP`
- **Request:** Whitelist this IP for API access
- **Note:** This IP will be used for both development and production environments

---

## Part 2: Application Configuration (Replit)

### Step 1: Add Environment Variables

Add these secrets to your Replit project (both development and production):

```bash
# Proxy Configuration
PROXY_HOST=YOUR_DROPLET_IP
PROXY_PORT=3128
PROXY_USERNAME=YOUR_USERNAME
PROXY_PASSWORD=YOUR_PASSWORD
```

**How to add in Replit:**
1. Go to Replit project
2. Click "Secrets" (lock icon) in left sidebar
3. Add each variable above
4. For production deployment, add to deployment secrets as well

---

### Step 2: Update Lipsey API Client

The application code has been updated to use the proxy. Here's what changed:

**File: `server/lipsey-api.ts`**

The Lipsey API client now automatically detects and uses proxy configuration:

```typescript
// Proxy configuration from environment
const proxyConfig = process.env.PROXY_HOST ? {
  host: process.env.PROXY_HOST,
  port: parseInt(process.env.PROXY_PORT || '3128'),
  auth: process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD 
    ? `${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}` 
    : undefined
} : undefined;
```

**No code changes needed** - the application will automatically use the proxy when environment variables are present.

---

### Step 3: Redeploy Application

After adding environment variables:

1. **Development:** Restart the workflow (changes apply automatically)
2. **Production:** Redeploy the application to apply new environment variables

---

## Part 3: Monitoring and Maintenance

### View Proxy Logs

```bash
# SSH into droplet
ssh root@YOUR_DROPLET_IP

# View access logs (real-time)
tail -f /var/log/squid/access.log

# View error logs
tail -f /var/log/squid/cache.log

# Search for Lipsey's API calls
grep "lipseys.com" /var/log/squid/access.log
```

### Common Issues and Troubleshooting

**Issue: Proxy authentication fails**
```bash
# Verify password file exists
cat /etc/squid/passwords

# Re-create password if needed
htpasswd /etc/squid/passwords YOUR_USERNAME
systemctl restart squid
```

**Issue: Cannot connect to proxy**
```bash
# Check if Squid is running
systemctl status squid

# Check firewall
ufw status

# Restart Squid
systemctl restart squid
```

**Issue: Lipsey's API calls failing**
```bash
# Test from droplet directly (should work if IP is whitelisted)
curl https://api.lipseys.com/api/Integration/Items/CatalogFeed

# Check Squid logs for errors
tail -50 /var/log/squid/cache.log
```

### Security Best Practices

1. **Rotate proxy password quarterly:**
   ```bash
   htpasswd /etc/squid/passwords YOUR_USERNAME
   systemctl restart squid
   ```
   Update `PROXY_PASSWORD` secret in Replit

2. **Keep system updated:**
   ```bash
   apt update && apt upgrade -y
   systemctl restart squid
   ```

3. **Monitor access logs weekly:**
   ```bash
   # Check for unauthorized access attempts
   grep "TCP_DENIED" /var/log/squid/access.log
   ```

4. **Backup configuration:**
   ```bash
   cp /etc/squid/squid.conf /etc/squid/squid.conf.backup.$(date +%Y%m%d)
   ```

---

## Part 4: Cost and Performance

### Cost Breakdown (Digital Ocean)
- **Droplet:** $4-6/month (Basic plan)
- **Bandwidth:** 1TB included (Lipsey API calls use minimal bandwidth)
- **Total:** ~$5/month

### Performance Characteristics
- **Latency:** +10-50ms (depending on droplet location)
- **Throughput:** Handles 1000s of requests/hour easily
- **Reliability:** 99.9% uptime (Digital Ocean SLA)

### Scaling Considerations
- Current setup handles **both dev and production** without issues
- If traffic increases significantly, upgrade droplet to next tier ($12/month)
- Can implement load balancing with multiple proxies if needed

---

## Quick Reference

### Key Information Summary

| Item | Value |
|------|-------|
| **Proxy IP** | `YOUR_DROPLET_IP` (to be filled after setup) |
| **Proxy Port** | `3128` |
| **Protocol** | HTTP/HTTPS |
| **Authentication** | Basic Auth (username/password) |
| **Whitelist Target** | Lipsey's API (`*.lipseys.com`) |
| **Log Location** | `/var/log/squid/access.log` |
| **Config Location** | `/etc/squid/squid.conf` |

### Environment Variables for Replit

```bash
PROXY_HOST=YOUR_DROPLET_IP
PROXY_PORT=3128
PROXY_USERNAME=YOUR_USERNAME
PROXY_PASSWORD=YOUR_STRONG_PASSWORD
```

### Critical Commands

```bash
# Restart proxy
systemctl restart squid

# View logs
tail -f /var/log/squid/access.log

# Test connectivity
curl -x http://USER:PASS@IP:3128 https://api.lipseys.com
```

---

## Support Contacts

**Digital Ocean Support:** https://www.digitalocean.com/support
**Lipsey's API Support:** Contact your Lipsey's account representative
**Replit Support:** https://replit.com/support

---

## Appendix: Alternative Proxy Solutions

If Digital Ocean is not preferred, these alternatives work identically:

1. **AWS EC2:** Use t3.micro instance with Elastic IP
2. **Google Cloud:** Use e2-micro instance with static IP
3. **Linode:** Use Nanode 1GB with static IP
4. **Vultr:** Use $3.50/month plan with reserved IP

Configuration steps are nearly identical across all providers.

---

**Document Version:** 1.0  
**Last Updated:** September 30, 2025  
**Prepared for:** DevOps Implementation
