#!/bin/bash

# AI Agent Orchestrator - Production Setup Script
# This script sets up the complete project for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_status() {
    echo -e "${BLUE}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_success "Node.js $(node --version) is installed"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed."
        exit 1
    fi
    
    print_success "npm $(npm --version) is installed"
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        print_success "Docker is available"
    else
        print_warning "Docker is not installed. Some features may not work."
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed."
        exit 1
    fi
    
    print_success "Git $(git --version) is installed"
}

# Generate environment files
generate_env_files() {
    print_status "Generating environment files..."
    
    # Backend .env
    if [ ! -f "backend/.env" ]; then
        cat > backend/.env << 'EOF'
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/agentorchestra"
DIRECT_URL="postgresql://username:password@localhost:5432/agentorchestra"

# JWT Authentication
JWT_SECRET="your-super-secret-jwt-key-here-change-in-production"
JWT_EXPIRES_IN="7d"

# AI Service APIs
CEREBRAS_API_KEY="your-cerebras-api-key"
OPENAI_API_KEY="your-openai-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"
GOOGLE_AI_API_KEY="your-google-ai-api-key"

# Redis (for caching and queues)
REDIS_URL="redis://localhost:6379"

# File Storage
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="agentorchestra-files"

# Monitoring & Analytics
SENTRY_DSN="your-sentry-dsn"
POSTHOG_KEY="your-posthog-key"

# Email (for notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Application Settings
NODE_ENV="development"
PORT="3001"
FRONTEND_URL="http://localhost:3000"
LOG_LEVEL="info"
MAX_EXECUTION_TIME="300000"
MAX_CONCURRENT_EXECUTIONS="10"

# Security
CORS_ORIGIN="http://localhost:3000"
RATE_LIMIT_WINDOW_MS="900000"
RATE_LIMIT_MAX_REQUESTS="100"
EOF
        print_success "Created backend/.env"
    else
        print_warning "backend/.env already exists"
    fi
    
    # Frontend .env.local
    if [ ! -f "frontend/.env.local" ]; then
        cat > frontend/.env.local << 'EOF'
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# AI Service APIs (for client-side features)
NEXT_PUBLIC_CEREBRAS_API_KEY=your-cerebras-api-key
NEXT_PUBLIC_OPENAI_API_KEY=your-openai-api-key

# Analytics (optional)
NEXT_PUBLIC_POSTHOG_KEY=your-posthog-key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Application Settings
NEXT_PUBLIC_APP_NAME="AI Agent Orchestrator"
NEXT_PUBLIC_APP_VERSION="1.0.0"
NEXT_PUBLIC_APP_DESCRIPTION="Ultra-fast AI agent orchestration platform with Cerebras integration"

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
NEXT_PUBLIC_ENABLE_3D_BACKGROUND=true
EOF
        print_success "Created frontend/.env.local"
    else
        print_warning "frontend/.env.local already exists"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Backend dependencies
    print_status "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    
    # Frontend dependencies
    print_status "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    
    print_success "All dependencies installed"
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    cd backend
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    npx prisma generate
    
    # Push database schema
    print_status "Pushing database schema..."
    npx prisma db push
    
    # Seed database
    print_status "Seeding database..."
    npm run db:seed
    
    cd ..
    
    print_success "Database setup complete"
}

# Build applications
build_applications() {
    print_status "Building applications..."
    
    # Build backend
    print_status "Building backend..."
    cd backend
    npm run build
    cd ..
    
    # Build frontend
    print_status "Building frontend..."
    cd frontend
    npm run build
    cd ..
    
    print_success "Build complete"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    
    # Backend tests
    print_status "Running backend tests..."
    cd backend
    npm run test:ci
    cd ..
    
    # Frontend tests
    print_status "Running frontend tests..."
    cd frontend
    npm run test:ci
    cd ..
    
    print_success "All tests passed"
}

# Check for TODOs and errors
check_code_quality() {
    print_status "Checking code quality..."
    
    # Check for TODOs
    TODO_COUNT=$(grep -r "TODO\|FIXME\|PLACEHOLDER\|TEMP\|DUMMY" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . | wc -l || echo "0")
    
    if [ "$TODO_COUNT" -gt 0 ]; then
        print_warning "Found $TODO_COUNT TODO/FIXME comments:"
        grep -r "TODO\|FIXME\|PLACEHOLDER\|TEMP\|DUMMY" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . || true
    else
        print_success "No TODO/FIXME comments found"
    fi
    
    # Check for TypeScript errors
    print_status "Checking TypeScript..."
    cd backend && npm run type-check && cd ..
    cd frontend && npm run type-check && cd ..
    
    print_success "Code quality check complete"
}

# Create production deployment files
create_deployment_files() {
    print_status "Creating deployment files..."
    
    # Create production environment templates
    cat > backend/.env.production << 'EOF'
# Production Environment Variables
# Copy this to your production environment and update values

DATABASE_URL="postgresql://user:password@host:5432/database"
DIRECT_URL="postgresql://user:password@host:5432/database"
JWT_SECRET="your-production-jwt-secret"
CEREBRAS_API_KEY="your-production-cerebras-key"
REDIS_URL="redis://host:6379"
NODE_ENV="production"
PORT="3001"
FRONTEND_URL="https://your-domain.com"
EOF
    
    cat > frontend/.env.production << 'EOF'
# Production Environment Variables
# Copy this to your production environment and update values

NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_WS_URL=wss://api.your-domain.com
NEXT_PUBLIC_APP_NAME="AI Agent Orchestrator"
NEXT_PUBLIC_APP_VERSION="1.0.0"
EOF
    
    print_success "Deployment files created"
}

# Main setup function
main() {
    echo -e "${BLUE}"
    echo "🚀 AI Agent Orchestrator - Production Setup"
    echo "=========================================="
    echo -e "${NC}"
    
    check_prerequisites
    generate_env_files
    install_dependencies
    setup_database
    build_applications
    run_tests
    check_code_quality
    create_deployment_files
    
    echo -e "${GREEN}"
    echo "🎉 Setup Complete!"
    echo "=================="
    echo -e "${NC}"
    echo "Next steps:"
    echo "1. Update environment files with your actual values:"
    echo "   - backend/.env"
    echo "   - frontend/.env.local"
    echo ""
    echo "2. Start the development servers:"
    echo "   Backend:  cd backend && npm run dev"
    echo "   Frontend: cd frontend && npm run dev"
    echo ""
    echo "3. Access the application:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend:  http://localhost:3001"
    echo ""
    echo "4. For production deployment:"
    echo "   - Update production environment variables"
    echo "   - Deploy to Vercel: ./deploy.sh --vercel"
    echo "   - Deploy to Railway: ./deploy.sh --railway"
    echo ""
    echo "Documentation: https://github.com/your-username/ai-agent-orchestrator"
}

# Run main function
main "$@" 