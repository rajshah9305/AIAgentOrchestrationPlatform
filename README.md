# AI Agent Orchestrator

A comprehensive AI agent orchestration platform with Cerebras integration, featuring a modern React/Three.js frontend and a robust Express/TypeScript backend.

## 🚀 Features

- **AI Agent Orchestration**: Manage and execute AI agents with advanced configuration options
- **Cerebras Integration**: Seamless integration with Cerebras AI models for ultra-fast inference
- **Real-time Dashboard**: Interactive 3D visualization with Three.js
- **Multi-Framework Support**: Execute agents across different AI frameworks (AutoGen, CrewAI, AutoGPT, BabyAGI, LangGraph)
- **WebSocket Real-time Updates**: Live status updates and notifications
- **Background Job Processing**: Scalable job queue with Bull and Redis
- **Comprehensive API**: RESTful API with authentication and rate limiting
- **Production Ready**: Docker support, CI/CD pipeline, and deployment scripts
- **Modern UI**: Responsive design with dark theme and 3D elements

## 🏗️ Architecture

```
├── frontend/                 # React/Next.js frontend
│   ├── app/                 # Next.js app directory
│   ├── components/          # React components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility libraries
│   └── public/             # Static assets
├── backend/                 # Express/TypeScript backend
│   ├── src/
│   │   ├── api/            # API routes
│   │   ├── services/       # Business logic services
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Data models
│   │   └── utils/          # Utility functions
│   └── prisma/             # Database schema and migrations
├── docs/                   # Documentation
├── scripts/                # Deployment and utility scripts
└── .github/                # GitHub Actions workflows
```

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Next.js 14** with App Router
- **Three.js** for 3D visualizations
- **React Three Fiber** for React Three.js integration
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **Zustand** for state management
- **Socket.io Client** for real-time updates

### Backend
- **Node.js** with TypeScript
- **Express.js** web framework
- **Prisma** ORM with PostgreSQL
- **Redis** for caching and job queues
- **Bull** for background job processing
- **Socket.io** for WebSocket connections
- **JWT** for authentication
- **Winston** for logging
- **Zod** for validation

### Infrastructure
- **Docker** for containerization
- **GitHub Actions** for CI/CD
- **Vercel** for frontend deployment
- **Railway** for backend deployment
- **PostgreSQL** for database
- **Redis** for caching

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- Docker (optional)
- PostgreSQL database
- Redis instance

### One-Click Setup

**For immediate deployment and testing:**

```bash
# Clone the repository
git clone https://github.com/your-username/ai-agent-orchestrator.git
cd ai-agent-orchestrator

# Run the automated setup script
./setup.sh
```

This script will:
- ✅ Check all prerequisites
- ✅ Generate environment files
- ✅ Install all dependencies
- ✅ Setup database and seed data
- ✅ Build both applications
- ✅ Run all tests
- ✅ Verify code quality

### Manual Setup

If you prefer manual setup:

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/ai-agent-orchestrator.git
   cd ai-agent-orchestrator
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   cd frontend
   npm install
   cd ..
   
   # Install backend dependencies
   cd backend
   npm install
   cd ..
   ```

3. **Setup environment variables**
   ```bash
   # Copy environment templates
   cp backend/env.example backend/.env
   cp frontend/env.example frontend/.env.local
   
   # Edit the files with your actual values
   nano backend/.env
   nano frontend/.env.local
   ```

4. **Setup database**
   ```bash
   cd backend
   npm run db:generate
   npm run db:push
   npm run db:seed
   cd ..
   ```

5. **Start development servers**
   ```bash
   # Frontend (in one terminal)
   cd frontend
   npm run dev
   
   # Backend (in another terminal)
   cd backend
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - API Documentation: http://localhost:3001/api

## 🐳 Docker Deployment

### Using Docker Compose
```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Individual Docker Images
```bash
# Build frontend
cd frontend
docker build -t ai-agent-orchestrator-frontend .

# Build backend
cd backend
docker build -t ai-agent-orchestrator-backend .
```

## 🚀 Production Deployment

### Automated Deployment
```bash
# Run complete deployment
./deploy.sh --all

# Check prerequisites only
./deploy.sh --check-prerequisites

# Deploy to specific platforms
./deploy.sh --vercel    # Deploy frontend to Vercel
./deploy.sh --railway   # Deploy backend to Railway
```

### Manual Deployment

#### Frontend (Vercel)
```bash
cd frontend
npm run build
vercel --prod
```

#### Backend (Railway)
```bash
cd backend
npm run build
railway up
```

## 🧪 Testing

### Frontend Tests
```bash
cd frontend
npm run test           # Run tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage
```

### Backend Tests
```bash
cd backend
npm run test           # Run tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage
```

## 📚 API Documentation

The API documentation is available at `/api` when the backend is running.

### Key Endpoints
- `POST /api/agents/execute` - Execute an AI agent
- `GET /api/agents/status/:id` - Get agent execution status
- `POST /api/configurations/save` - Save agent configuration
- `GET /api/configurations/templates` - Get configuration templates
- `POST /api/webhooks/register` - Register webhook endpoints

## 🔧 Configuration

### Environment Variables

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_CEREBRAS_API_KEY=your_cerebras_api_key
```

#### Backend (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/ai_orchestrator
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret
CEREBRAS_API_KEY=your_cerebras_api_key
CEREBRAS_API_URL=https://api.cerebras.com
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation for new features
- Follow the existing code style
- Ensure all tests pass before submitting PR

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the [docs/](docs/) directory
- **Issues**: Report bugs and feature requests on [GitHub Issues](https://github.com/your-username/ai-agent-orchestrator/issues)
- **Discussions**: Join the conversation on [GitHub Discussions](https://github.com/your-username/ai-agent-orchestrator/discussions)

## 🗺️ Roadmap

- [ ] Multi-tenant support
- [ ] Advanced agent scheduling
- [ ] Agent marketplace
- [ ] Performance analytics dashboard
- [ ] Mobile application
- [ ] Advanced security features
- [ ] Integration with more AI frameworks

## 🙏 Acknowledgments

- [Cerebras](https://www.cerebras.net/) for AI model integration
- [Three.js](https://threejs.org/) for 3D graphics
- [Prisma](https://www.prisma.io/) for database ORM
- [Vercel](https://vercel.com/) for frontend hosting
- [Railway](https://railway.app/) for backend hosting

---

**Made with ❤️ by the AI Agent Orchestrator Team** 