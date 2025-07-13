#!/bin/bash

# AI Agent Orchestrator - Repository Cleanup Script
# This script cleans up the repository and ensures it's production-ready

set -e

echo "🧹 Starting repository cleanup..."

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

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Remove temporary files
print_status "Removing temporary files..."
find . -name "*.tmp" -delete 2>/dev/null || true
find . -name "*.temp" -delete 2>/dev/null || true
find . -name "*.bak" -delete 2>/dev/null || true
find . -name "*.old" -delete 2>/dev/null || true
find . -name "*~" -delete 2>/dev/null || true
find . -name ".DS_Store" -delete 2>/dev/null || true
find . -name "Thumbs.db" -delete 2>/dev/null || true

# Remove build artifacts
print_status "Removing build artifacts..."
rm -rf frontend/.next 2>/dev/null || true
rm -rf frontend/out 2>/dev/null || true
rm -rf backend/dist 2>/dev/null || true
rm -rf backend/build 2>/dev/null || true

# Remove node_modules (will be reinstalled)
print_status "Removing node_modules..."
rm -rf frontend/node_modules 2>/dev/null || true
rm -rf backend/node_modules 2>/dev/null || true

# Remove lock files (will be regenerated)
print_status "Removing lock files..."
rm -f frontend/package-lock.json 2>/dev/null || true
rm -f frontend/yarn.lock 2>/dev/null || true
rm -f frontend/pnpm-lock.yaml 2>/dev/null || true
rm -f backend/yarn.lock 2>/dev/null || true
rm -f backend/pnpm-lock.yaml 2>/dev/null || true

# Remove test coverage reports
print_status "Removing test coverage reports..."
rm -rf frontend/coverage 2>/dev/null || true
rm -rf backend/coverage 2>/dev/null || true

# Remove log files
print_status "Removing log files..."
find . -name "*.log" -delete 2>/dev/null || true
find . -name "npm-debug.log*" -delete 2>/dev/null || true
find . -name "yarn-debug.log*" -delete 2>/dev/null || true
find . -name "yarn-error.log*" -delete 2>/dev/null || true

# Remove environment files (except examples)
print_status "Removing environment files..."
find . -name ".env" -not -name ".env.example" -delete 2>/dev/null || true
find . -name ".env.local" -delete 2>/dev/null || true
find . -name ".env.development" -delete 2>/dev/null || true
find . -name ".env.production" -delete 2>/dev/null || true

# Remove IDE files
print_status "Removing IDE files..."
find . -name ".vscode" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name ".idea" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.swp" -delete 2>/dev/null || true
find . -name "*.swo" -delete 2>/dev/null || true

# Remove empty directories
print_status "Removing empty directories..."
find . -type d -empty -delete 2>/dev/null || true

# Check for TODO/FIXME comments
print_status "Checking for TODO/FIXME comments..."
TODO_COUNT=$(grep -r "TODO\|FIXME\|PLACEHOLDER\|TEMP\|DUMMY" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.json" . | wc -l || echo "0")

if [ "$TODO_COUNT" -gt 0 ]; then
    print_warning "Found $TODO_COUNT TODO/FIXME comments. Please review and remove them before production deployment."
    grep -r "TODO\|FIXME\|PLACEHOLDER\|TEMP\|DUMMY" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.json" . || true
else
    print_success "No TODO/FIXME comments found."
fi

# Verify essential files exist
print_status "Verifying essential files..."
ESSENTIAL_FILES=(
    "README.md"
    "package.json"
    "frontend/package.json"
    "backend/package.json"
    "frontend/tsconfig.json"
    "backend/tsconfig.json"
    "frontend/next.config.mjs"
    "backend/src/index.ts"
    "docker-compose.yml"
    "Dockerfile"
    "frontend/Dockerfile"
    "backend/Dockerfile"
)

for file in "${ESSENTIAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "✓ $file exists"
    else
        print_error "✗ $file is missing"
    fi
done

# Check file sizes
print_status "Checking for large files..."
find . -type f -size +10M -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./.next/*" -not -path "./dist/*" | while read file; do
    print_warning "Large file found: $file ($(du -h "$file" | cut -f1))"
done

print_success "Repository cleanup completed!"
print_status "Next steps:"
echo "  1. Run 'npm install' in both frontend and backend directories"
echo "  2. Run 'npm run build' to test the build process"
echo "  3. Run 'npm test' to ensure all tests pass"
echo "  4. Commit and push to GitHub" 