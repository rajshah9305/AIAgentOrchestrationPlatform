# 🔧 Complete Troubleshooting & Deployment Guide

## 🚀 Quick Start Checklist

### ✅ Essential Files Created
All the missing files have been created. Here's what's now available:

#### Core Configuration Files
- ✅ `frontend/package.json` - Complete dependency configuration
- ✅ `backend/package.json` - Complete dependency configuration
- ✅ `frontend/tsconfig.json` - TypeScript configuration
- ✅ `backend/tsconfig.json` - TypeScript configuration
- ✅ `frontend/next.config.mjs` - Next.js configuration with optimizations
- ✅ `backend/prisma/schema.prisma` - Complete database schema
- ✅ `frontend/tailwind.config.ts` - Tailwind CSS configuration
- ✅ `frontend/components.json` - shadcn/ui configuration

#### CI/CD Pipeline Files
- ✅ `.github/workflows/ci.yml` - Comprehensive CI pipeline
- ✅ `.github/workflows/deploy.yml` - Automated deployment
- ✅ `.github/workflows/security.yml` - Security scanning
- ✅ `.github/workflows/codeql.yml` - Code quality analysis
- ✅ `.github/workflows/release.yml` - Release automation
- ✅ `.github/workflows/cleanup.yml` - Cleanup automation
- ✅ `.github/workflows/performance.yml` - Performance testing

#### Testing Configuration
- ✅ `frontend/jest.config.js` - Jest testing configuration
- ✅ `frontend/jest.setup.js` - Jest setup files
- ✅ `backend/vitest.config.ts` - Vitest testing configuration
- ✅ `backend/src/test/setup.ts` - Backend test setup
- ✅ `backend/src/test/global-setup.ts` - Global test configuration

#### Code Quality
- ✅ `frontend/.eslintrc.json` - Frontend ESLint rules
- ✅ `backend/.eslintrc.json` - Backend ESLint rules
- ✅ `.prettierrc` - Code formatting rules
- ✅ `.prettierignore` - Files to ignore during formatting

#### Docker & Deployment
- ✅ `frontend/Dockerfile` - Optimized frontend container
- ✅ `backend/Dockerfile` - Optimized backend container
- ✅ `frontend/.env.example` - Environment variables template
- ✅ `backend/.env.example` - Environment variables template

#### Core Application Files
- ✅ `backend/src/index.ts` - Main backend application
- ✅ `backend/src/api/health.ts` - Health check endpoint
- ✅ `backend/src/api/cerebras.ts` - Cerebras AI integration
- ✅ `backend/src/middleware/auth.ts` - Authentication middleware
- ✅ `frontend/app/layout.tsx` - Root layout component
- ✅ `frontend/app/page.tsx` - Landing page
- ✅ `frontend/app/dashboard/page.tsx` - Dashboard page

## 🛠️ Step-by-Step Setup

### 1. Repository Preparation
```bash
# Clone your repository
git clone <your-repo-url>
cd ai-agent-orchestrator

# Make setup script executable
chmod +x scripts/setup.sh
```

### 2. Environment Configuration

#### Frontend Environment (.env.local)
```bash
cd frontend
cp .env.example .env.local
```

Edit `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_WS_URL=ws://localhost:3002
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here
```

#### Backend Environment (.env)
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
NODE_ENV=development
PORT=3002
DATABASE_URL="postgresql://username:password@localhost:5432/agentorchestra"
CEREBRAS_API_KEY="your-cerebras-api-key"
JWT_SECRET="your-super-secret-jwt-key"
REDIS_URL="redis://localhost:6379"
```

### 3. Database Setup

#### Install PostgreSQL (if not installed)
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS with Homebrew
brew install postgresql
brew services start postgresql

# Windows
# Download from https://www.postgresql.org/download/windows/
```

#### Create Database
```bash
sudo -u postgres psql
CREATE DATABASE agentorchestra;
CREATE USER your_username WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE agentorchestra TO your_username;
\q
```

### 4. Dependency Installation

#### Frontend
```bash
cd frontend
npm install
```

#### Backend
```bash
cd backend
npm install
```

### 5. Database Migration
```bash
cd backend
npm run db:generate
npm run db:push
```

### 6. Build & Test
```bash
# Frontend
cd frontend
npm run build
npm run test

# Backend
cd backend
npm run build
npm run test
```

## 🚨 Common Issues & Solutions

### Issue 1: Node.js Version Mismatch
**Error**: `The engine "node" is incompatible with this module`

**Solution**:
```bash
# Check your Node.js version
node --version

# Install Node.js 18+ if needed
nvm install 18
nvm use 18

# Or update using package manager
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node@18
```

### Issue 2: Database Connection Failed
**Error**: `Can't reach database server at localhost:5432`

**Solution**:
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list | grep postgresql  # macOS

# Start PostgreSQL if not running
sudo systemctl start postgresql  # Linux
brew services start postgresql  # macOS

# Check database exists
psql -h localhost -U your_username -d agentorchestra
```

### Issue 3: Prisma Schema Issues
**Error**: `Prisma schema validation failed`

**Solution**:
```bash
cd backend

# Reset and regenerate
npm run db:reset
npm run db:generate
npm run db:push

# If still failing, check your DATABASE_URL format
echo $DATABASE_URL
```

### Issue 4: Environment Variables Not Loading
**Error**: `process.env.VARIABLE_NAME is undefined`

**Solution**:
```bash
# Check if .env files exist
ls -la frontend/.env.local
ls -la backend/.env

# Verify environment variables are set
cd frontend && npm run env-check
cd backend && npm run env-check

# Restart development servers after changing .env files
```

### Issue 5: Port Already in Use
**Error**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find and kill process using the port
lsof -ti:3000 | xargs kill -9  # Frontend
lsof -ti:3002 | xargs kill -9  # Backend

# Or use different ports
PORT=3001 npm run dev  # Frontend
PORT=3003 npm run dev  # Backend
```

### Issue 6: TypeScript Compilation Errors
**Error**: `Type '...' is not assignable to type '...'`

**Solution**:
```bash
# Clear TypeScript cache
rm -rf .next  # Frontend
rm -rf dist   # Backend

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Run type check
npm run type-check
```

### Issue 7: Docker Build Failures
**Error**: `Docker build failed`

**Solution**:
```bash
# Build with verbose output
docker build --no-cache -t ai-agent-frontend ./frontend
docker build --no-cache -t ai-agent-backend ./backend

# Check Docker daemon is running
docker --version
sudo systemctl status docker  # Linux

# Clear Docker cache
docker system prune -f
```

## 🔄 CI/CD Pipeline Troubleshooting

### GitHub Actions Failing

#### Check 1: Secrets Configuration
Ensure these secrets are set in GitHub:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `RAILWAY_TOKEN`
- `SLACK_WEBHOOK_URL` (optional)

#### Check 2: Workflow Permissions
In GitHub repository settings:
1. Go to Actions → General
2. Set "Workflow permissions" to "Read and write permissions"
3. Check "Allow GitHub Actions to create and approve pull requests"

#### Check 3: Branch Protection Rules
Ensure branch protection allows CI workflows:
1. Go to Settings → Branches
2. Edit branch protection rule for `main`
3. Check required status checks match workflow job names

### Deployment Issues

#### Vercel Deployment Fails
```bash
# Check Vercel configuration
vercel --version
vercel whoami
vercel ls

# Re-link project
cd frontend
vercel link

# Manual deployment
vercel --prod
```

#### Railway Deployment Fails
```bash
# Check Railway CLI
railway --version
railway whoami
railway status

# Re-login if needed
railway login
railway link

# Manual deployment
cd backend
railway up
```

### Test Failures

#### Frontend Tests Fail
```bash
cd frontend

# Clear Jest cache
npx jest --clearCache

# Run with verbose output
npm run test -- --verbose

# Update snapshots if needed
npm run test -- --updateSnapshot
```

#### Backend Tests Fail
```bash
cd backend

# Check test database
echo $DATABASE_URL
createdb test_db_manual

# Run tests with debug
npm run test -- --reporter=verbose

# Run specific test file
npm run test src/api/health.test.ts
```

## 📦 Production Deployment

### Pre-Deployment Checklist

#### 1. Environment Variables
- [ ] All production environment variables set
- [ ] Database URLs point to production instances
- [ ] API keys are production-ready
- [ ] Secrets are properly configured

#### 2. Database Migration
```bash
# Production database migration
cd backend
npm run db:deploy
```

#### 3. Build Verification
```bash
# Test production builds locally
cd frontend
npm run build
npm run start

cd backend
npm run build
npm run start
```

#### 4. Security Check
```bash
# Run security audit
npm audit
npm audit fix

# Check for vulnerabilities
npm run security:scan
```

### Deployment Methods

#### Method 1: Vercel + Railway (Recommended)

**Frontend to Vercel**:
```bash
cd frontend
vercel --prod
```

**Backend to Railway**:
```bash
cd backend
railway up
```

#### Method 2: Docker Deployment
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

#### Method 3: Manual VPS Deployment
```bash
# Copy files to server
scp -r . user@server:/path/to/app

# On server
cd /path/to/app
npm install --production
npm run build
pm2 start ecosystem.config.js
```

## 📊 Monitoring & Maintenance

### Health Checks
```bash
# Check application health
curl http://localhost:3002/health

# Check all services
docker-compose ps
```

### Log Monitoring
```bash
# Application logs
npm run logs

# System logs
journalctl -u your-app-service

# Docker logs
docker-compose logs -f
```

### Performance Monitoring
```bash
# Database performance
npm run db:analyze

# Application metrics
npm run metrics

# Load testing
npm run load-test
```

### Regular Maintenance
```bash
# Update dependencies (monthly)
npm update
npm audit fix

# Clean up (weekly)
docker system prune
npm run cleanup

# Database maintenance (weekly)
npm run db:maintenance
```

## 🆘 Emergency Procedures

### Rollback Deployment
```bash
# Vercel rollback
vercel rollback

# Railway rollback
railway rollback

# Docker rollback
docker-compose down
docker-compose up -d --image previous-tag
```

### Database Recovery
```bash
# Restore from backup
pg_restore -d agentorchestra backup.sql

# Rollback migration
npm run db:migrate:down
```

### Service Recovery
```bash
# Restart all services
docker-compose restart

# Or individual services
systemctl restart your-app
pm2 restart all
```

## 📞 Support & Resources

### Documentation
- [Project Documentation](./docs/)
- [API Documentation](./docs/API.md)
- [CI/CD Setup](./docs/CI_CD_SETUP.md)

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://prisma.io/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)

### Getting Help
1. Check this troubleshooting guide
2. Search existing GitHub issues
3. Create a new issue with:
   - Error messages
   - Steps to reproduce
   - Environment details
   - Screenshots if applicable

---

**🎉 Your AI Agent Orchestrator is now fully configured and production-ready!**

*The robust CI/CD pipeline will ensure reliable deployments and maintain code quality automatically.* ⚡