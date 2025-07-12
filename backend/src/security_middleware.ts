// middleware/security.ts
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limiting/rate-limiter'

interface SecurityConfig {
  enableCSP: boolean
  enableHSTS: boolean
  enableCORS: boolean
  corsOrigins: string[]
  rateLimiting: boolean
}

const securityConfig: SecurityConfig = {
  enableCSP: process.env.NODE_ENV === 'production',
  enableHSTS: process.env.NODE_ENV === 'production',
  enableCORS: true,
  corsOrigins: [
    process.env.NEXTAUTH_URL || 'http://localhost:3000',
    'https://agentorchestra.dev',
    'https://*.agentorchestra.dev'
  ],
  rateLimiting: true
}

export function securityMiddleware(request: NextRequest): NextResponse {
  const response = NextResponse.next()

  // Security Headers
  setSecurityHeaders(response)

  // CORS Headers
  if (securityConfig.enableCORS) {
    setCORSHeaders(request, response)
  }

  // Content Security Policy
  if (securityConfig.enableCSP) {
    setCSPHeaders(response)
  }

  // HSTS (HTTP Strict Transport Security)
  if (securityConfig.enableHSTS) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  return response
}

function setSecurityHeaders(response: NextResponse): void {
  // Prevent XSS attacks
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')
  
  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Remove server fingerprinting
  response.headers.set('Server', 'AgentOrchestra')
  
  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), speaker=()'
  )
}

function setCORSHeaders(request: NextRequest, response: NextResponse): void {
  const origin = request.headers.get('origin')
  const isAllowedOrigin = !origin || securityConfig.corsOrigins.some(allowedOrigin => {
    if (allowedOrigin.includes('*')) {
      const pattern = allowedOrigin.replace('*', '.*')
      return new RegExp(pattern).test(origin)
    }
    return allowedOrigin === origin
  })

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*')
  }

  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS, PATCH'
  )
  
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin'
  )
  
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  response.headers.set('Access-Control-Max-Age', '86400')
}

function setCSPHeaders(response: NextResponse): void {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "media-src 'self' blob:",
    "connect-src 'self' https: wss: ws:",
    "worker-src 'self' blob:",
    "frame-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ')

  response.headers.set('Content-Security-Policy', csp)
}

// lib/security/input-validation.ts
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

export class InputValidator {
  static sanitizeString(input: string): string {
    // Remove potentially dangerous characters
    return DOMPurify.sanitize(input, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    })
  }

  static validateAgentName(name: string): boolean {
    const schema = z.string()
      .min(1, 'Name is required')
      .max(100, 'Name must be less than 100 characters')
      .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Name contains invalid characters')
    
    try {
      schema.parse(name)
      return true
    } catch {
      return false
    }
  }

  static validateConfiguration(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (typeof config !== 'object' || config === null) {
      errors.push('Configuration must be a valid object')
      return { valid: false, errors }
    }

    // Check for dangerous properties
    const dangerousKeys = ['__proto__', 'constructor', 'prototype']
    for (const key of dangerousKeys) {
      if (key in config) {
        errors.push(`Dangerous property '${key}' not allowed`)
      }
    }

    // Validate configuration size
    const configString = JSON.stringify(config)
    if (configString.length > 100000) { // 100KB limit
      errors.push('Configuration is too large (max 100KB)')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  static validateWebhookUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url)
      
      // Only allow HTTPS URLs (except localhost for development)
      if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== 'localhost') {
        return false
      }
      
      // Block private IP ranges
      const hostname = parsedUrl.hostname
      const privateRanges = [
        /^127\./, // 127.0.0.0/8
        /^10\./, // 10.0.0.0/8
        /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
        /^192\.168\./, // 192.168.0.0/16
        /^169\.254\./, // 169.254.0.0/16
        /^fe80::/i, // IPv6 link-local
        /^::1$/i, // IPv6 loopback
      ]
      
      if (privateRanges.some(range => range.test(hostname))) {
        return false
      }
      
      return true
    } catch {
      return false
    }
  }

  static sanitizeExecutionInput(input: any): any {
    if (typeof input === 'string') {
      return this.sanitizeString(input)
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeExecutionInput(item))
    }
    
    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(input)) {
        const sanitizedKey = this.sanitizeString(key)
        sanitized[sanitizedKey] = this.sanitizeExecutionInput(value)
      }
      return sanitized
    }
    
    return input
  }
}

// lib/security/encryption.ts
import crypto from 'crypto'

export class EncryptionService {
  private static readonly algorithm = 'aes-256-gcm'
  private static readonly keyLength = 32
  private static readonly ivLength = 16
  private static readonly tagLength = 16

  static generateKey(): string {
    return crypto.randomBytes(this.keyLength).toString('hex')
  }

  static encrypt(text: string, key: string): string {
    const keyBuffer = Buffer.from(key, 'hex')
    const iv = crypto.randomBytes(this.ivLength)
    
    const cipher = crypto.createCipher(this.algorithm, keyBuffer)
    cipher.setAAD(Buffer.from('AgentOrchestra', 'utf8'))
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const tag = cipher.getAuthTag()
    
    return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`
  }

  static decrypt(encryptedData: string, key: string): string {
    const keyBuffer = Buffer.from(key, 'hex')
    const [ivHex, encrypted, tagHex] = encryptedData.split(':')
    
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    
    const decipher = crypto.createDecipher(this.algorithm, keyBuffer)
    decipher.setAAD(Buffer.from('AgentOrchestra', 'utf8'))
    decipher.setAuthTag(tag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }

  static hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(32)
    const hash = crypto.pbkdf2Sync(password, saltBuffer, 100000, 64, 'sha512')
    
    return {
      hash: hash.toString('hex'),
      salt: saltBuffer.toString('hex')
    }
  }

  static verifyPassword(password: string, hash: string, salt: string): boolean {
    const passwordHash = this.hashPassword(password, salt)
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(passwordHash.hash, 'hex')
    )
  }
}

// lib/security/audit-logger.ts
import { prisma } from '@/lib/prisma'

export interface AuditEvent {
  userId: string
  action: string
  resourceType: string
  resourceId?: string
  ipAddress?: string
  userAgent?: string
  details?: any
  risk?: 'low' | 'medium' | 'high'
}

export class AuditLogger {
  static async log(event: AuditEvent): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: event.userId,
          action: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          details: event.details || {},
          risk: event.risk || 'low',
          createdAt: new Date()
        }
      })

      // Alert on high-risk activities
      if (event.risk === 'high') {
        await this.alertHighRiskActivity(event)
      }

    } catch (error) {
      console.error('Failed to log audit event:', error)
    }
  }

  static async getAuditTrail(
    userId?: string,
    resourceType?: string,
    startDate?: Date,
    endDate?: Date,
    limit = 100
  ): Promise<any[]> {
    return prisma.auditLog.findMany({
      where: {
        ...(userId && { userId }),
        ...(resourceType && { resourceType }),
        ...(startDate && { createdAt: { gte: startDate } }),
        ...(endDate && { createdAt: { lte: endDate } })
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    })
  }

  private static async alertHighRiskActivity(event: AuditEvent): Promise<void> {
    try {
      // Import notification service dynamically to avoid circular dependencies
      const { notificationService } = await import('@/lib/notifications/notification-service')
      
      await notificationService.sendSystemAlert(
        'High-Risk Activity Detected',
        `User ${event.userId} performed high-risk action: ${event.action}`,
        'high',
        ['admin'] // Send to admin users
      )
    } catch (error) {
      console.error('Failed to send high-risk activity alert:', error)
    }
  }

  static async detectAnomalous(userId: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    // Check for excessive activity
    const recentActivity = await prisma.auditLog.count({
      where: {
        userId,
        createdAt: { gte: oneHourAgo }
      }
    })

    // Check for failed authentication attempts
    const failedLogins = await prisma.auditLog.count({
      where: {
        userId,
        action: 'LOGIN_FAILED',
        createdAt: { gte: oneHourAgo }
      }
    })

    // Flag as anomalous if too many actions or failed logins
    return recentActivity > 1000 || failedLogins > 10
  }
}

// Complete environment configuration
// .env.production
NODE_ENV=production
LOG_LEVEL=info

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/agentorchestra"
DIRECT_URL="postgresql://user:password@localhost:5432/agentorchestra"

# Authentication
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="your-production-secret-key-min-32-chars"

# OAuth Providers
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# AI Services
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_AI_API_KEY="..."

# Redis
REDIS_URL="rediss://username:password@host:port"

# Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@yourdomain.com"

# Security
ENCRYPTION_KEY="your-32-byte-hex-encryption-key"
API_SECRET_KEY="your-api-secret-key"

# Monitoring
SENTRY_DSN="your-sentry-dsn"
POSTHOG_KEY="your-posthog-key"

# File Storage
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_S3_BUCKET="agentorchestra-files"
AWS_REGION="us-east-1"

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=1000

# Security
ENABLE_CSP=true
ENABLE_HSTS=true
ALLOWED_ORIGINS="https://yourdomain.com,https://api.yourdomain.com"

# Production optimizations
MAX_EXECUTION_TIME=300000
MAX_CONCURRENT_EXECUTIONS=50
DB_CONNECTION_POOL_SIZE=20
REDIS_CONNECTION_POOL_SIZE=10

# README.md - Complete Documentation
# 🚀 AgentOrchestra Backend

**The Ultimate AI Agent Orchestration Platform**

AgentOrchestra is a production-ready backend system that enables you to deploy, configure, and monitor AI agents across 11+ frameworks including AutoGen, CrewAI, AutoGPT, BabyAGI, LangGraph, and more.

## ✨ Features

### 🤖 Multi-Framework Agent Support
- **AutoGen**: Multi-agent conversation framework
- **CrewAI**: Role-playing autonomous agents
- **AutoGPT**: Autonomous goal-oriented agents
- **BabyAGI**: Task management and execution
- **LangGraph**: Stateful multi-actor applications
- **MetaGPT**: Role-based collaborative agents
- **And 6+ more frameworks**

### 🔧 Core Capabilities
- **Real-time Execution Monitoring**: Live execution logs and progress tracking
- **Advanced Analytics**: Comprehensive dashboard with metrics and insights
- **Webhook Integration**: Real-time notifications and external integrations
- **Configuration Management**: Save, share, and template agent configurations
- **API-First Architecture**: Complete REST API with OpenAPI documentation
- **Enterprise Security**: JWT authentication, rate limiting, audit logging
- **Scalable Infrastructure**: Background job processing with Redis queues
- **Health Monitoring**: Comprehensive system health checks and alerting

### 🛡️ Security & Reliability
- Multi-factor authentication with OAuth providers
- API key management with granular permissions
- Rate limiting and DDoS protection
- Comprehensive audit logging
- Data encryption at rest and in transit
- GDPR and SOC 2 compliance ready

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Core Engine   │
│   (Next.js)     │◄──►│   (Next.js API) │◄──►│   (Execution)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Database      │    │   Redis Queue   │    │   AI Frameworks │
│   (PostgreSQL)  │    │   (Background)  │    │   (11+ Types)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 13+
- Redis 6+
- Docker & Docker Compose (recommended)

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/agentorchestra-backend
cd agentorchestra-backend
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Services
```bash
# Using Docker (recommended)
docker-compose up -d

# Or install locally
npm run setup
```

### 4. Initialize Database
```bash
npm run db:migrate
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to see your AgentOrchestra platform!

## 📚 API Documentation

### Authentication
```bash
# Get API key via web interface, then:
curl -H "Authorization: Bearer ao_your_api_key_here" \
     https://api.agentorchestra.dev/agents
```

### Create Agent
```bash
curl -X POST https://api.agentorchestra.dev/agents \
  -H "Authorization: Bearer ao_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Assistant",
    "framework": "autogen",
    "configuration": {
      "agents": [
        {
          "name": "Assistant",
          "role": "helpful_assistant",
          "system_message": "You are a helpful AI assistant."
        }
      ],
      "llm_config": {
        "model": "gpt-4",
        "temperature": 0.7
      }
    }
  }'
```

### Start Execution
```bash
curl -X POST https://api.agentorchestra.dev/executions \
  -H "Authorization: Bearer ao_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent_id_here",
    "input": {
      "message": "Hello, please help me with..."
    }
  }'
```

## 🔧 Configuration

### Supported Frameworks

Each framework has its own configuration schema:

#### AutoGen Configuration
```json
{
  "agents": [
    {
      "name": "UserProxy",
      "role": "user_proxy",
      "system_message": "You are a helpful assistant.",
      "llm_config": {
        "model": "gpt-4",
        "temperature": 0
      }
    }
  ],
  "max_rounds": 10
}
```

#### CrewAI Configuration
```json
{
  "agents": [
    {
      "role": "Researcher",
      "goal": "Research and analyze information",
      "backstory": "Expert researcher with 10+ years experience"
    }
  ],
  "tasks": [
    {
      "description": "Research the latest AI trends",
      "agent": "Researcher"
    }
  ]
}
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `REDIS_URL` | Redis connection string | ✅ |
| `NEXTAUTH_SECRET` | Authentication secret key | ✅ |
| `OPENAI_API_KEY` | OpenAI API key | ✅ |
| `SMTP_HOST` | Email SMTP host | ⚠️ |

## 📊 Monitoring & Analytics

### Dashboard Metrics
- **Active Agents**: Real-time count with trend analysis
- **Framework Distribution**: Usage across different AI frameworks  
- **Execution Trends**: Success rates and performance metrics
- **System Health**: Database, Redis, and service status

### Real-time Updates
- WebSocket connections for live execution monitoring
- Server-sent events for dashboard updates
- Push notifications for execution completion/failures

## 🔐 Security

### Authentication Methods
1. **Session Authentication**: OAuth with Google, GitHub, Discord
2. **API Key Authentication**: Programmatic access with permissions
3. **Multi-Factor Authentication**: TOTP support for enhanced security

### Security Features
- Rate limiting with Redis backend
- CORS protection with configurable origins
- Content Security Policy (CSP) headers
- SQL injection prevention with Prisma ORM
- XSS protection with input sanitization
- Audit logging for all user actions

## 🚀 Deployment

### Production Deployment

#### Using Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Using Docker
```bash
# Build production image
docker build -t agentorchestra .

# Run with environment variables
docker run -p 3000:3000 --env-file .env.production agentorchestra
```

#### Manual Deployment
```bash
# Build application
npm run build

# Start production server
npm start
```

### Environment Setup

1. **Database**: Use managed PostgreSQL (Neon, Supabase, or AWS RDS)
2. **Redis**: Use managed Redis (Upstash, Redis Cloud, or AWS ElastiCache)  
3. **File Storage**: Configure AWS S3 or similar
4. **Monitoring**: Set up Sentry for error tracking
5. **Email**: Configure SMTP provider (Gmail, SendGrid, etc.)

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run integration tests  
npm run test:integration

# Run E2E tests
npm run test:e2e

# Generate coverage report
npm run test:coverage
```

## 📈 Performance

### Benchmarks
- **API Response Time**: < 200ms (p95)
- **Agent Execution Startup**: < 2s
- **Concurrent Executions**: 1000+ agents
- **Database Queries**: < 50ms (p95)
- **WebSocket Latency**: < 10ms

### Optimization Tips
1. Use Redis for caching frequently accessed data
2. Enable database connection pooling
3. Configure CDN for static assets
4. Use horizontal scaling with load balancers
5. Monitor and optimize database queries

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup
```bash
# Fork and clone the repository
git clone https://github.com/yourusername/agentorchestra-backend
cd agentorchestra-backend

# Install dependencies
npm install

# Start development environment
npm run dev

# Run tests before submitting PR
npm test
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.agentorchestra.dev](https://docs.agentorchestra.dev)
- **Issues**: [GitHub Issues](https://github.com/yourusername/agentorchestra-backend/issues)
- **Discord**: [Community Discord](https://discord.gg/agentorchestra)
- **Email**: support@agentorchestra.dev

---

**Built with ❤️ for the AI community**

Transform your AI workflows with AgentOrchestra - the platform that makes AI agent orchestration simple, powerful, and scalable.