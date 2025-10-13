![image](image.png)# DevOps Quick Start: Fixed IP Proxy Setup

## What You Need to Do

Set up a fixed IP proxy server so our application can access Lipsey's API (they require IP whitelisting).

## Time Required
30-45 minutes for initial setup

## What You'll Deliver
After setup, provide these 4 values to the development team:
1. **Proxy IP Address** (e.g., `123.45.67.89`)
2. **Proxy Port** (typically `3128`)
3. **Proxy Username** (you choose)
4. **Proxy Password** (you choose - make it strong)

---

## Setup Steps (High Level)

### 1. Create Digital Ocean Droplet
- **Image**: Ubuntu 22.04 LTS
- **Plan**: Basic ($4-6/month)
- **Size**: 1GB RAM / 1 vCPU
- **Region**: Choose closest to production
- **Note the static IP address assigned**

### 2. Install Squid Proxy
SSH into the droplet and run:
```bash
apt update && apt upgrade -y
apt install squid apache2-utils -y
```

### 3. Configure Squid
Full configuration provided in `PROXY_SETUP_GUIDE.md` (Section: Part 1, Step 2)

Key points:
- Allow authenticated access only
- Restrict to specific domains (lipseys.com, etc.)
- No caching (pass-through proxy)

### 4. Create Proxy Credentials
```bash
htpasswd -c /etc/squid/passwords YOUR_USERNAME
# Enter a strong password when prompted
```

### 5. Configure Firewall
```bash
apt install ufw -y
ufw allow 22/tcp
ufw allow 3128/tcp
ufw enable
```

### 6. Start Squid
```bash
systemctl restart squid
systemctl enable squid
```

### 7. Test Connectivity
From your local machine:
```bash
curl -x http://USERNAME:PASSWORD@DROPLET_IP:3128 https://api.lipseys.com
```

Should return a response (even if 401 unauthorized - that's expected without auth token)

### 8. Deliver Credentials
Provide to development team via secure channel:
- Proxy IP: `YOUR_DROPLET_IP`
- Proxy Port: `3128`
- Proxy Username: `YOUR_USERNAME`
- Proxy Password: `YOUR_PASSWORD`

---

## After Setup

### Development Team Will:
1. Add your 4 values as Replit environment variables
2. Contact Lipsey's to whitelist your proxy IP
3. Redeploy the application
4. Test Lipsey's API integration

### Your Ongoing Responsibilities:
- **Keep droplet running** (it's the fixed IP source)
- **Monitor logs** occasionally (see PROXY_SETUP_GUIDE.md Part 3)
- **Rotate password** quarterly (see guide for procedure)
- **Keep system updated** monthly

### Monitoring
View proxy access logs:
```bash
ssh root@YOUR_DROPLET_IP
tail -f /var/log/squid/access.log
```

### Troubleshooting
Common issues and fixes in `PROXY_SETUP_GUIDE.md` Part 3

---

## Important Notes

✅ **IP is permanent** - As long as the droplet exists, the IP won't change
✅ **Works for dev & production** - Both environments use same proxy
✅ **No redeployment needed** - Proxy changes don't require app redeployment
⚠️ **Don't delete droplet** - Deleting it changes the IP (requires re-whitelisting with Lipsey's)

---

## Cost Breakdown
- **Droplet**: $4-6/month
- **Bandwidth**: Included (1TB)
- **Total**: ~$5/month ongoing

---

## Alternative Providers
If you prefer not to use Digital Ocean:
- **AWS EC2**: t3.micro with Elastic IP
- **Google Cloud**: e2-micro with static IP  
- **Linode**: Nanode 1GB
- **Vultr**: $3.50/month plan

Setup is nearly identical across all providers.

---

## Full Documentation
See `PROXY_SETUP_GUIDE.md` for:
- Complete step-by-step instructions
- Full Squid configuration file
- Security best practices
- Detailed troubleshooting guide
- Monitoring and maintenance procedures

---

## Questions?
Contact the development team or refer to the complete guide.

**Document prepared**: September 30, 2025
