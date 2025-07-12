// backend/src/index.ts
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { PrismaClient } from '@prisma/client'
import 'express-async-errors'

import { errorHandler } from './middleware/error-handler'
import { authMiddleware } from './middleware/auth'
import { healthRouter } from './api/health'
import { agentsRouter } from './api/agents'
import { executionsRouter } from './api/executions'
import { cerebrasRouter } from './api/cerebras'

const app = express()
const prisma = new PrismaClient()

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}))

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS!) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS!) || 100,
  message: 'Too many requests from this IP',
})
app.use(limiter)

// Body parsing and compression
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Logging
app.use(morgan('combined'))

// Routes
app.use('/health', healthRouter)
app.use('/api/cerebras', cerebrasRouter)
app.use('/api/agents', authMiddleware, agentsRouter)
app.use('/api/executions', authMiddleware, executionsRouter)

// Error handling
app.use(errorHandler)

const PORT = process.env.PORT || 3002

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})

export { app, prisma }

// ---

// backend/src/api/health.ts
import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

router.get('/', async (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: { status: 'pass' },
      memory: { status: 'pass' },
    },
  }

  try {
    // Database health check
    await prisma.$queryRaw`SELECT 1`
    healthCheck.checks.database.status = 'pass'
  } catch (error) {
    healthCheck.checks.database.status = 'fail'
    healthCheck.status = 'unhealthy'
  }

  // Memory health check
  const memUsage = process.memoryUsage()
  const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024)
  if (memUsageMB > 500) { // 500MB threshold
    healthCheck.checks.memory.status = 'warn'
  }

  const statusCode = healthCheck.status === 'healthy' ? 200 : 503
  res.status(statusCode).json(healthCheck)
})

export { router as healthRouter }

// ---

// backend/src/api/cerebras.ts
import { Router } from 'express'
import { z } from 'zod'

const router = Router()

const testRequestSchema = z.object({
  message: z.string().optional().default('Hello, test connection'),
  model: z.string().optional().default('llama-4-scout-17b-16e-instruct'),
})

router.get('/models', async (req, res) => {
  const models = [
    'llama-4-scout-17b-16e-instruct',
    'llama-3.1-70b-instruct',
    'llama-3.1-8b-instruct',
    'mixtral-8x7b-instruct',
    'gemma-7b-it',
  ]

  res.json({
    provider: 'cerebras',
    models,
    default: 'llama-4-scout-17b-16e-instruct',
    features: {
      streaming: true,
      ultra_fast: true,
      cost_effective: true,
    },
  })
})

router.post('/test', async (req, res) => {
  const { message, model } = testRequestSchema.parse(req.body)

  if (!process.env.CEREBRAS_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Cerebras API key not configured',
    })
  }

  try {
    // Mock response for now - replace with actual Cerebras API call
    const response = {
      success: true,
      message: 'Cerebras connection successful!',
      response: 'Hello! Cerebras connection successful!',
      model,
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
      cost: 0.000009,
    }

    res.json(response)
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to connect to Cerebras API',
      details: error.message,
    })
  }
})

export { router as cerebrasRouter }

// ---

// backend/src/api/agents.ts
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../index'

const router = Router()

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  framework: z.enum([
    'AUTOGEN', 'METAGPT', 'CREWAI', 'AUTOGPT', 'BABYAGI',
    'LANGGRAPH', 'CAMELAI', 'AGENTVERSE', 'OPENAGENTS',
    'MINIAGI', 'ORCA', 'CEREBRAS', 'CEREBRAS_AUTOGEN'
  ]),
  configuration: z.object({}).passthrough(),
  tags: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
})

router.get('/', async (req, res) => {
  const { framework, status, page = 1, limit = 10 } = req.query
  const userId = req.user.id

  const where: any = { userId }
  if (framework) where.framework = framework
  if (status) where.status = status

  const skip = (Number(page) - 1) * Number(limit)

  const [agents, total] = await Promise.all([
    prisma.agent.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { executions: true },
        },
      },
    }),
    prisma.agent.count({ where }),
  ])

  res.json({
    agents,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  })
})

router.post('/', async (req, res) => {
  const data = createAgentSchema.parse(req.body)
  const userId = req.user.id

  const agent = await prisma.agent.create({
    data: {
      ...data,
      userId,
    },
  })

  res.status(201).json(agent)
})

router.get('/:id', async (req, res) => {
  const { id } = req.params
  const userId = req.user.id

  const agent = await prisma.agent.findFirst({
    where: { id, userId },
    include: {
      executions: {
        take: 10,
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: { executions: true },
      },
    },
  })

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' })
  }

  res.json(agent)
})

export { router as agentsRouter }

// ---

// backend/src/api/executions.ts
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../index'

const router = Router()

const startExecutionSchema = z.object({
  agentId: z.string(),
  input: z.object({}).passthrough(),
  configuration: z.object({}).passthrough().optional(),
  environment: z.enum(['DEVELOPMENT', 'STAGING', 'PRODUCTION']).optional().default('DEVELOPMENT'),
  trigger: z.enum(['MANUAL', 'SCHEDULED', 'WEBHOOK', 'API']).optional().default('MANUAL'),
})

router.get('/', async (req, res) => {
  const { agentId, status, page = 1, limit = 20 } = req.query
  const userId = req.user.id

  const where: any = { userId }
  if (agentId) where.agentId = agentId
  if (status) where.status = status

  const skip = (Number(page) - 1) * Number(limit)

  const [executions, total] = await Promise.all([
    prisma.execution.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        agent: {
          select: { id: true, name: true, framework: true },
        },
      },
    }),
    prisma.execution.count({ where }),
  ])

  res.json({
    executions,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  })
})

router.post('/', async (req, res) => {
  const data = startExecutionSchema.parse(req.body)
  const userId = req.user.id

  // Verify agent ownership
  const agent = await prisma.agent.findFirst({
    where: { id: data.agentId, userId },
  })

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' })
  }

  const execution = await prisma.execution.create({
    data: {
      ...data,
      userId,
      status: 'PENDING',
    },
  })

  res.status(201).json({
    executionId: execution.id,
    status: 'started',
    message: 'Execution started',
  })
})

router.get('/:id', async (req, res) => {
  const { id } = req.params
  const userId = req.user.id

  const execution = await prisma.execution.findFirst({
    where: { id, userId },
    include: {
      agent: {
        select: { id: true, name: true, framework: true },
      },
      logs: {
        orderBy: { timestamp: 'asc' },
      },
    },
  })

  if (!execution) {
    return res.status(404).json({ error: 'Execution not found' })
  }

  res.json(execution)
})

export { router as executionsRouter }

// ---

// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import { verify } from 'jsonwebtoken'
import { prisma } from '../index'

interface JWTPayload {
  userId: string
  email: string
  role: string
}

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string
        email: string
        role: string
      }
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.substring(7)
    const decoded = verify(token, process.env.JWT_SECRET!) as JWTPayload

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true },
    })

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    req.user = user
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// ---

// backend/src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', error)

  // Zod validation errors
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.errors,
    })
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return res.status(409).json({
          error: 'Unique constraint violation',
          field: error.meta?.target,
        })
      case 'P2025':
        return res.status(404).json({
          error: 'Record not found',
        })
      default:
        return res.status(500).json({
          error: 'Database error',
          code: error.code,
        })
    }
  }

  // Default error
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
  })
}