# 🚀 Deployment Guide

This guide covers all deployment scenarios for the AI Agent Orchestrator platform.

## 📋 Prerequisites

Before deploying, ensure you have:

- **Node.js 18+** installed
- **Git** installed
- **Docker** (optional, for containerized deployment)
- **PostgreSQL** database (local or cloud)
- **Redis** instance (local or cloud)
- **Cerebras API key** (for AI functionality)

## 🏠 Local Development

### Quick Start

```bash
# Clone and setup
git clone https://github.com/your-username/ai-agent-orchestrator.git
cd ai-agent-orchestrator

# Run automated setup
./setup.sh

# Start development servers
cd backend && npm run dev &
cd frontend && npm run dev &
```

### Manual Setup

1. **Install dependencies**
   ```bash
   cd backend && npm install
   cd frontend && npm install
   ```

2. **Setup environment**
   ```bash
   cp backend/env.example backend/.env
   cp frontend/env.example frontend/.env.local
   # Edit with your actual values
   ```

3. **Setup database**
   ```bash
   cd backend
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```

4. **Start servers**
   ```bash
   # Backend (port 3001)
   cd backend && npm run dev
   
   # Frontend (port 3000)
   cd frontend && npm run dev
   ```

## ☁️ Cloud Deployment

### Vercel (Frontend) + Railway (Backend)

#### 1. Deploy Backend to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy backend
cd backend
railway init
railway up
```

**Environment Variables for Railway:**
```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-secret
CEREBRAS_API_KEY=your-key
NODE_ENV=production
PORT=3001
```

#### 2. Deploy Frontend to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy frontend
cd frontend
vercel --prod
```

**Environment Variables for Vercel:**
```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_WS_URL=wss://your-backend.railway.app
NEXT_PUBLIC_CEREBRAS_API_KEY=your-key
```

### Docker Deployment

#### Using Docker Compose

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

#### Individual Containers

```bash
# Build images
docker build -t ai-orchestrator-backend ./backend
docker build -t ai-orchestrator-frontend ./frontend

# Run backend
docker run -d \
  --name ai-orchestrator-backend \
  -p 3001:3001 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  ai-orchestrator-backend

# Run frontend
docker run -d \
  --name ai-orchestrator-frontend \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:3001 \
  ai-orchestrator-frontend
```

### AWS Deployment

#### Using AWS ECS

1. **Create ECR repositories**
   ```bash
   aws ecr create-repository --repository-name ai-orchestrator-backend
   aws ecr create-repository --repository-name ai-orchestrator-frontend
   ```

2. **Build and push images**
   ```bash
   # Backend
   docker build -t ai-orchestrator-backend ./backend
   docker tag ai-orchestrator-backend:latest $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/ai-orchestrator-backend:latest
   docker push $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/ai-orchestrator-backend:latest

   # Frontend
   docker build -t ai-orchestrator-frontend ./frontend
   docker tag ai-orchestrator-frontend:latest $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/ai-orchestrator-frontend:latest
   docker push $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/ai-orchestrator-frontend:latest
   ```

3. **Deploy to ECS**
   ```bash
   # Create ECS cluster and services
   aws ecs create-cluster --cluster-name ai-orchestrator
   
   # Create task definitions and services
   # (Use AWS Console or CloudFormation for full setup)
   ```

### Google Cloud Platform

#### Using Cloud Run

```bash
# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build and push images
gcloud builds submit --tag gcr.io/$PROJECT_ID/ai-orchestrator-backend ./backend
gcloud builds submit --tag gcr.io/$PROJECT_ID/ai-orchestrator-frontend ./frontend

# Deploy to Cloud Run
gcloud run deploy ai-orchestrator-backend \
  --image gcr.io/$PROJECT_ID/ai-orchestrator-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

gcloud run deploy ai-orchestrator-frontend \
  --image gcr.io/$PROJECT_ID/ai-orchestrator-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## 🔧 Environment Configuration

### Required Environment Variables

#### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database
DIRECT_URL=postgresql://user:password@host:5432/database

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# AI Services
CEREBRAS_API_KEY=your-cerebras-api-key
OPENAI_API_KEY=your-openai-api-key

# Cache & Queues
REDIS_URL=redis://host:6379

# Application
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-domain.com

# Security
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Frontend (.env.local)
```env
# API Configuration
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_WS_URL=wss://api.your-domain.com

# AI Services
NEXT_PUBLIC_CEREBRAS_API_KEY=your-cerebras-api-key

# Application
NEXT_PUBLIC_APP_NAME="AI Agent Orchestrator"
NEXT_PUBLIC_APP_VERSION="1.0.0"
```

## 🗄️ Database Setup

### PostgreSQL

#### Local Setup
```bash
# Install PostgreSQL
brew install postgresql  # macOS
sudo apt-get install postgresql  # Ubuntu

# Create database
createdb ai_orchestrator

# Run migrations
cd backend
npm run db:push
npm run db:seed
```

#### Cloud Options

**Railway PostgreSQL:**
```bash
railway add postgresql
railway variables set DATABASE_URL=$DATABASE_URL
```

**Supabase:**
1. Create project at https://supabase.com
2. Get connection string from Settings > Database
3. Update DATABASE_URL

**PlanetScale:**
```bash
# Install PlanetScale CLI
brew install planetscale/tap/pscale

# Create database
pscale database create ai-orchestrator

# Get connection string
pscale connect ai-orchestrator main
```

### Redis

#### Local Setup
```bash
# Install Redis
brew install redis  # macOS
sudo apt-get install redis-server  # Ubuntu

# Start Redis
redis-server
```

#### Cloud Options

**Railway Redis:**
```bash
railway add redis
railway variables set REDIS_URL=$REDIS_URL
```

**Upstash Redis:**
1. Create database at https://upstash.com
2. Get connection string
3. Update REDIS_URL

## 🔒 Security Configuration

### SSL/TLS
- Use HTTPS in production
- Configure SSL certificates (Let's Encrypt recommended)
- Enable HSTS headers

### Authentication
- Use strong JWT secrets
- Implement rate limiting
- Enable CORS properly
- Use environment variables for secrets

### Database Security
- Use connection pooling
- Enable SSL connections
- Restrict database access
- Regular backups

## 📊 Monitoring & Logging

### Application Monitoring
```bash
# Health checks
curl https://your-api.com/health

# Metrics endpoint
curl https://your-api.com/api/metrics
```

### Logging
- Backend uses Winston for logging
- Frontend logs to browser console
- Consider using services like:
  - Sentry (error tracking)
  - LogRocket (session replay)
  - PostHog (analytics)

## 🚨 Troubleshooting

### Common Issues

**Database Connection:**
```bash
# Check database connection
cd backend
npm run db:studio
```

**Redis Connection:**
```bash
# Test Redis connection
redis-cli ping
```

**Build Issues:**
```bash
# Clear cache and rebuild
cd frontend
rm -rf .next
npm run build
```

**Port Conflicts:**
```bash
# Check port usage
lsof -i :3000
lsof -i :3001
```

### Performance Optimization

**Backend:**
- Enable compression
- Use connection pooling
- Implement caching
- Monitor memory usage

**Frontend:**
- Enable Next.js optimizations
- Use image optimization
- Implement code splitting
- Monitor bundle size

## 📈 Scaling

### Horizontal Scaling
- Use load balancers
- Implement session sharing
- Use external Redis for sessions
- Consider microservices architecture

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Use CDN for static assets
- Implement caching strategies

## 🔄 CI/CD Pipeline

### GitHub Actions
The project includes GitHub Actions workflows for:
- Automated testing
- Code quality checks
- Deployment to staging/production
- Security scanning

### Manual Deployment
```bash
# Build for production
cd backend && npm run build
cd frontend && npm run build

# Deploy
./deploy.sh --all
```

## 📞 Support

For deployment issues:
1. Check the logs: `docker-compose logs` or platform logs
2. Verify environment variables
3. Test database connections
4. Check network connectivity
5. Review security group/firewall settings

---

**Need help?** Open an issue on GitHub or check the documentation in the `docs/` directory. 