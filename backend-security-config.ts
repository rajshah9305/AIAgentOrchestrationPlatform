// backend/src/config/index.ts
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Environment validation schema
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3002'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  DB_CONNECTION_POOL_SIZE: z.string().transform(Number).default('20'),
  
  // Authentication
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SESSION_SECRET: z.string().min(32),
  
  // OAuth Providers
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  
  // AI Services
  CEREBRAS_API_KEY: z.string(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  
  // Redis Configuration
  REDIS_URL: z.string().url(),
  REDIS_CONNECTION_POOL_SIZE: z.string().transform(Number).default('10'),
  
  // Security
  ENCRYPTION_KEY: z.string().min(32),
  API_SECRET_KEY: z.string().min(32),
  ALLOWED_ORIGINS: z.string().transform(val => val.split(',')),
  
  // Rate Limiting
  RATE_LIMIT_ENABLED: z.string().transform(val => val === 'true').default('true'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  
  // Email Configuration
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).default('587'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  
  // File Storage
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  
  // Frontend
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  NEXTAUTH_URL: z.string().url().optional(),
  
  // Monitoring
  SENTRY_DSN: z.string().optional(),
  POSTHOG_KEY: z.string().optional(),
  
  // Performance
  MAX_EXECUTION_TIME: z.string().transform(Number).default('300000'),
  MAX_CONCURRENT_EXECUTIONS: z.string().transform(Number).default('50'),
});

// Validate and export configuration
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parseResult.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parseResult.data;

// Type-safe config export
export type Config = z.infer<typeof envSchema>;

// backend/src/lib/database.ts
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

declare global {
  var prisma: PrismaClient | undefined;
}

// Singleton pattern for Prisma client
export const prisma = global.prisma || new PrismaClient({
  datasources: {
    db: {
      url: config.DATABASE_URL,
    },
  },
  log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  errorFormat: config.NODE_ENV === 'development' ? 'pretty' : 'minimal',
});

if (config.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// backend/src/lib/redis.ts
import Redis from 'redis';
import { config } from '../config';

class RedisClient {
  private client: Redis.RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = Redis.createClient({
      url: config.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis reconnection failed');
            return new Error('Redis reconnection limit exceeded');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
      this.isConnected = true;
    });
  }

  async connect() {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async get(key: string) {
    await this.connect();
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number) {
    await this.connect();
    if (ttl) {
      return this.client.setEx(key, ttl, value);
    }
    return this.client.set(key, value);
  }

  async del(key: string) {
    await this.connect();
    return this.client.del(key);
  }

  async exists(key: string) {
    await this.connect();
    return this.client.exists(key);
  }

  async expire(key: string, ttl: number) {
    await this.connect();
    return this.client.expire(key, ttl);
  }

  async flushAll() {
    await this.connect();
    return this.client.flushAll();
  }

  async disconnect() {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }
}

export const redis = new RedisClient();

// backend/src/lib/logger.ts
import winston from 'winston';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

// Add file transports in production
if (config.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: logFormat,
  transports,
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

// backend/src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { logger } from '../lib/logger';

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation error', { 
          path: req.path, 
          errors: error.errors 
        });
        
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
};

// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/database';
import { redis } from '../lib/redis';
import { config } from '../config';
import { logger } from '../lib/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    // Check if token is blacklisted
    const isBlacklisted = await redis.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET) as any;
    
    // Check if user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { 
        id: true, 
        email: true, 
        role: true, 
        isActive: true 
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    // Log successful authentication
    logger.info('User authenticated', { 
      userId: user.id, 
      path: req.path 
    });

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    logger.error('Authentication error', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// API Key authentication middleware
export const apiKeyAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'No API key provided' });
    }

    // Check API key in cache first
    const cachedKey = await redis.get(`apikey:${apiKey}`);
    if (cachedKey) {
      req.user = JSON.parse(cachedKey);
      return next();
    }

    // Validate API key
    const keyData = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { user: true },
    });

    if (!keyData || !keyData.isActive) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Check if key is expired
    if (keyData.expiresAt && keyData.expiresAt < new Date()) {
      return res.status(401).json({ error: 'API key expired' });
    }

    // Update last used
    await prisma.apiKey.update({
      where: { id: keyData.id },
      data: { lastUsedAt: new Date() },
    });

    // Cache the key for 5 minutes
    const userData = {
      id: keyData.user.id,
      email: keyData.user.email,
      role: keyData.user.role,
    };
    
    await redis.set(`apikey:${apiKey}`, JSON.stringify(userData), 300);
    
    req.user = userData;
    next();
  } catch (error) {
    logger.error('API key authentication error', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Combined auth middleware that accepts either JWT or API key
export const flexibleAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.headers.authorization) {
    return authMiddleware(req, res, next);
  } else if (req.headers['x-api-key']) {
    return apiKeyAuth(req, res, next);
  } else {
    return res.status(401).json({ error: 'No authentication provided' });
  }
};