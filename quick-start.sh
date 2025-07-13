#!/bin/bash

# AI Agent Orchestrator - Quick Start Script
# This script provides immediate setup for demo and testing

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 AI Agent Orchestrator - Quick Start${NC}"
echo "======================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js not found. Please install Node.js 18+ first.${NC}"
    echo "Visit: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) detected${NC}"

# Create minimal environment files for demo
echo -e "${BLUE}📝 Creating demo environment files...${NC}"

# Backend .env for demo
cat > backend/.env << 'EOF'
# Demo Environment - Replace with real values for production
DATABASE_URL="postgresql://demo:demo@localhost:5432/ai_orchestrator_demo"
DIRECT_URL="postgresql://demo:demo@localhost:5432/ai_orchestrator_demo"
JWT_SECRET="demo-jwt-secret-change-in-production"
JWT_EXPIRES_IN="7d"
CEREBRAS_API_KEY="demo-key"
OPENAI_API_KEY="demo-key"
REDIS_URL="redis://localhost:6379"
NODE_ENV="development"
PORT="3001"
FRONTEND_URL="http://localhost:3000"
LOG_LEVEL="info"
CORS_ORIGIN="http://localhost:3000"
RATE_LIMIT_WINDOW_MS="900000"
RATE_LIMIT_MAX_REQUESTS="100"
EOF

# Frontend .env.local for demo
cat > frontend/.env.local << 'EOF'
# Demo Environment - Replace with real values for production
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_CEREBRAS_API_KEY=demo-key
NEXT_PUBLIC_APP_NAME="AI Agent Orchestrator"
NEXT_PUBLIC_APP_VERSION="1.0.0"
NEXT_PUBLIC_ENABLE_ANALYTICS=false
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
NEXT_PUBLIC_ENABLE_3D_BACKGROUND=true
EOF

echo -e "${GREEN}✅ Environment files created${NC}"

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"

cd backend
npm install --silent
cd ../frontend
npm install --silent
cd ..

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Setup database (if PostgreSQL is available)
echo -e "${BLUE}🗄️  Setting up database...${NC}"

if command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL detected. Setting up demo database...${NC}"
    echo "Note: You may need to create the database manually:"
    echo "  createdb ai_orchestrator_demo"
    echo ""
    
    cd backend
    npx prisma generate --silent
    npx prisma db push --accept-data-loss --silent || echo "Database setup skipped (manual setup required)"
    npm run db:seed --silent || echo "Database seeding skipped"
    cd ..
else
    echo -e "${YELLOW}⚠️  PostgreSQL not found. Database setup skipped.${NC}"
    echo "Install PostgreSQL to enable full functionality:"
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu: sudo apt-get install postgresql"
fi

# Build applications
echo -e "${BLUE}🔨 Building applications...${NC}"

cd backend
npm run build --silent
cd ../frontend
npm run build --silent
cd ..

echo -e "${GREEN}✅ Applications built${NC}"

# Start development servers
echo -e "${BLUE}🚀 Starting development servers...${NC}"
echo ""
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo "Starting servers in background..."
echo ""

# Start backend
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Start frontend
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait a moment for servers to start
sleep 5

echo -e "${GREEN}✅ Servers started!${NC}"
echo ""
echo "🌐 Access your application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "   API Docs: http://localhost:3001/api"
echo ""
echo "📊 Monitor logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "🛑 Stop servers:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo -e "${YELLOW}⚠️  Demo Mode${NC}"
echo "This is running in demo mode with placeholder API keys."
echo "For production use, update the environment files with real values."
echo ""
echo "📚 Next steps:"
echo "1. Visit http://localhost:3000 to see the application"
echo "2. Check out the API at http://localhost:3001/api"
echo "3. Read the full documentation in DEPLOYMENT.md"
echo "4. Update environment variables for production use"
echo ""

# Keep script running
echo "Press Ctrl+C to stop all servers"
trap "echo ''; echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait 