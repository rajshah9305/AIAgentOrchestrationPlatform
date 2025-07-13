// backend/src/index.ts
import express from 'express';
import { createServer } from 'http';
import compression from 'compression';
import morgan from 'morgan';
import 'express-async-errors';

// Import configuration
import { config } from './config';
import { prisma } from './lib/database';
import { redis } from './lib/redis';
import { logger } from './lib/logger';

// Import middleware
import {
  securityMiddleware,
  createRateLimiter,
  speedLimiter,
  metricsMiddleware,
  healthCheckMiddleware,
} from './middleware';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware, flexibleAuth } from './middleware/auth';

// Import routes
import { agentsRouter } from './api/agents/routes';
import { executionsRouter } from './api/executions/routes';
import { cerebrasRouter } from './api/cerebras/routes';
import { webhooksRouter } from './api/webhooks/routes';
import { analyticsRouter } from './api/analytics/routes';

// Import services
import { RealtimeService } from './services/realtime-websocket';
import { getQueueStats } from './services/execution-engine';

// Create Express app
const app = express();
const server = createServer(app);

// Initialize services
let realtimeService: RealtimeService;

async function initializeServices() {
  try {
    // Connect to database
    await prisma.$connect();
    logger.info('Database connected');

    // Connect to Redis
    await redis.connect();
    logger.info('Redis connected');

    // Initialize WebSocket service
    realtimeService = new RealtimeService(server);
    logger.info('WebSocket service initialized');

    // Warm up connections
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      redis.client.ping(),
    ]);

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services', error);
    process.exit(1);
  }
}

// Apply middleware
app.use(securityMiddleware);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (config.NODE_ENV === 'production') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }));
} else {
  app.use(morgan('dev'));
}

// Metrics
app.use(metricsMiddleware);

// Rate limiting
app.use('/api/', createRateLimiter({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
}));

// Stricter rate limits for auth endpoints
app.use('/api/auth/', createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts',
}));

// Speed limiting
app.use('/api/', speedLimiter);

// Health check (no auth required)
app.get('/health', healthCheckMiddleware);

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'AI Agent Orchestrator API',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    features: {
      frameworks: [
        'autogen', 'metagpt', 'crewai', 'autogpt', 'babyagi',
        'langgraph', 'camelai', 'agentverse', 'openagents',
        'miniagi', 'orca', 'cerebras', 'cerebras-autogen'
      ],
      capabilities: [
        'multi-agent-execution',
        'real-time-streaming',
        'webhook-notifications',
        'api-key-authentication',
        'websocket-updates',
        'execution-monitoring',
        'cost-tracking',
      ],
    },
    endpoints: {
      health: '/health',
      documentation: '/api/docs',
      agents: '/api/agents',
      executions: '/api/executions',
      cerebras: '/api/cerebras',
      webhooks: '/api/webhooks',
      analytics: '/api/analytics',
    },
  });
});

// Queue statistics endpoint
app.get('/api/queue/stats', authMiddleware, async (req, res) => {
  const stats = await getQueueStats();
  res.json(stats);
});

// API routes with authentication
app.use('/api/agents', flexibleAuth, agentsRouter);
app.use('/api/executions', flexibleAuth, executionsRouter);
app.use('/api/cerebras', flexibleAuth, cerebrasRouter);
app.use('/api/webhooks', authMiddleware, webhooksRouter);
app.use('/api/analytics', authMiddleware, analyticsRouter);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function startServer() {
  await initializeServices();

  const port = config.PORT;
  
  server.listen(port, () => {
    logger.info(`🚀 AI Agent Orchestrator API running on port ${port}`);
    logger.info(`📊 Environment: ${config.NODE_ENV}`);
    logger.info(`🔒 Security: ${config.RATE_LIMIT_ENABLED ? 'Enabled' : 'Disabled'}`);
    logger.info(`🌐 CORS: ${config.ALLOWED_ORIGINS.join(', ')}`);
    logger.info(`⚡ Cerebras: ${config.CEREBRAS_API_KEY ? 'Configured' : 'Not configured'}`);
    logger.info(`📡 WebSocket: ws://localhost:${port}`);
    logger.info(`🏥 Health check: http://localhost:${port}/health`);
  });
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Close database connections
  await prisma.$disconnect();
  logger.info('Database disconnected');

  // Close Redis connections
  await redis.disconnect();
  logger.info('Redis disconnected');

  // Exit
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Start the server
startServer().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});

export { app, server };

// backend/src/api/cerebras/routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validation';
import { AuthRequest } from '../../middleware/auth';
import { CerebrasClient } from '../../lib/cerebras-integration';
import { config } from '../../config';
import { logger } from '../../lib/logger';

const router = Router();

const testConnectionSchema = z.object({
  body: z.object({
    model: z.string().optional(),
    apiKey: z.string().optional(),
  }),
});

const createCompletionSchema = z.object({
  body: z.object({
    messages: z.array(z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    })),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(8192).optional(),
    stream: z.boolean().optional(),
  }),
});

// Get available models
router.get('/models', async (req: AuthRequest, res) => {
  const client = new CerebrasClient({
    apiKey: config.CEREBRAS_API_KEY,
  });

  const models = await client.getAvailableModels();

  res.json({
    models,
    default: 'llama-4-scout-17b-16e-instruct',
    features: {
      streaming: true,
      ultra_fast: true,
      cost_effective: true,
    },
    pricing: {
      per_million_tokens: 0.60,
      currency: 'USD',
    },
  });
});

// Test connection
router.post('/test',
  validate(testConnectionSchema),
  async (req: AuthRequest, res) => {
    const { model, apiKey } = req.body;

    const client = new CerebrasClient({
      apiKey: apiKey || config.CEREBRAS_API_KEY,
      model: model || 'llama-4-scout-17b-16e-instruct',
    });

    try {
      const response = await client.createCompletion([
        {
          role: 'user',
          content: 'Hello! Please respond with "Cerebras connection successful!"',
        },
      ]);

      res.json({
        success: true,
        message: 'Connection successful',
        response: response.choices[0].message.content,
        model: response.model,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Create completion
router.post('/completions',
  validate(createCompletionSchema),
  async (req: AuthRequest, res) => {
    const { messages, model, temperature, maxTokens, stream } = req.body;

    const client = new CerebrasClient({
      apiKey: config.CEREBRAS_API_KEY,
      model,
      temperature,
      maxTokens,
    });

    if (stream) {
      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        await client.createStreamCompletion(
          messages,
          (chunk) => {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        );

        res.write('data: [DONE]\n\n');
        res.end();
      } catch (error) {
        res.write(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`);
        res.end();
      }
    } else {
      const response = await client.createCompletion(messages);
      const cost = client.estimateCost(response.usage);

      res.json({
        ...response,
        cost: {
          amount: cost,
          currency: 'USD',
        },
      });
    }
  }
);

export { router as cerebrasRouter };

// backend/package.json - Updated with all dependencies
{
  "name": "ai-agent-orchestrator-backend",
  "version": "1.0.0",
  "description": "Backend for AI Agent Orchestration Platform",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "type-check": "tsc --noEmit",
    "test": "vitest run --coverage",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:reset": "prisma migrate reset",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "setup": "npm run db:generate && npm run db:push && npm run db:seed",
    "clean": "rm -rf dist",
    "preinstall": "npx only-allow pnpm"
  },
  "dependencies": {
    "@prisma/client": "^5.10.0",
    "axios": "^1.6.5",
    "bcryptjs": "^2.4.3",
    "bull": "^4.12.2",
    "compression": "^1.7.4",
    "cors": "^2.8.5",
    "dotenv": "^16.4.1",
    "express": "^4.18.2",
    "express-async-errors": "^3.1.1",
    "express-rate-limit": "^7.1.5",
    "express-slow-down": "^2.0.1",
    "helmet": "^7.1.0",
    "isomorphic-dompurify": "^2.3.0",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0",
    "redis": "^4.6.12",
    "socket.io": "^4.7.4",
    "winston": "^3.11.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/compression": "^1.7.5",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/morgan": "^1.9.9",
    "@types/node": "^20.11.16",
    "@typescript-eslint/eslint-plugin": "^6.21.0",
    "@typescript-eslint/parser": "^6.21.0",
    "@vitest/ui": "^1.2.1",
    "eslint": "^8.57.1",
    "prisma": "^5.10.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vitest": "^1.2.1"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  },
  "keywords": [
    "ai",
    "agents",
    "orchestration",
    "cerebras",
    "llm",
    "api"
  ],
  "author": "AI Agent Orchestrator Team",
  "license": "MIT"
}