# Lipsey's API Proxy Integration Guide

## DigitalOcean Setup Steps

### 1. Create Droplet
- Ubuntu 22.04 LTS
- $4/month basic plan (1GB RAM, 1 vCPU)  
- Add your SSH key

### 2. Add Reserved IP
- Go to Networking → Reserved IPs
- Create and assign to droplet
- Cost: $4/month (total: $8/month)

### 3. Configure Proxy
```bash
# SSH into your droplet
ssh root@YOUR_DROPLET_IP

# Run the setup script
chmod +x proxy-setup.sh
./proxy-setup.sh
```

## Integration with Your App

### Update Lipsey's API Base URL
In `server/lipsey-api.ts`, change:

```typescript
// From:
private baseUrl = 'https://api.lipseys.com';

// To:
private baseUrl = process.env.LIPSEY_PROXY_URL || 'https://api.lipseys.com';
```

### Environment Variable
Add to your `.env`:
```
LIPSEY_PROXY_URL=http://YOUR_RESERVED_IP/lipsey
```

### Test the Proxy
```bash
# Test health check
curl http://YOUR_RESERVED_IP/health

# Test Lipsey's API through proxy
curl -X POST "http://YOUR_RESERVED_IP/lipsey/api/Integration/Authentication/Login" \
  -H "Content-Type: application/json" \
  -d '{"Email":"your_email","Password":"your_password"}'
```

## Whitelist with Lipsey's
Contact Lipsey's support and provide your **Reserved IP address** for whitelisting.

## Monthly Costs
- Droplet: $4/month
- Reserved IP: $4/month  
- **Total: $8/month**

## Benefits
✅ Static outbound IP for vendor API calls
✅ Reliable proxy service
✅ Cost-effective solution
✅ Easy to manage and monitor