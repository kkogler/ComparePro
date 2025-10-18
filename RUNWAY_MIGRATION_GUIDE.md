# 🚀 Complete Runway Deployment Guide

## 🎯 Overview
This guide provides everything you need to deploy your application to Runway and completely disconnect from Replit. Your application is ready for Runway deployment after the migration work completed earlier.

## ✅ Migration Status
- ✅ Removed all Replit dependencies and configurations
- ✅ Updated server code for Runway compatibility
- ✅ Configured Google Cloud Storage for file uploads
- ✅ Updated documentation for Runway deployment

## 🔧 Step 1: Set Up Your Runway Project

### 1.1 Create Runway Project
1. Go to [runwayml.com](https://runwayml.com) and sign up/login
2. Create a new project
3. Connect your GitHub repository
4. Choose **Node.js** as your runtime

### 1.2 Configure Build Settings
In your Runway project settings:
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `NODE_ENV=production PORT=$PORT node dist/index.js`
- **Root Directory**: `/` (leave empty)
- **Node Version**: `20.x` (or latest LTS)

## 🔑 Step 2: Configure Environment Variables

Set these environment variables in your Runway project **before deploying**:

### Required Variables:
```bash
# Database (NEON PostgreSQL)
DATABASE_URL=postgresql://neondb_owner:***@ep-prod-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require

# Application Configuration
NODE_ENV=production
PORT=3000
APP_URL=https://your-runway-app.runwayml.com
BASE_URL=https://your-runway-app.runwayml.com

# Security (Generate these securely)
SESSION_SECRET=your-super-secure-session-secret-here-make-it-long-and-random
CREDENTIAL_ENCRYPTION_KEY=your-32-character-encryption-key-here

# Email Service (if using)
SENDGRID_API_KEY=your-sendgrid-api-key-here
```

### Google Cloud Storage (Required for file uploads)
```bash
# Get these from Google Cloud Console
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...","client_email":"...","client_id":"...","universe_domain":"googleapis.com"}
```

### Zoho Billing (if using subscription features)
```bash
ZOHO_BILLING_CLIENT_ID=your-zoho-client-id
ZOHO_BILLING_CLIENT_SECRET=your-zoho-client-secret
ZOHO_WEBHOOK_SECRET=your-webhook-secret
```

## 🗂️ Step 3: Google Cloud Storage Setup

**This is required for file upload/download functionality:**

1. **Create Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or use existing one

2. **Enable APIs**:
   - Enable "Cloud Storage API"
   - Enable "Cloud Storage JSON API"

3. **Create Service Account**:
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Name: `runway-storage-service`
   - Role: `Storage Admin`

4. **Generate Key**:
   - Click on the service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose "JSON" format
   - Download the file

5. **Set Environment Variable**:
   - Copy the entire JSON content from the downloaded file
   - Set `GOOGLE_APPLICATION_CREDENTIALS_JSON` to this JSON in Runway

## 🚀 Step 4: Deploy to Runway

1. **Commit your code** to GitHub (if not already done)
2. **Push to your connected repository**
3. **Trigger deployment** in Runway (it should auto-deploy on push)
4. **Monitor deployment logs** in Runway dashboard

## ✅ Step 5: Verify Deployment

After deployment, verify these endpoints:

1. **Health Check**: `GET https://your-runway-app.runwayml.com/api/health`
   - Should return: `{"status":"ok",...}`

2. **API Endpoints**: Test your main API endpoints

3. **File Upload**: Test file upload functionality if used

4. **Database Connection**: Verify database queries work

## 🔧 Step 6: Update DNS (Optional)

If you want a custom domain instead of `your-app.runwayml.com`:

1. **Buy a domain** (e.g., from Namecheap, GoDaddy)
2. **Configure DNS** in your domain registrar
3. **Add custom domain** in Runway project settings

## 🚨 Troubleshooting

### Common Issues:

**❌ "Object storage not working"**
- Check `GOOGLE_APPLICATION_CREDENTIALS_JSON` is set correctly
- Verify Google Cloud project has correct permissions

**❌ "Database connection failed"**
- Verify `DATABASE_URL` is correct and accessible
- Check if database allows connections from Runway IPs

**❌ "Build failed"**
- Check Runway build logs for specific errors
- Ensure all dependencies are in `package.json`

**❌ "Application not starting"**
- Check environment variables are all set
- Verify `NODE_ENV=production` is set

### Getting Help:
1. Check Runway deployment logs in the dashboard
2. Verify all environment variables are properly set
3. Test with minimal configuration first (just database + basic app)

## 🎉 Success Checklist

- [ ] Runway project created and connected to GitHub
- [ ] All environment variables configured
- [ ] Google Cloud Storage set up and credentials added
- [ ] Deployment successful (green checkmark in Runway)
- [ ] Health check endpoint returns 200
- [ ] All API endpoints working
- [ ] File upload/download working (if used)
- [ ] Custom domain configured (if desired)

## 📞 Need Help?

If you encounter issues:
1. **Check Runway logs** in the project dashboard
2. **Verify environment variables** are all set correctly
3. **Test with minimal config** to isolate issues

Your application is now ready for 100% Runway deployment! 🚀
