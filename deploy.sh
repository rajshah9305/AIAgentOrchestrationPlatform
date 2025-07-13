#!/bin/bash

# AI Agent Orchestrator - Deployment Script
# This script handles the complete deployment process

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

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_success "Node.js version: $(node --version)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed."
        exit 1
    fi
    
    print_success "npm version: $(npm --version)"
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        print_success "Docker is available"
    else
        print_warning "Docker is not installed. Docker deployment will be skipped."
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed."
        exit 1
    fi
    
    print_success "Git version: $(git --version)"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Frontend dependencies
    print_status "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    
    # Backend dependencies
    print_status "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    
    print_success "Dependencies installed successfully"
}

# Function to run tests
run_tests() {
    print_status "Running tests..."
    
    # Frontend tests
    print_status "Running frontend tests..."
    cd frontend
    npm run test:ci
    cd ..
    
    # Backend tests
    print_status "Running backend tests..."
    cd backend
    npm run test:ci
    cd ..
    
    print_success "All tests passed"
}

# Function to build applications
build_applications() {
    print_status "Building applications..."
    
    # Frontend build
    print_status "Building frontend..."
    cd frontend
    npm run build
    cd ..
    
    # Backend build
    print_status "Building backend..."
    cd backend
    npm run build
    cd ..
    
    print_success "Build completed successfully"
}

# Function to setup database
setup_database() {
    print_status "Setting up database..."
    
    cd backend
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    npm run db:generate
    
    # Push database schema
    print_status "Pushing database schema..."
    npm run db:push
    
    # Seed database
    print_status "Seeding database..."
    npm run db:seed
    
    cd ..
    
    print_success "Database setup completed"
}

# Function to deploy with Docker
deploy_docker() {
    if ! command -v docker &> /dev/null; then
        print_warning "Docker not available, skipping Docker deployment"
        return
    fi
    
    print_status "Deploying with Docker..."
    
    # Build and start containers
    docker-compose up -d --build
    
    print_success "Docker deployment completed"
}

# Function to deploy to Vercel
deploy_vercel() {
    print_status "Deploying frontend to Vercel..."
    
    if ! command -v vercel &> /dev/null; then
        print_warning "Vercel CLI not installed. Please install it with: npm i -g vercel"
        return
    fi
    
    cd frontend
    vercel --prod
    cd ..
    
    print_success "Vercel deployment completed"
}

# Function to deploy to Railway
deploy_railway() {
    print_status "Deploying backend to Railway..."
    
    if ! command -v railway &> /dev/null; then
        print_warning "Railway CLI not installed. Please install it with: npm i -g @railway/cli"
        return
    fi
    
    cd backend
    railway up
    cd ..
    
    print_success "Railway deployment completed"
}

# Function to check deployment status
check_status() {
    print_status "Checking deployment status..."
    
    # Check if services are running
    if command -v docker &> /dev/null; then
        print_status "Docker containers status:"
        docker-compose ps
    fi
    
    # Check frontend build
    if [ -d "frontend/.next" ]; then
        print_success "Frontend build exists"
    else
        print_error "Frontend build not found"
    fi
    
    # Check backend build
    if [ -d "backend/dist" ]; then
        print_success "Backend build exists"
    else
        print_error "Backend build not found"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --check-prerequisites    Check if all required tools are installed"
    echo "  --install-deps           Install dependencies"
    echo "  --test                   Run tests"
    echo "  --build                  Build applications"
    echo "  --setup-db               Setup database"
    echo "  --docker                 Deploy with Docker"
    echo "  --vercel                 Deploy frontend to Vercel"
    echo "  --railway                Deploy backend to Railway"
    echo "  --status                 Check deployment status"
    echo "  --all                    Run complete deployment (default)"
    echo "  --help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --all                 # Complete deployment"
    echo "  $0 --check-prerequisites # Only check prerequisites"
    echo "  $0 --docker              # Only Docker deployment"
}

# Main deployment function
main() {
    print_status "Starting AI Agent Orchestrator deployment..."
    
    # Parse command line arguments
    if [ $# -eq 0 ]; then
        # No arguments, run complete deployment
        check_prerequisites
        install_dependencies
        run_tests
        build_applications
        setup_database
        deploy_docker
        check_status
    else
        # Process arguments
        while [[ $# -gt 0 ]]; do
            case $1 in
                --check-prerequisites)
                    check_prerequisites
                    shift
                    ;;
                --install-deps)
                    install_dependencies
                    shift
                    ;;
                --test)
                    run_tests
                    shift
                    ;;
                --build)
                    build_applications
                    shift
                    ;;
                --setup-db)
                    setup_database
                    shift
                    ;;
                --docker)
                    deploy_docker
                    shift
                    ;;
                --vercel)
                    deploy_vercel
                    shift
                    ;;
                --railway)
                    deploy_railway
                    shift
                    ;;
                --status)
                    check_status
                    shift
                    ;;
                --all)
                    check_prerequisites
                    install_dependencies
                    run_tests
                    build_applications
                    setup_database
                    deploy_docker
                    check_status
                    shift
                    ;;
                --help)
                    show_usage
                    exit 0
                    ;;
                *)
                    print_error "Unknown option: $1"
                    show_usage
                    exit 1
                    ;;
            esac
        done
    fi
    
    print_success "Deployment completed successfully!"
}

# Run main function with all arguments
main "$@" 