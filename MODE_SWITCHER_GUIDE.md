# Hybrid Development/Production Mode Guide

This project now supports easy switching between development and production modes.

## 🎯 Quick Start

### Option 1: NPM Scripts (Recommended)
```bash
# Development mode (default - hot reload, fast iteration)
npm run dev

# Production mode (test optimized build)
npm run prod:test

# Just build without running
npm run build
```

### Option 2: Mode Switcher Script
```bash
# Switch to development mode
./switch-mode.sh dev

# Switch to production mode
./switch-mode.sh prod

# Test production build temporarily
./switch-mode.sh test-prod

# Check current status
./switch-mode.sh status
```

### Option 3: Replit Workflows
Use the **Workflows** button in Replit UI:
- **"Start Application"** → Development mode
- **"Test Production Build"** → Production mode

## 📊 Mode Comparison

| Feature | Development Mode | Production Mode |
|---------|-----------------|-----------------|
| **Command** | `npm run dev` | `npm run prod:test` |
| **Hot Reload** | ✅ Yes | ❌ No |
| **Build Speed** | ⚡ Instant | 🐢 ~10-30s |
| **Performance** | 🐌 Slower | 🚀 Optimized |
| **Bundle Size** | 📦 Large | 📦 Minified |
| **Source Maps** | ✅ Full | ⚠️ Limited |
| **Error Messages** | 📝 Detailed | 🔒 Generic |
| **Memory Usage** | 🎯 Higher | 💪 Lower |
| **Best For** | Active coding | Testing/Debugging production issues |

## 🔄 Recommended Workflow

### Daily Development (95% of the time)
```bash
npm run dev
```
- Make changes → Save → See updates instantly
- Full debugging capabilities
- Fast iteration

### Before Major Releases (Pre-deployment)
```bash
npm run prod:test
```
- Test production build locally
- Catch production-only issues
- Verify optimizations work
- Check bundle size

### Cloud Run Deployment (Automatic)
The `.replit` deployment config automatically:
1. Runs `npm ci` (clean install)
2. Runs `npm run build` (production build)
3. Pushes database changes
4. Starts with `NODE_ENV=production`

## 🐛 Troubleshooting

### "Port already in use"
```bash
npm run kill
# Then start again
```

### "Production build fails"
```bash
# Check TypeScript errors
npm run check

# Clean rebuild
rm -rf dist node_modules/.vite
npm run build
```

### "Want to go back to dev"
```bash
./switch-mode.sh dev
# or simply
npm run kill
npm run dev
```

## 💡 Pro Tips

1. **Keep dev as default** - Only switch to prod for specific testing
2. **Test prod before deploying** - Catch issues early
3. **Monitor build times** - If builds get slow, optimize
4. **Use PM2 for stability** - `npm run dev:pm2` for auto-restart in dev

## 📁 Build Output

Production builds create:
- `dist/` - Server bundle (Node.js)
- `dist/public/` - Client assets (static files)

These are gitignored and regenerated on each deployment.

