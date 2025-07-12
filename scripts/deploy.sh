#!/bin/bash

# AI Agent Orchestrator Deployment Script
# This script automates the deployment process for various platforms

set -e

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

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        print_error "git is not installed"
        exit 1
    fi
    
    print_success "All dependencies are installed"
}

# Build the project
build_project() {
    print_status "Building the project..."
    
    # Build frontend
    print_status "Building frontend..."
    cd frontend
    npm install
    npm run build
    cd ..
    
    # Build backend
    print_status "Building backend..."
    cd backend
    npm install
    npm run build
    cd ..
    
    print_success "Project built successfully"
}

# Deploy to Vercel
deploy_vercel() {
    print_status "Deploying to Vercel..."
    
    if ! command -v vercel &> /dev/null; then
        print_warning "Vercel CLI not found. Installing..."
        npm install -g vercel
    fi
    
    # Deploy frontend
    cd frontend
    vercel --prod
    cd ..
    
    print_success "Deployed to Vercel successfully"
}

# Deploy to Railway
deploy_railway() {
    print_status "Deploying to Railway..."
    
    if ! command -v railway &> /dev/null; then
        print_warning "Railway CLI not found. Installing..."
        npm install -g @railway/cli
    fi
    
    # Deploy backend
    cd backend
    railway login
    railway up
    cd ..
    
    print_success "Deployed to Railway successfully"
}

# Deploy with Docker
deploy_docker() {
    print_status "Deploying with Docker..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Build and run with Docker Compose
    docker-compose up -d --build
    
    print_success "Deployed with Docker successfully"
}

# Setup environment
setup_environment() {
    print_status "Setting up environment..."
    
    # Create environment files if they don't exist
    if [ ! -f frontend/.env.local ]; then
        cp frontend/.env.example frontend/.env.local
        print_warning "Created frontend/.env.local. Please update with your configuration."
    fi
    
    if [ ! -f backend/.env ]; then
        cp backend/.env.example backend/.env
        print_warning "Created backend/.env. Please update with your configuration."
    fi
    
    print_success "Environment setup completed"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    
    # Frontend tests
    cd frontend
    npm test
    cd ..
    
    # Backend tests
    cd backend
    npm test
    cd ..
    
    print_success "All tests passed"
}

# Main deployment function
main() {
    local platform=$1
    
    print_status "Starting AI Agent Orchestrator deployment..."
    
    check_dependencies
    setup_environment
    build_project
    
    case $platform in
        "vercel")
            deploy_vercel
            ;;
        "railway")
            deploy_railway
            ;;
        "docker")
            deploy_docker
            ;;
        "all")
            deploy_vercel
            deploy_railway
            ;;
        *)
            print_error "Invalid platform. Use: vercel, railway, docker, or all"
            echo "Usage: $0 [vercel|railway|docker|all]"
            exit 1
            ;;
    esac
    
    print_success "Deployment completed successfully!"
}

# Check if platform argument is provided
if [ $# -eq 0 ]; then
    print_error "No platform specified"
    echo "Usage: $0 [vercel|railway|docker|all]"
    echo ""
    echo "Platforms:"
    echo "  vercel  - Deploy frontend to Vercel"
    echo "  railway - Deploy backend to Railway"
    echo "  docker  - Deploy with Docker Compose"
    echo "  all     - Deploy to all platforms"
    exit 1
fi

# Run main function with platform argument
main "$1" 