import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { rateLimit } from 'express-rate-limit'

// Import middleware and services
import { securityMiddleware } from './middleware/security_middleware'
import { authMiddleware } from './middleware/auth'
import { healthCheck } from './services/health_monitoring'
import { setupWebSocket } from './services/realtime_websocket'
import { setupBackgroundJobs } from './services/background_jobs'
import { setupWebhooks } from './services/webhook_system'

// Import API routes
import * as agentRoutes from './api/agent_api_routes'
import * as executionRoutes from './api/execution_api'
import * as authRoutes from './auth_config'
import * as apiKeyRoutes from './api_key_management'
import * as webhookRoutes from './webhook_system'
import * as analyticsRoutes from './analytics_dashboard'

// Load environment variables
dotenv.config()

// Initialize Prisma
export const prisma = new PrismaClient()

// Create Express app
const app = express()
const PORT = process.env.PORT || 3001

// Create HTTP server
const server = createServer(app)

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
})

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
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(limiter)

// Compression middleware
app.use(compression())

// Logging middleware
app.use(morgan('combined'))

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Security middleware
app.use(securityMiddleware)

// Health check endpoint
app.get('/health', healthCheck)

// API information endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'AI Agent Orchestrator API',
    version: '1.0.0',
    description: 'Ultra-fast AI agent orchestration platform with Cerebras integration',
    endpoints: {
      health: '/health',
      agents: '/api/agents',
      executions: '/api/executions',
      auth: '/api/auth',
      webhooks: '/api/webhooks',
      analytics: '/api/dashboard'
    },
    features: [
      'Multi-agent orchestration',
      'Real-time streaming',
      'WebSocket support',
      'Background job processing',
      'Webhook system',
      'Analytics dashboard'
    ]
  })
})

// API Routes
app.use('/api/agents', agentRoutes)
app.use('/api/executions', executionRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/api-keys', apiKeyRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/api/dashboard', analyticsRoutes)

// Cerebras integration endpoints
app.get('/api/cerebras/models', async (req, res) => {
  try {
    const models = [
      {
        id: 'llama-4-scout-17b-16e-instruct',
        name: 'Llama 4 Scout 17B',
        description: 'Latest Llama 4 Scout model with ultra-fast inference',
        context_window: 16384,
        max_tokens: 8192
      },
      {
        id: 'llama-3.1-70b-instruct',
        name: 'Llama 3.1 70B',
        description: 'High-performance model for complex reasoning',
        context_window: 8192,
        max_tokens: 4096
      },
      {
        id: 'llama-3.1-8b-instruct',
        name: 'Llama 3.1 8B',
        description: 'Fast and efficient model for general tasks',
        context_window: 8192,
        max_tokens: 4096
      },
      {
        id: 'mixtral-8x7b-instruct',
        name: 'Mixtral 8x7B',
        description: 'Long context model for extended conversations',
        context_window: 32768,
        max_tokens: 4096
      },
      {
        id: 'gemma-7b-it',
        name: 'Gemma 7B',
        description: 'Instruction-tuned model for specific tasks',
        context_window: 8192,
        max_tokens: 4096
      }
    ]
    
    res.json({
      provider: 'cerebras',
      models
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch models' })
  }
})

app.post('/api/cerebras/test', async (req, res) => {
  try {
    const { message, model, api_key } = req.body
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    // Simulate Cerebras API call
    const response = {
      success: true,
      response: `Test response to: "${message}"`,
      model: model || 'llama-4-scout-17b-16e-instruct',
      usage: {
        prompt_tokens: message.length / 4,
        completion_tokens: 50,
        total_tokens: (message.length / 4) + 50
      },
      cost: 0.0001
    }

    res.json(response)
  } catch (error) {
    res.status(500).json({ error: 'Failed to test Cerebras connection' })
  }
})

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' })
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// Initialize services
async function initializeServices() {
  try {
    // Initialize WebSocket
    setupWebSocket(server)
    
    // Initialize background jobs
    setupBackgroundJobs()
    
    // Initialize webhooks
    setupWebhooks()
    
    console.log('✅ All services initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize services:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  
  try {
    await prisma.$disconnect()
    server.close(() => {
      console.log('Server closed')
      process.exit(0)
    })
  } catch (error) {
    console.error('Error during shutdown:', error)
    process.exit(1)
  }
})

// Start server
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect()
    console.log('✅ Database connected')
    
    // Initialize services
    await initializeServices()
    
    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 AI Agent Orchestrator Backend running on port ${PORT}`)
      console.log(`📊 Health check: http://localhost:${PORT}/health`)
      console.log(`🔗 API docs: http://localhost:${PORT}/api`)
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Start the server
startServer()

export default app 