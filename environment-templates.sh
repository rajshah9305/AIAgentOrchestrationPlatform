# backend/.env.example
# Application
NODE_ENV=development
PORT=3002
LOG_LEVEL=info

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/agentorchestra"
DIRECT_URL="postgresql://username:password@localhost:5432/agentorchestra"
DB_CONNECTION_POOL_SIZE=20

# Authentication
JWT_SECRET="your-super-secret-jwt-key-min-32-characters"
JWT_EXPIRES_IN="7d"
SESSION_SECRET="your-session-secret-min-32-characters"

# OAuth Providers (Optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# AI Services
CEREBRAS_API_KEY="your-cerebras-api-key"
OPENAI_API_KEY="" # Optional
ANTHROPIC_API_KEY="" # Optional

# Redis
REDIS_URL="redis://localhost:6379"
REDIS_CONNECTION_POOL_SIZE=10

# Security
ENCRYPTION_KEY="your-32-byte-hex-encryption-key"
API_SECRET_KEY="your-api-secret-key-min-32-chars"
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Email (Optional)
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM=""

# File Storage (Optional)
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_S3_BUCKET=""
AWS_REGION="us-east-1"

# Frontend
FRONTEND_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"

# Monitoring (Optional)
SENTRY_DSN=""
POSTHOG_KEY=""

# Performance
MAX_EXECUTION_TIME=300000
MAX_CONCURRENT_EXECUTIONS=50

---

# frontend/.env.example
# Application
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_WS_URL=ws://localhost:3002

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET="your-nextauth-secret-min-32-characters"

# OAuth Providers
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# Optional Services
NEXT_PUBLIC_POSTHOG_KEY=""
NEXT_PUBLIC_SENTRY_DSN=""

---

# scripts/generate-secrets.sh
#!/bin/bash

# Generate secure secrets for environment variables

echo "🔐 Generating secure secrets..."

# Generate JWT secret (32 bytes hex)
JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET=\"$JWT_SECRET\""

# Generate NextAuth secret (32 bytes hex)
NEXTAUTH_SECRET=$(openssl rand -hex 32)
echo "NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\""

# Generate Session secret (32 bytes hex)
SESSION_SECRET=$(openssl rand -hex 32)
echo "SESSION_SECRET=\"$SESSION_SECRET\""

# Generate API secret key (32 bytes hex)
API_SECRET_KEY=$(openssl rand -hex 32)
echo "API_SECRET_KEY=\"$API_SECRET_KEY\""

# Generate Encryption key (32 bytes hex)
ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "ENCRYPTION_KEY=\"$ENCRYPTION_KEY\""

echo "
✅ Secrets generated successfully!
Copy these values to your .env file.
Keep these values secure and never commit them to version control.
"

---

# scripts/setup-local.sh
#!/bin/bash
set -e

echo "🚀 Setting up AI Agent Orchestrator locally..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }

# Create environment files if they don't exist
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env"
fi

if [ ! -f frontend/.env.local ]; then
    cp frontend/.env.example frontend/.env.local
    echo "✅ Created frontend/.env.local"
fi

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Install dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

echo "🔨 Setting up database..."
npm run db:generate
npm run db:push
npm run db:seed

cd ..

echo "📦 Installing frontend dependencies..."
cd frontend
npm install

cd ..

echo "
✅ Setup complete!

To start the development servers:

Backend:
  cd backend && npm run dev

Frontend:
  cd frontend && npm run dev

The application will be available at:
  Frontend: http://localhost:3000
  Backend API: http://localhost:3002
  Database: localhost:5432
  Redis: localhost:6379
"

---

# scripts/deploy-production.sh
#!/bin/bash
set -e

echo "🚀 Deploying to production..."

# Check if production environment is configured
if [ -z "$PRODUCTION_SERVER" ]; then
    echo "❌ PRODUCTION_SERVER environment variable not set"
    exit 1
fi

# Build Docker images
echo "🏗️ Building Docker images..."
docker build -t agentorchestra-backend:latest ./backend
docker build -t agentorchestra-frontend:latest ./frontend

# Tag images
docker tag agentorchestra-backend:latest $DOCKER_REGISTRY/agentorchestra-backend:latest
docker tag agentorchestra-frontend:latest $DOCKER_REGISTRY/agentorchestra-frontend:latest

# Push images
echo "📤 Pushing images to registry..."
docker push $DOCKER_REGISTRY/agentorchestra-backend:latest
docker push $DOCKER_REGISTRY/agentorchestra-frontend:latest

# Deploy to server
echo "🚀 Deploying to production server..."
ssh $PRODUCTION_SERVER << EOF
  cd /opt/agentorchestra
  docker-compose pull
  docker-compose down
  docker-compose up -d
  docker system prune -f
EOF

echo "✅ Deployment complete!"

---

# scripts/backup-database.sh
#!/bin/bash

# Database backup script

BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/agentorchestra_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Perform backup
echo "🔄 Starting database backup..."
docker exec agentorchestra-db pg_dump -U $POSTGRES_USER $POSTGRES_DB > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to S3 (optional)
if [ ! -z "$AWS_S3_BACKUP_BUCKET" ]; then
    echo "📤 Uploading to S3..."
    aws s3 cp $BACKUP_FILE.gz s3://$AWS_S3_BACKUP_BUCKET/postgres/
fi

# Clean up old backups (keep last 7 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "✅ Backup completed: $BACKUP_FILE.gz"

---

# scripts/health-check.sh
#!/bin/bash

# Health check script for monitoring

API_URL="${API_URL:-http://localhost:3002}"

# Function to check service health
check_health() {
    local service=$1
    local url=$2
    
    response=$(curl -s -o /dev/null -w "%{http_code}" $url)
    
    if [ $response -eq 200 ]; then
        echo "✅ $service is healthy"
        return 0
    else
        echo "❌ $service is unhealthy (HTTP $response)"
        return 1
    fi
}

# Check all services
echo "🏥 Running health checks..."

check_health "Backend API" "$API_URL/health"
check_health "Frontend" "http://localhost:3000/api/health"
check_health "Database" "$API_URL/health"

# Check Redis
redis_status=$(docker exec agentorchestra-redis redis-cli ping 2>/dev/null)
if [ "$redis_status" = "PONG" ]; then
    echo "✅ Redis is healthy"
else
    echo "❌ Redis is unhealthy"
fi

# Check disk space
disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $disk_usage -gt 90 ]; then
    echo "⚠️ Disk usage is high: $disk_usage%"
fi

# Check memory
memory_usage=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
if [ $memory_usage -gt 90 ]; then
    echo "⚠️ Memory usage is high: $memory_usage%"
fi

---

# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "your-github-username"
    labels:
      - "dependencies"
      - "frontend"

  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "your-github-username"
    labels:
      - "dependencies"
      - "backend"

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    reviewers:
      - "your-github-username"
    labels:
      - "dependencies"
      - "docker"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    reviewers:
      - "your-github-username"
    labels:
      - "dependencies"
      - "github-actions"