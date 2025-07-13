#!/bin/bash

# AI Agent Orchestrator Deployment Script
# This script deploys the entire application to production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="ai-agent-orchestrator"
FRONTEND_DIR="frontend"
BACKEND_DIR="backend"
DOCKER_COMPOSE_FILE="docker-compose.yml"

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_deps=()
    
    if ! command_exists node; then
        missing_deps+=("Node.js")
    fi
    
    if ! command_exists npm; then
        missing_deps+=("npm")
    fi
    
    if ! command_exists docker; then
        missing_deps+=("Docker")
    fi
    
    if ! command_exists docker-compose; then
        missing_deps+=("Docker Compose")
    fi
    
    if ! command_exists git; then
        missing_deps+=("Git")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        print_error "Please install the missing dependencies and try again."
        exit 1
    fi
    
    print_success "All prerequisites are installed"
}

# Function to check environment files
check_environment_files() {
    print_status "Checking environment files..."
    
    if [ ! -f "$BACKEND_DIR/.env" ]; then
        print_warning "Backend .env file not found. Creating from template..."
        if [ -f "$BACKEND_DIR/env.example" ]; then
            cp "$BACKEND_DIR/env.example" "$BACKEND_DIR/.env"
            print_warning "Please update $BACKEND_DIR/.env with your actual values"
        else
            print_error "Backend env.example file not found"
            exit 1
        fi
    fi
    
    if [ ! -f "$FRONTEND_DIR/.env.local" ]; then
        print_warning "Frontend .env.local file not found. Creating from template..."
        if [ -f "$FRONTEND_DIR/env.example" ]; then
            cp "$FRONTEND_DIR/env.example" "$FRONTEND_DIR/.env.local"
            print_warning "Please update $FRONTEND_DIR/.env.local with your actual values"
        else
            print_error "Frontend env.example file not found"
            exit 1
        fi
    fi
    
    print_success "Environment files are ready"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install backend dependencies
    print_status "Installing backend dependencies..."
    cd "$BACKEND_DIR"
    npm ci
    cd ..
    
    # Install frontend dependencies
    print_status "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    npm ci
    cd ..
    
    print_success "Dependencies installed successfully"
}

# Function to build applications
build_applications() {
    print_status "Building applications..."
    
    # Build backend
    print_status "Building backend..."
    cd "$BACKEND_DIR"
    npm run build
    cd ..
    
    # Build frontend
    print_status "Building frontend..."
    cd "$FRONTEND_DIR"
    npm run build
    cd ..
    
    print_success "Applications built successfully"
}

# Function to run tests
run_tests() {
    print_status "Running tests..."
    
    # Run backend tests
    print_status "Running backend tests..."
    cd "$BACKEND_DIR"
    npm run test:ci
    cd ..
    
    # Run frontend tests
    print_status "Running frontend tests..."
    cd "$FRONTEND_DIR"
    npm run test:ci
    cd ..
    
    print_success "All tests passed"
}

# Function to setup database
setup_database() {
    print_status "Setting up database..."
    
    cd "$BACKEND_DIR"
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    npx prisma generate
    
    # Push database schema
    print_status "Pushing database schema..."
    npx prisma db push
    
    # Seed database if seed script exists
    if [ -f "prisma/seed.ts" ]; then
        print_status "Seeding database..."
        npm run db:seed
    fi
    
    cd ..
    
    print_success "Database setup completed"
}

# Function to deploy with Docker
deploy_docker() {
    print_status "Deploying with Docker..."
    
    # Build and start containers
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d --build
    
    print_success "Docker deployment completed"
}

# Function to deploy to Vercel
deploy_vercel() {
    print_status "Deploying to Vercel..."
    
    if ! command_exists vercel; then
        print_status "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    # Deploy frontend
    cd "$FRONTEND_DIR"
    vercel --prod --yes
    cd ..
    
    print_success "Vercel deployment completed"
}

# Function to deploy to Railway
deploy_railway() {
    print_status "Deploying to Railway..."
    
    if ! command_exists railway; then
        print_status "Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    # Deploy backend
    cd "$BACKEND_DIR"
    railway up --service backend
    cd ..
    
    print_success "Railway deployment completed"
}

# Function to show deployment status
show_status() {
    print_status "Checking deployment status..."
    
    # Check if containers are running
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps | grep -q "Up"; then
        print_success "Docker containers are running"
    else
        print_warning "Docker containers are not running"
    fi
    
    # Check backend health
    if command_exists curl; then
        if curl -f http://localhost:3001/health >/dev/null 2>&1; then
            print_success "Backend is healthy"
        else
            print_warning "Backend health check failed"
        fi
    fi
    
    # Check frontend
    if command_exists curl; then
        if curl -f http://localhost:3000 >/dev/null 2>&1; then
            print_success "Frontend is accessible"
        else
            print_warning "Frontend is not accessible"
        fi
    fi
}

# Function to show help
show_help() {
    echo "AI Agent Orchestrator Deployment Script"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  check       Check prerequisites and environment"
    echo "  install     Install dependencies"
    echo "  build       Build applications"
    echo "  test        Run tests"
    echo "  db          Setup database"
    echo "  docker      Deploy with Docker"
    echo "  vercel      Deploy frontend to Vercel"
    echo "  railway     Deploy backend to Railway"
    echo "  status      Show deployment status"
    echo "  all         Run all deployment steps"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 check     # Check if everything is ready"
    echo "  $0 all       # Complete deployment"
    echo "  $0 docker    # Deploy with Docker only"
}

# Main deployment function
deploy_all() {
    print_status "Starting complete deployment..."
    
    check_prerequisites
    check_environment_files
    install_dependencies
    build_applications
    run_tests
    setup_database
    deploy_docker
    
    print_success "Deployment completed successfully!"
    print_status "Your AI Agent Orchestrator is now running at:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:3001"
    echo "  Health:   http://localhost:3001/health"
}

# Main script logic
case "${1:-all}" in
    "check")
        check_prerequisites
        check_environment_files
        ;;
    "install")
        install_dependencies
        ;;
    "build")
        build_applications
        ;;
    "test")
        run_tests
        ;;
    "db")
        setup_database
        ;;
    "docker")
        deploy_docker
        ;;
    "vercel")
        deploy_vercel
        ;;
    "railway")
        deploy_railway
        ;;
    "status")
        show_status
        ;;
    "all")
        deploy_all
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        print_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac 