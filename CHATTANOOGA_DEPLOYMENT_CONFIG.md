# Chattanooga Scheduled Deployment - Quick Setup

## 🚀 Ready to Deploy!

Your Chattanooga sync script is ready. Here's the exact configuration you need:

## 📋 Deployment Configuration

### **Basic Settings:**
- **Name**: `Chattanooga Daily Sync`
- **Description**: `Daily catalog synchronization for Chattanooga Shooting Supplies products`

### **Schedule Settings:**
- **Schedule**: `10 13 * * *`
- **Timezone**: `America/Los_Angeles`
- **Frequency**: Daily at 6:10 AM PDT

### **Command Settings:**
- **Build Command**: `npm install`
- **Run Command**: `tsx scripts/chattanooga-sync.ts`
- **Working Directory**: `/home/runner/workspace`

### **Resource Settings:**
- **CPU**: 1 vCPU (default)
- **Memory**: 2 GiB
- **Timeout**: 30 minutes (1800 seconds)
- **Concurrency**: 1

## 🎯 Step-by-Step Setup

### **Step 1: Create Deployment**
1. Go to **Deployments** tab in your Replit workspace
2. Click **"Create Deployment"**
3. Select **"Scheduled"**

### **Step 2: Configure Settings**
1. **Name**: `Chattanooga Daily Sync`
2. **Description**: `Daily catalog synchronization for Chattanooga Shooting Supplies products`
3. **Schedule**: `10 13 * * *`
4. **Timezone**: `America/Los_Angeles`

### **Step 3: Set Commands**
1. **Build Command**: `npm install`
2. **Run Command**: `tsx scripts/chattanooga-sync.ts`
3. **Working Directory**: `/home/runner/workspace`

### **Step 4: Configure Resources**
1. **CPU**: 1 vCPU
2. **Memory**: 2 GiB
3. **Timeout**: 1800 seconds (30 minutes)
4. **Concurrency**: 1

### **Step 5: Create & Test**
1. Click **"Create"**
2. Click **"Run Now"** to test
3. Check logs for successful execution

## 📊 Expected Results

### **Successful Execution:**
```
🚀 CHATTANOOGA SYNC DEPLOYMENT: Starting...
📅 Started at: [timestamp]
⚙️  Sync type: INCREMENTAL
✅ CHATTANOOGA SYNC: Vendor validated
📥 CHATTANOOGA SYNC: Downloading catalog CSV...
✅ CHATTANOOGA SYNC: Downloaded CSV with 78128 products
📊 CHATTANOOGA SYNC DEPLOYMENT: Results Summary
✅ Success: true
⏱️  Duration: 24 seconds
📦 Products processed: 78128
```

### **Cost Analysis:**
- **Execution time**: ~24 seconds
- **Daily cost**: $0.0015
- **Monthly cost**: $0.045
- **Annual cost**: $0.54

## 🔧 Troubleshooting

### **If Test Fails:**
1. **Wait 20 minutes** (rate limit cooldown)
2. **Try again** with "Run Now"
3. **Check logs** for specific errors

### **Common Issues:**
- **429 Rate Limit**: Wait 20 minutes between attempts
- **Database Error**: Verify DATABASE_URL is set
- **Memory Error**: Increase memory to 4 GiB

## ✅ Success Indicators

1. **Deployment Status**: "Success" in logs
2. **Execution Time**: 20-60 seconds
3. **Products Processed**: 70,000+ products
4. **Admin Panel**: Shows recent sync date

## 🎉 You're All Set!

Once configured, the deployment will:
- ✅ Run daily at 6:10 AM PDT
- ✅ Sync 70,000+ Chattanooga products
- ✅ Update your database automatically
- ✅ Cost less than $0.05/month

**Next Step**: Go to Deployments tab and create the deployment using the config above!
