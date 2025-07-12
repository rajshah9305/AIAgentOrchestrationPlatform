#!/bin/bash

# 🚀 AI Agent Orchestrator - Quick Setup Script
# This script sets up your development environment quickly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "\n${PURPLE}================================${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}================================${NC}\n"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
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
    print_header "Checking Dependencies"
    
    local missing_deps=()
    
    if ! command -v node &> /dev/null; then
        missing_deps+=("Node.js 18+")
    else
        node_version=$(node -v | sed 's/v//')
        major_version=$(echo $node_version | cut -d. -f1)
        if [ "$major_version" -lt 18 ]; then
            missing_deps+=("Node.js 18+ (current: $node_version)")
        fi
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi
    
    if ! command -v git &> /dev/null; then
        missing_deps+=("git")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies:"
        for dep in "${missing_deps[@]}"; do
            echo "  - $dep"
        done
        echo ""
        echo "Please install the missing dependencies and run this script again."
        exit 1
    fi
    
    print_success "All dependencies are installed"
}

# Create directory structure
create_directories() {
    print_header "Creating Directory Structure"
    
    # Create main directories
    mkdir -p .github/workflows
    mkdir -p frontend/{app,components,lib,hooks,public,styles}
    mkdir -p frontend/components/ui
    mkdir -p backend/{src,prisma}
    mkdir -p backend/src/{api,lib,middleware,services}
    mkdir -p docs
    mkdir -p scripts
    
    print_success "Directory structure created"
}

# Copy configuration files
setup_configuration() {
    print_header "Setting Up Configuration Files"
    
    # Note: This script assumes you've already created the files
    # In a real scenario, you'd copy them from templates
    
    print_step "Configuration files should be placed in their respective directories"
    print_warning "Make sure all the artifact files are properly placed"
}

# Setup environment files
setup_environment() {
    print_header "Setting Up Environment Variables"
    
    # Frontend environment
    if [ ! -f frontend/.env.local ]; then
        if [ -f frontend/.env.example ]; then
            cp frontend/.env.example frontend/.env.local
            print_success "Created frontend/.env.local"
        else
            print_warning "frontend/.env.example not found. Please create environment file manually."
        fi
    else
        print_success "frontend/.env.local already exists"
    fi
    
    # Backend environment
    if [ ! -f backend/.env ]; then
        if [ -f backend/.env.example ]; then
            cp backend/.env.example backend/.env
            print_success "Created backend/.env"
        else
            print_warning "backend/.env.example not found. Please create environment file manually."
        fi
    else
        print_success "backend/.env already exists"
    fi
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    # Frontend dependencies
    print_step "Installing frontend dependencies..."
    cd frontend
    if [ -f package.json ]; then
        npm install
        print_success "Frontend dependencies installed"
    else
        print_error "frontend/package.json not found"
        cd ..
        return 1
    fi
    cd ..
    
    # Backend dependencies
    print_step "Installing backend dependencies..."
    cd backend
    if [ -f package.json ]; then
        npm install
        print_success "Backend dependencies installed"
    else
        print_error "backend/package.json not found"
        cd ..
        return 1
    fi
    cd ..
}

# Setup database
setup_database() {
    print_header "Setting Up Database"
    
    cd backend
    
    if [ -f prisma/schema.prisma ]; then
        print_step "Generating Prisma client..."
        npm run db:generate
        print_success "Prisma client generated"
        
        # Check if database URL is configured
        if grep -q "DATABASE_URL.*localhost" .env 2>/dev/null; then
            print_step "Pushing database schema..."
            npm run db:push
            print_success "Database schema pushed"
        else
            print_warning "Database URL not configured or not pointing to localhost"
            print_warning "Please configure your database and run: npm run db:push"
        fi
    else
        print_error "prisma/schema.prisma not found"
    fi
    
    cd ..
}

# Build applications
build_applications() {
    print_header "Building Applications"
    
    # Build frontend
    print_step "Building frontend..."
    cd frontend
    npm run build
    if [ $? -eq 0 ]; then
        print_success "Frontend built successfully"
    else
        print_error "Frontend build failed"
        cd ..
        return 1
    fi
    cd ..
    
    # Build backend
    print_step "Building backend..."
    cd backend
    npm run build
    if [ $? -eq 0 ]; then
        print_success "Backend built successfully"
    else
        print_error "Backend build failed"
        cd ..
        return 1
    fi
    cd ..
}

# Run tests
run_tests() {
    print_header "Running Tests"
    
    # Frontend tests
    print_step "Running frontend tests..."
    cd frontend
    if npm run test:ci; then
        print_success "Frontend tests passed"
    else
        print_warning "Frontend tests failed or no tests found"
    fi
    cd ..
    
    # Backend tests
    print_step "Running backend tests..."
    cd backend
    if npm run test; then
        print_success "Backend tests passed"
    else
        print_warning "Backend tests failed or no tests found"
    fi
    cd ..
}

# Display next steps
show_next_steps() {
    print_header "Setup Complete! Next Steps"
    
    echo -e "${GREEN}🎉 Your AI Agent Orchestrator is ready!${NC}\n"
    
    echo -e "${BLUE}To start development:${NC}"
    echo "1. Configure your environment variables:"
    echo "   - Edit frontend/.env.local"
    echo "   - Edit backend/.env (add your Cerebras API key)"
    echo ""
    echo "2. Start the development servers:"
    echo "   Terminal 1: cd backend && npm run dev"
    echo "   Terminal 2: cd frontend && npm run dev"
    echo ""
    echo "3. Access your application:"
    echo "   - Frontend: http://localhost:3000"
    echo "   - Backend API: http://localhost:3002"
    echo "   - Health Check: http://localhost:3002/health"
    echo ""
    
    echo -e "${BLUE}To deploy to production:${NC}"
    echo "1. Set up GitHub secrets for deployment"
    echo "2. Push to main branch to trigger CI/CD"
    echo "3. Monitor deployment in GitHub Actions"
    echo ""
    
    echo -e "${BLUE}Required environment variables:${NC}"
    echo "- CEREBRAS_API_KEY: Your Cerebras API key"
    echo "- DATABASE_URL: PostgreSQL connection string"
    echo "- JWT_SECRET: Secret for JWT tokens"
    echo ""
    
    echo -e "${YELLOW}Documentation:${NC}"
    echo "- Project documentation: docs/"
    echo "- API documentation: docs/API.md"
    echo "- CI/CD setup: docs/CI_CD_SETUP.md"
    echo ""
    
    echo -e "${GREEN}Happy coding! 🚀${NC}"
}

# Handle script interruption
cleanup() {
    print_error "Setup interrupted"
    exit 1
}

trap cleanup SIGINT SIGTERM

# Main execution
main() {
    print_header "AI Agent Orchestrator Setup"
    echo -e "${PURPLE}Welcome! This script will set up your development environment.${NC}\n"
    
    check_dependencies
    create_directories
    setup_configuration
    setup_environment
    
    if install_dependencies; then
        if setup_database; then
            if build_applications; then
                run_tests
                show_next_steps
            else
                print_error "Build failed. Please check the errors above."
                exit 1
            fi
        else
            print_warning "Database setup had issues. You may need to configure it manually."
            show_next_steps
        fi
    else
        print_error "Dependency installation failed. Please check the errors above."
        exit 1
    fi
}

# Check if script is being run from the correct directory
if [ ! -f PROJECT_STRUCTURE.md ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Run main function
main "$@"