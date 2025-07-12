# .env.example
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/agentorchestra"
DIRECT_URL="postgresql://username:password@localhost:5432/agentorchestra"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# OAuth Providers
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
DISCORD_CLIENT_ID="your-discord-client-id"
DISCORD_CLIENT_SECRET="your-discord-client-secret"

# AI Service APIs
OPENAI_API_KEY="your-openai-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"
GOOGLE_AI_API_KEY="your-google-ai-api-key"
CEREBRAS_API_KEY="your-cerebras-api-key"

# Redis (for caching and queues)
REDIS_URL="redis://localhost:6379"

# File Storage
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="agentorchestra-files"

# Monitoring & Analytics
SENTRY_DSN="your-sentry-dsn"
POSTHOG_KEY="your-posthog-key"

# Email (for notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Application Settings
NODE_ENV="development"
LOG_LEVEL="info"
MAX_EXECUTION_TIME="300000"
MAX_CONCURRENT_EXECUTIONS="10"

# package.json scripts section
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:reset": "prisma migrate reset",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "setup": "npm run db:generate && npm run db:push && npm run db:seed"
  }
}

# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: agentorchestra-db
    environment:
      POSTGRES_DB: agentorchestra
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: agentorchestra-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    container_name: agentorchestra-app
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/agentorchestra
      - REDIS_URL=redis://redis:6379
      - NEXTAUTH_URL=http://localhost:3000
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next

volumes:
  postgres_data:
  redis_data:

# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]

# prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Seed AI Frameworks
  const frameworks = [
    {
      name: 'AUTOGEN',
      displayName: 'AutoGen',
      description: 'Multi-agent conversation framework with customizable agents that can collaborate to solve complex tasks.',
      category: 'multi-agent',
      difficulty: 'intermediate',
      rating: 4.4,
      growth: 16,
      features: ['Multi-agent conversations', 'Code execution', 'Human-in-the-loop'],
      tags: ['conversation', 'collaboration', 'microsoft'],
      isPopular: true,
      configSchema: {
        type: 'object',
        properties: {
          agents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                role: { type: 'string' },
                system_message: { type: 'string' }
              }
            }
          },
          llm_config: {
            type: 'object',
            properties: {
              model: { type: 'string' },
              temperature: { type: 'number' }
            }
          }
        }
      }
    },
    {
      name: 'CREWAI',
      displayName: 'CrewAI',
      description: 'Framework for orchestrating role-playing, autonomous AI agents to tackle complex tasks.',
      category: 'multi-agent',
      difficulty: 'intermediate',
      rating: 4.7,
      growth: 17,
      features: ['Role-playing agents', 'Task delegation', 'Hierarchical execution'],
      tags: ['role-playing', 'orchestration', 'tasks'],
      isPopular: true
    },
    {
      name: 'AUTOGPT',
      displayName: 'Auto-GPT',
      description: 'Autonomous GPT-4 agent that chains together LLM thoughts to autonomously achieve goals.',
      category: 'single-agent',
      difficulty: 'beginner',
      rating: 4.1,
      growth: 42,
      features: ['Autonomous execution', 'Goal-oriented', 'Memory management'],
      tags: ['autonomous', 'goal-oriented', 'gpt'],
      isPopular: true
    },
    {
      name: 'BABYAGI',
      displayName: 'BabyAGI',
      description: 'AI-powered task management system that creates, prioritizes, and executes tasks.',
      category: 'single-agent',
      difficulty: 'beginner',
      rating: 4.9,
      growth: 14,
      features: ['Task creation', 'Prioritization', 'Execution loop'],
      tags: ['task-management', 'simple', 'agi'],
      isPopular: true
    },
    {
      name: 'LANGGRAPH',
      displayName: 'LangGraph',
      description: 'Library for building stateful, multi-actor applications with LLMs using graph-based workflows.',
      category: 'multi-agent',
      difficulty: 'advanced',
      rating: 4.9,
      growth: 13,
      features: ['Graph workflows', 'State management', 'Multi-actor'],
      tags: ['graph', 'stateful', 'langchain'],
      isPopular: true
    }
  ]

  for (const framework of frameworks) {
    await prisma.framework.upsert({
      where: { name: framework.name },
      update: framework,
      create: framework
    })
  }

  // Seed template configurations
  const templates = [
    {
      name: 'Customer Support Crew',
      description: 'A multi-agent team for handling customer support inquiries',
      framework: 'CREWAI',
      configuration: {
        agents: [
          {
            role: 'Customer Support Specialist',
            goal: 'Resolve customer inquiries efficiently and professionally',
            backstory: 'Expert in customer service with 5+ years experience'
          },
          {
            role: 'Technical Expert',
            goal: 'Provide technical solutions and troubleshooting',
            backstory: 'Senior engineer with deep product knowledge'
          }
        ],
        tasks: [
          {
            description: 'Analyze customer inquiry and categorize the issue',
            agent: 'Customer Support Specialist'
          },
          {
            description: 'Provide technical solution if needed',
            agent: 'Technical Expert'
          }
        ]
      },
      isTemplate: true,
      isPublic: true,
      userId: 'system'
    },
    {
      name: 'Research Assistant',
      description: 'Autonomous agent for conducting research and analysis',
      framework: 'AUTOGPT',
      configuration: {
        role: 'Research Assistant',
        goals: [
          'Gather comprehensive information on given topics',
          'Analyze and summarize findings',
          'Provide actionable insights'
        ],
        tools: ['web_search', 'document_analysis', 'data_visualization']
      },
      isTemplate: true,
      isPublic: true,
      userId: 'system'
    }
  ]

  for (const template of templates) {
    await prisma.savedConfiguration.upsert({
      where: { id: template.name.toLowerCase().replace(/ /g, '-') },
      update: template,
      create: {
        id: template.name.toLowerCase().replace(/ /g, '-'),
        ...template
      }
    })
  }

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

# scripts/setup.sh
#!/bin/bash

echo "🚀 Setting up AgentOrchestra Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env
    echo "⚠️  Please update .env with your actual values before proceeding!"
fi

# Start database services
echo "🐳 Starting database services..."
docker-compose up -d postgres redis

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "📊 Running database migrations..."
npx prisma db push

# Seed the database
echo "🌱 Seeding database with initial data..."
npm run db:seed

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update your .env file with actual API keys and configuration"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:3000 to see your AgentOrchestra platform"
echo ""
echo "Useful commands:"
echo "- npm run dev          # Start development server"
echo "- npm run db:studio    # Open Prisma Studio"
echo "- npm run test         # Run tests"
echo "- docker-compose logs  # View database logs"

# scripts/deploy.sh
#!/bin/bash

echo "🚀 Deploying AgentOrchestra to production..."

# Build the application
echo "🔨 Building application..."
npm run build

# Run database migrations
echo "📊 Running production migrations..."
npx prisma migrate deploy

# Generate Prisma client for production
echo "🔧 Generating production Prisma client..."
npx prisma generate

echo "✅ Deployment preparation complete!"
echo ""
echo "The application is ready for deployment to:"
echo "- Vercel (recommended for Next.js)"
echo "- Railway (full-stack with database)"
echo "- Docker containers"
echo ""
echo "Environment variables needed in production:"
echo "- DATABASE_URL"
echo "- NEXTAUTH_URL"
echo "- NEXTAUTH_SECRET"
echo "- All OAuth provider credentials"
echo "- AI service API keys"

# vercel.json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 300
    }
  },
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/metrics",
      "schedule": "*/5 * * * *"
    }
  ],
  "env": {
    "PRISMA_GENERATE_DATAPROXY": "true"
  }
}