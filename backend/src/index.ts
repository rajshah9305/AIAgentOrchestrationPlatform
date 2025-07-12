import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import 'express-async-errors';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Load environment variables
dotenv.config();

// Import middleware
import { authMiddleware } from './middleware/auth';
import { securityMiddleware } from './middleware/security';

// Import services
import { healthCheck } from './services/health_monitoring';
import { setupWebSocket } from './services/realtime_websocket';
import { setupBackgroundJobs } from './services/background_jobs';
import { setupWebhooks } from './services/webhook_system';

// Import Cerebras integration
import { CerebrasClient } from './lib/cerebras_integration';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3002;

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter);
app.use(securityMiddleware);

// Initialize services
const backgroundJobs = setupBackgroundJobs();
const webhookSystem = setupWebhooks();
const io = setupWebSocket(server);

// Initialize Cerebras client
const cerebrasClient = new CerebrasClient({
  apiKey: process.env.CEREBRAS_API_KEY || '',
  model: 'llama-4-scout-17b-16e-instruct',
  temperature: 0.2,
  maxTokens: 2048
});

// Health check endpoint
app.get('/health', healthCheck);

// API Routes
app.get('/api', (req, res) => {
  res.json({
    message: 'AI Agent Orchestrator API',
    version: '1.0.0',
    status: 'running',
    features: {
      cerebras: 'enabled',
      streaming: 'enabled',
      websockets: 'enabled',
      webhooks: 'enabled'
    }
  });
});

// Cerebras API Routes
app.get('/api/cerebras/models', async (req, res) => {
  try {
    const models = await cerebrasClient.getAvailableModels();
    res.json({
      models,
      default: 'llama-4-scout-17b-16e-instruct',
      features: {
        streaming: true,
        ultra_fast: true,
        cost_effective: true
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

app.post('/api/cerebras/test', async (req, res) => {
  try {
    const { model = 'llama-4-scout-17b-16e-instruct' } = req.body;
    
    const response = await cerebrasClient.createCompletion([
      { role: 'user', content: 'Hello! Please respond with "Cerebras connection successful!"' }
    ], { model });

    res.json({
      success: true,
      message: 'Cerebras connection successful!',
      response: response.choices[0]?.message?.content,
      model,
      usage: response.usage
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Cerebras connection failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Agent execution endpoint
app.post('/api/agents/:agentId/execute', authMiddleware, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { input, configuration = {} } = req.body;
    const userId = req.user?.id;

    console.log(`Executing agent ${agentId} for user ${userId}`);

    // Create execution record
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add to background jobs
    backgroundJobs.addExecutionJob({
      executionId,
      agentId,
      userId,
      input,
      configuration
    });

    res.json({
      executionId,
      status: 'queued',
      message: 'Execution started'
    });

    // Emit real-time update
    io.emit('execution_started', {
      executionId,
      agentId,
      userId,
      status: 'queued'
    });

  } catch (error) {
    res.status(500).json({ error: 'Execution failed' });
  }
});

// Streaming execution endpoint
app.post('/api/agents/:agentId/execute/stream', authMiddleware, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { input, configuration = {} } = req.body;
    const userId = req.user?.id;

    console.log(`Streaming execution for agent ${agentId}`);

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Create messages for Cerebras
    const messages = [
      { role: 'system', content: configuration.system_message || 'You are a helpful AI assistant.' },
      { role: 'user', content: input.message || input }
    ];

    // Stream response from Cerebras
    await cerebrasClient.createStreamCompletion(
      messages,
      (chunk) => {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          res.write(`data: ${JSON.stringify({ content, type: 'chunk' })}\n\n`);
        }
      },
      configuration
    );

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Streaming failed' })}\n\n`);
    res.end();
  }
});

// Webhook endpoints
app.post('/api/webhooks', authMiddleware, (req, res) => {
  const { url, events } = req.body;
  const userId = req.user?.id;

  const webhookId = webhookSystem.registerWebhook(url, events);
  
  res.json({
    webhookId,
    url,
    events,
    status: 'registered'
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 AI Agent Orchestrator Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`⚡ Cerebras: ${process.env.CEREBRAS_API_KEY ? 'Configured' : 'Not configured'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, server, io }; 