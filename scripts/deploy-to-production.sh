#!/bin/bash

# 🚀 Deploy to Production Script
# This script helps deploy from development to production safely

set -e  # Exit on any error

echo "🚀 Starting Production Deployment Process..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# 1. Pre-deployment checks
print_status "🔍 Running pre-deployment checks..."

# Check if we're in git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository. Please run this from your project root."
    exit 1
fi

# Check git status
if [[ -n $(git status --porcelain) ]]; then
    print_warning "You have uncommitted changes. Consider committing them first."
    echo "Current changes:"
    git status --short
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Deployment cancelled."
        exit 1
    fi
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
print_status "Current branch: $CURRENT_BRANCH"

# 2. Database backup
print_status "💾 Creating production database backup..."
PROD_DB_URL="postgresql://neondb_owner:npg_3U8KcQGzhMLW@ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"

if command -v pg_dump &> /dev/null; then
    print_status "Creating backup: $BACKUP_FILE"
    PGPASSWORD=npg_3U8KcQGzhMLW pg_dump -h ep-lingering-sea-adyjzybe.c-2.us-east-1.aws.neon.tech -U neondb_owner -d neondb > "$BACKUP_FILE"
    print_success "Backup created: $BACKUP_FILE"
else
    print_warning "pg_dump not available. Skipping database backup."
    print_warning "Consider manually backing up your production database."
fi

# 3. Build the application
print_status "🔨 Building production application..."
npm run build

if [ $? -eq 0 ]; then
    print_success "Build completed successfully"
else
    print_error "Build failed. Check the errors above."
    exit 1
fi

# 4. Test the build
print_status "🧪 Testing production build..."
npm run prod:test

if [ $? -eq 0 ]; then
    print_success "Production test passed"
else
    print_error "Production test failed. Check the errors above."
    exit 1
fi

# 5. Commit and push changes
print_status "📝 Committing changes..."
git add .
git commit -m "Deploy to production - $(date +'%Y-%m-%d %H:%M:%S')"

if [ $? -eq 0 ]; then
    print_success "Changes committed"
else
    print_warning "No changes to commit or commit failed"
fi

print_status "🚀 Pushing to repository..."
git push origin $CURRENT_BRANCH

if [ $? -eq 0 ]; then
    print_success "Changes pushed to repository"
else
    print_error "Failed to push changes. Check your git configuration."
    exit 1
fi

# 6. Deployment instructions
echo ""
print_success "🎉 Pre-deployment steps completed!"
echo ""
echo "📋 Next Steps:"
echo "1. Your changes have been pushed to GitHub"
echo "2. Runway will automatically start deployment"
echo "3. Monitor the deployment in your Runway dashboard"
echo "4. Once deployed, verify:"
echo "   - Visit your production URL"
echo "   - Check /api/health endpoint"
echo "   - Test critical user flows"
echo ""
echo "🔗 Production URL: https://your-runway-app.runwayml.com"
echo "🔗 Health Check: https://your-runway-app.runwayml.com/api/health"
echo ""
print_warning "⚠️  Remember to monitor your production environment after deployment!"
echo ""
print_status "Deployment process initiated. Check your Runway dashboard for progress."

# Optional: Wait for deployment confirmation
read -p "Would you like to wait and check deployment status? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "⏳ Checking deployment status..."
    print_status "Open your Runway dashboard to monitor the deployment."
    print_status "The deployment should complete within a few minutes."
fi

echo ""
print_success "Production deployment process completed! 🚀"
