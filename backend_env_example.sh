# Backend Environment Variables (.env)

# Application Configuration
NODE_ENV=development
PORT=3002
HOST=localhost
FRONTEND_URL=http://localhost:3000

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/agentorchestra"
DIRECT_URL="postgresql://username:password@localhost:5432/agentorchestra"

# Redis Configuration (for caching and sessions)
REDIS_URL="redis://localhost:6379"

# JWT Authentication
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"

# Cerebras AI Configuration
CEREBRAS_API_KEY="your-cerebras-api-key"
CEREBRAS_BASE_URL="https://api.cerebras.ai/v1"

# Security Configuration
CORS_ORIGIN="http://localhost:3000"
RATE_LIMIT_WINDOW_MS="900000"
RATE_LIMIT_MAX_REQUESTS="100"
BCRYPT_SALT_ROUNDS="12"

# Email Configuration (for notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
FROM_EMAIL="noreply@agentorchestra.dev"

# File Upload Configuration
MAX_FILE_SIZE="10485760"
UPLOAD_PATH="./uploads"

# Logging Configuration
LOG_LEVEL="info"
LOG_FILE="./logs/app.log"

# Webhook Configuration
WEBHOOK_SECRET="your-webhook-secret"
WEBHOOK_TIMEOUT="30000"

# Background Jobs
BULL_REDIS_URL="redis://localhost:6379"
JOB_ATTEMPTS="3"
JOB_BACKOFF_DELAY="5000"

# External APIs
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
GOOGLE_AI_API_KEY=""

# Monitoring & Analytics
SENTRY_DSN=""
NEW_RELIC_LICENSE_KEY=""

# Health Check Configuration
HEALTH_CHECK_TIMEOUT="5000"
HEALTH_CHECK_INTERVAL="30000"

# Development Only
DEBUG_SQL="false"
ENABLE_QUERY_LOGGING="false"
ENABLE_PRISMA_STUDIO="false"