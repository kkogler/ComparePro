# Quick Test Guide - Verify Credentials Fix

## 🎯 What to Test

Visit: **https://pricecomparehub.com/org/slither-guns/supported-vendors**

### Test 1: Bill Hicks Credentials

1. Find "Bill Hicks & Co." vendor
2. Click **"Configure"** button
3. Fill in the form:
   - FTP Host: `https://billhicksco.hostedftp.com/`
   - FTP Username: `kevin.kogler@microbiz.com`
   - FTP Password: `MicroBiz01`
   - FTP Port: `21`
   - Base Path: `/MicroBiz/Feeds`
4. Click **"Save Configuration"**
5. **Expected Result**: ✅ Green success toast message
6. Close and reopen the modal
7. **Expected Result**: ✅ Credentials still there (not "missing")

### Test 2: Lipsey's Credentials

1. Find "Lipsey's" vendor
2. Click **"Configure"** button
3. Fill in:
   - Email: (your dealer email)
   - Password: (your dealer password)
4. Click **"Save"**
5. **Expected Result**: ✅ Green success toast message
6. Click **"Test Connection"**
7. **Expected Result**: ✅ Connection successful message

## ✅ Success Criteria

All these should work now:
- [ ] No 400 errors when saving
- [ ] Success message appears
- [ ] Credentials persist when reopening modal
- [ ] Test connection works

## 🔍 If Something's Wrong

### Still Getting 400 Errors?

1. Check if server restarted:
   ```bash
   pm2 restart all
   # or
   npm run prod
   ```

2. Check server logs for detailed error messages

3. Verify schema fix:
   ```bash
   tsx scripts/check-production-db.ts
   ```
   Should show: `✅ Column is already JSONB`

### Credentials Not Persisting?

Check browser console for API errors and compare with server logs.

## 📊 Server Logs to Look For

### Good Signs (Success)
```
🔍 LIPSEYS CREDENTIAL SAVE DEBUG:
  - Email value: dealer@example.com
  - Has password: true
  
✅ VERIFICATION PASSED: All credential fields saved successfully
```

### Bad Signs (Problems)
```
❌ CREDENTIAL SAVE FAILED:
  - Error message: [look here for details]
```

---

**Ready to test!** 🚀





