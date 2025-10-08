# How to Get Your Production Database URL

Your production site is at **https://pricecomparehub.com/**

The database URL is stored in your production hosting environment. Here's how to find it:

---

## Option 1: Replit (Most Likely)

If you're hosting on Replit:

1. Go to https://replit.com/
2. Find your **production Repl** (the one running pricecomparehub.com)
3. Click on the **Secrets** tab (🔒 lock icon) or **Tools** → **Secrets**
4. Look for `DATABASE_URL`
5. Copy the entire value

It will look like:
```
postgresql://username:password@ep-xxxxx-xxx.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
```

---

## Option 2: Check Deployment Settings

If using another platform:

### Heroku:
```bash
heroku config:get DATABASE_URL -a pricecomparehub
```

### Vercel:
1. Go to https://vercel.com/dashboard
2. Select your pricecomparehub project
3. Go to Settings → Environment Variables
4. Find `DATABASE_URL`

### Render:
1. Go to https://dashboard.render.com/
2. Select your service
3. Go to Environment
4. Find `DATABASE_URL`

### Railway:
1. Go to https://railway.app/
2. Select your project
3. Go to Variables
4. Find `DATABASE_URL`

---

## Option 3: Check Your Repository

If you have access to your production deployment config:

```bash
# Look for environment files
cat .env.production
cat .replit

# Or check deployment configuration
cat vercel.json
cat render.yaml
```

---

## What to Do Once You Have It:

1. Copy the entire connection string
2. Run this command:
   ```bash
   export PRODUCTION_DATABASE_URL="paste-your-url-here"
   ```

3. Verify it works:
   ```bash
   npm run db:check
   ```

4. Sync to production:
   ```bash
   npm run db:sync:prod
   ```

---

## ⚠️ Important Notes

- **DO NOT commit** this URL to git
- **DO NOT share** it publicly (it contains your database password)
- Make sure you have the **correct production URL** (not development/staging)

---

## If You Can't Find It:

If you can't locate the production URL, you have a few options:

1. **Use current setup**: Keep Hosted NEON for dev, Production separate
2. **Contact support**: Reach out to your hosting provider
3. **Skip production sync**: Just use local dev for now

You can always sync production later when you find the URL!

