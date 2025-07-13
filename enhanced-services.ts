// backend/src/services/execution-engine.ts
import Bull from 'bull';
import { prisma } from '../lib/database';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import { config } from '../config';
import { CerebrasClient } from '../lib/cerebras-integration';
import { WebhookService } from './webhook-service';

interface ExecutionOptions {
  webhookUrl?: string;
  timeout?: number;
  priority?: 'low' | 'normal' | 'high';
}

// Create execution queue with Redis
const executionQueue = new Bull('execution-queue', {
  redis: {
    port: parseInt(new URL(config.REDIS_URL).port),
    host: new URL(config.REDIS_URL).hostname,
    password: new URL(config.REDIS_URL).password,
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Process execution jobs
executionQueue.process(config.MAX_CONCURRENT_EXECUTIONS, async (job) => {
  const { executionId, agent, input, options } = job.data;
  
  try {
    // Update execution status
    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // Log start
    await logExecution(executionId, 'info', 'Execution started');

    // Execute based on framework
    let result;
    switch (agent.framework) {
      case 'cerebras':
      case 'cerebras-autogen':
        result = await executeCerebrasAgent(executionId, agent, input);
        break;
      case 'autogen':
        result = await executeAutogenAgent(executionId, agent, input);
        break;
      case 'crewai':
        result = await executeCrewAIAgent(executionId, agent, input);
        break;
      default:
        throw new Error(`Unsupported framework: ${agent.framework}`);
    }

    // Update execution with result
    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        output: result,
      },
    });

    // Log completion
    await logExecution(executionId, 'info', 'Execution completed successfully');

    // Send webhook if configured
    if (options.webhookUrl) {
      await WebhookService.send(options.webhookUrl, {
        event: 'execution.completed',
        executionId,
        status: 'COMPLETED',
        output: result,
      });
    }

    return result;
  } catch (error) {
    logger.error('Execution failed', {
      executionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Update execution status
    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    // Log error
    await logExecution(executionId, 'error', `Execution failed: ${error}`);

    // Send webhook if configured
    if (options.webhookUrl) {
      await WebhookService.send(options.webhookUrl, {
        event: 'execution.failed',
        executionId,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    throw error;
  }
});

// Cerebras agent execution
async function executeCerebrasAgent(
  executionId: string,
  agent: any,
  input: any
): Promise<any> {
  const cerebras = new CerebrasClient({
    apiKey: config.CEREBRAS_API_KEY,
    ...agent.configuration.llm_config,
  });

  const messages = [
    {
      role: 'system',
      content: agent.configuration.system_message || 'You are a helpful assistant.',
    },
    {
      role: 'user',
      content: typeof input === 'string' ? input : input.message,
    },
  ];

  await logExecution(executionId, 'info', 'Sending request to Cerebras API');

  const response = await cerebras.createCompletion(messages);
  
  await logExecution(executionId, 'info', 'Received response from Cerebras API');

  return {
    content: response.choices[0].message.content,
    usage: response.usage,
    model: response.model,
  };
}

// AutoGen agent execution
async function executeAutogenAgent(
  executionId: string,
  agent: any,
  input: any
): Promise<any> {
  // TODO: Implement AutoGen execution
  await logExecution(executionId, 'info', 'AutoGen execution started');
  
  // Simulate execution
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    response: 'AutoGen execution completed',
    agents: agent.configuration.agents,
  };
}

// CrewAI agent execution
async function executeCrewAIAgent(
  executionId: string,
  agent: any,
  input: any
): Promise<any> {
  // TODO: Implement CrewAI execution
  await logExecution(executionId, 'info', 'CrewAI execution started');
  
  // Simulate execution
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  return {
    response: 'CrewAI execution completed',
    crew: agent.configuration.crew,
  };
}

// Log execution events
async function logExecution(
  executionId: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata?: any
) {
  const log = await prisma.executionLog.create({
    data: {
      executionId,
      level,
      message,
      metadata,
    },
  });

  // Publish to Redis for real-time updates
  await redis.client.publish(
    `execution:${executionId}:logs`,
    JSON.stringify(log)
  );

  return log;
}

// Queue an execution
export async function executeAgent(
  executionId: string,
  agent: any,
  input: any,
  options: ExecutionOptions = {}
) {
  const job = await executionQueue.add(
    'execute',
    {
      executionId,
      agent,
      input,
      options,
    },
    {
      priority: options.priority === 'high' ? 1 : options.priority === 'low' ? 3 : 2,
      timeout: options.timeout || 60000,
    }
  );

  logger.info('Execution queued', {
    executionId,
    jobId: job.id,
    agentId: agent.id,
  });

  return job;
}

// Get queue statistics
export async function getQueueStats() {
  const [
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
  ] = await Promise.all([
    executionQueue.getWaitingCount(),
    executionQueue.getActiveCount(),
    executionQueue.getCompletedCount(),
    executionQueue.getFailedCount(),
    executionQueue.getDelayedCount(),
    executionQueue.getPausedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
    total: waiting + active + delayed,
  };
}

// backend/src/services/webhook-service.ts
import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../lib/database';
import { logger } from '../lib/logger';
import { config } from '../config';

export class WebhookService {
  static async send(url: string, payload: any): Promise<void> {
    const timestamp = Date.now();
    const signature = this.generateSignature(payload, timestamp);

    try {
      await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Timestamp': timestamp.toString(),
          'X-Webhook-Signature': signature,
          'User-Agent': 'AgentOrchestra/1.0',
        },
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: (status) => status < 400,
      });

      logger.info('Webhook sent successfully', { url, event: payload.event });
    } catch (error) {
      logger.error('Webhook failed', {
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  static generateSignature(payload: any, timestamp: number): string {
    const secret = config.API_SECRET_KEY;
    const data = `${timestamp}.${JSON.stringify(payload)}`;
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  static verifySignature(
    payload: any,
    timestamp: string,
    signature: string
  ): boolean {
    const expectedSignature = this.generateSignature(payload, parseInt(timestamp));
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

// backend/src/services/realtime-websocket.ts
import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/database';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import { config } from '../config';

interface SocketUser {
  userId: string;
  socketId: string;
  rooms: Set<string>;
}

export class RealtimeService {
  private io: Server;
  private users: Map<string, SocketUser> = new Map();

  constructor(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: config.ALLOWED_ORIGINS,
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupMiddleware();
    this.setupHandlers();
    this.setupRedisSubscriptions();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('No token provided'));
        }

        const decoded = jwt.verify(token, config.JWT_SECRET) as any;
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true },
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.data.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupHandlers() {
    this.io.on('connection', (socket) => {
      const userId = socket.data.user.id;
      
      logger.info('WebSocket connection established', {
        userId,
        socketId: socket.id,
      });

      // Track user
      this.users.set(socket.id, {
        userId,
        socketId: socket.id,
        rooms: new Set(),
      });

      // Join user's personal room
      socket.join(`user:${userId}`);

      // Handle joining execution rooms
      socket.on('join:execution', async (executionId: string) => {
        try {
          // Verify user has access to this execution
          const execution = await prisma.execution.findFirst({
            where: {
              id: executionId,
              userId,
            },
          });

          if (!execution) {
            socket.emit('error', { message: 'Execution not found' });
            return;
          }

          const room = `execution:${executionId}`;
          socket.join(room);
          this.users.get(socket.id)?.rooms.add(room);

          socket.emit('joined', { room });
        } catch (error) {
          socket.emit('error', { message: 'Failed to join room' });
        }
      });

      // Handle leaving execution rooms
      socket.on('leave:execution', (executionId: string) => {
        const room = `execution:${executionId}`;
        socket.leave(room);
        this.users.get(socket.id)?.rooms.delete(room);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info('WebSocket disconnected', {
          userId,
          socketId: socket.id,
        });
        this.users.delete(socket.id);
      });
    });
  }

  private setupRedisSubscriptions() {
    const subscriber = redis.client.duplicate();
    
    subscriber.connect().then(async () => {
      // Subscribe to execution updates
      await subscriber.pSubscribe('execution:*', (message, channel) => {
        const room = channel;
        this.io.to(room).emit('execution:update', JSON.parse(message));
      });

      // Subscribe to system notifications
      await subscriber.subscribe('notifications', (message) => {
        const notification = JSON.parse(message);
        if (notification.userId) {
          this.io.to(`user:${notification.userId}`).emit('notification', notification);
        } else {
          this.io.emit('notification', notification);
        }
      });
    });
  }

  // Send execution update
  async sendExecutionUpdate(executionId: string, update: any) {
    const channel = `execution:${executionId}`;
    await redis.client.publish(channel, JSON.stringify(update));
  }

  // Send user notification
  async sendUserNotification(userId: string, notification: any) {
    await redis.client.publish('notifications', JSON.stringify({
      userId,
      ...notification,
    }));
  }

  // Get connected users count
  getConnectedUsers(): number {
    return this.users.size;
  }

  // Get user's active rooms
  getUserRooms(socketId: string): string[] {
    return Array.from(this.users.get(socketId)?.rooms || []);
  }
}

// backend/src/lib/cerebras-integration.ts
import axios, { AxiosInstance } from 'axios';
import { logger } from './logger';
import { AppError } from '../middleware/error-handler';

interface CerebrasConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: Message;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class CerebrasClient {
  private client: AxiosInstance;
  private config: CerebrasConfig;

  constructor(config: CerebrasConfig) {
    this.config = {
      baseURL: 'https://api.cerebras.ai/v1',
      model: 'llama-4-scout-17b-16e-instruct',
      temperature: 0.2,
      maxTokens: 2048,
      timeout: 30000,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Add request/response interceptors
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Cerebras API request', {
          method: config.method,
          url: config.url,
        });
        return config;
      },
      (error) => {
        logger.error('Cerebras API request error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Cerebras API response', {
          status: response.status,
          model: response.data.model,
          usage: response.data.usage,
        });
        return response;
      },
      (error) => {
        logger.error('Cerebras API error', {
          status: error.response?.status,
          message: error.response?.data?.error?.message,
        });

        if (error.response?.status === 401) {
          throw new AppError(401, 'Invalid Cerebras API key');
        }
        if (error.response?.status === 429) {
          throw new AppError(429, 'Cerebras API rate limit exceeded');
        }
        if (error.response?.status === 503) {
          throw new AppError(503, 'Cerebras API temporarily unavailable');
        }

        throw new AppError(
          500,
          error.response?.data?.error?.message || 'Cerebras API error'
        );
      }
    );
  }

  async createCompletion(
    messages: Message[],
    options: Partial<CerebrasConfig> = {}
  ): Promise<CompletionResponse> {
    const response = await this.client.post('/chat/completions', {
      model: options.model || this.config.model,
      messages,
      temperature: options.temperature || this.config.temperature,
      max_tokens: options.maxTokens || this.config.maxTokens,
      stream: false,
    });

    return response.data;
  }

  async createStreamCompletion(
    messages: Message[],
    onChunk: (chunk: any) => void,
    options: Partial<CerebrasConfig> = {}
  ): Promise<void> {
    const response = await this.client.post(
      '/chat/completions',
      {
        model: options.model || this.config.model,
        messages,
        temperature: options.temperature || this.config.temperature,
        max_tokens: options.maxTokens || this.config.maxTokens,
        stream: true,
      },
      {
        responseType: 'stream',
      }
    );

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              resolve();
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              onChunk(parsed);
            } catch (error) {
              // Ignore parsing errors
            }
          }
        }
      });

      response.data.on('error', reject);
      response.data.on('end', resolve);
    });
  }

  async getAvailableModels(): Promise<string[]> {
    // Cerebras available models
    return [
      'llama-4-scout-17b-16e-instruct',
      'llama-3.1-70b-instruct',
      'llama-3.1-8b-instruct',
      'mixtral-8x7b-instruct',
      'gemma-7b-it',
    ];
  }

  estimateCost(usage: CompletionResponse['usage']): number {
    // $0.60 per 1M tokens
    const costPerMillion = 0.60;
    const totalTokens = usage.total_tokens;
    return (totalTokens / 1_000_000) * costPerMillion;
  }
}