// backend/src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';
import { config } from '../config';

interface ErrorResponse {
  error: string;
  message?: string;
  details?: any;
  stack?: string;
  code?: string;
  requestId?: string;
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = req.headers['x-request-id'] as string || 'unknown';
  
  // Log the error
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    requestId,
    userId: (req as any).user?.id,
  });

  const response: ErrorResponse = {
    error: 'Internal server error',
    requestId,
  };

  // Handle known error types
  if (error instanceof AppError) {
    response.error = error.message;
    response.code = error.code;
    response.details = error.details;
    
    if (config.NODE_ENV === 'development') {
      response.stack = error.stack;
    }
    
    return res.status(error.statusCode).json(response);
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    response.error = 'Validation error';
    response.details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
    
    return res.status(400).json(response);
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        response.error = 'Duplicate entry';
        response.details = {
          field: error.meta?.target,
          message: `A record with this ${error.meta?.target} already exists`,
        };
        return res.status(409).json(response);
        
      case 'P2025':
        response.error = 'Record not found';
        response.message = 'The requested resource does not exist';
        return res.status(404).json(response);
        
      case 'P2003':
        response.error = 'Invalid reference';
        response.message = 'Referenced record does not exist';
        return res.status(400).json(response);
        
      default:
        response.error = 'Database error';
        response.code = error.code;
        if (config.NODE_ENV === 'development') {
          response.details = error.meta;
        }
        return res.status(500).json(response);
    }
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    response.error = 'Invalid token';
    return res.status(401).json(response);
  }

  if (error.name === 'TokenExpiredError') {
    response.error = 'Token expired';
    return res.status(401).json(response);
  }

  // Default error response
  if (config.NODE_ENV === 'development') {
    response.message = error.message;
    response.stack = error.stack;
  }

  res.status(500).json(response);
};

// backend/src/middleware/security.ts
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { config } from '../config';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import crypto from 'crypto';

// Enhanced security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ...config.ALLOWED_ORIGINS],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// Rate limiter with Redis store
export const createRateLimiter = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  keyPrefix?: string;
}) => {
  return rateLimit({
    windowMs: options.windowMs || config.RATE_LIMIT_WINDOW_MS,
    max: options.max || config.RATE_LIMIT_MAX_REQUESTS,
    message: options.message || 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    store: {
      incr: async (key: string) => {
        const ttl = Math.round((options.windowMs || config.RATE_LIMIT_WINDOW_MS) / 1000);
        const fullKey = `${options.keyPrefix || 'rate'}:${key}`;
        
        const multi = (redis as any).client.multi();
        multi.incr(fullKey);
        multi.expire(fullKey, ttl);
        const results = await multi.exec();
        
        return results[0][1];
      },
      decrement: async (key: string) => {
        const fullKey = `${options.keyPrefix || 'rate'}:${key}`;
        return await redis.client.decr(fullKey);
      },
      resetKey: async (key: string) => {
        const fullKey = `${options.keyPrefix || 'rate'}:${key}`;
        return await redis.del(fullKey);
      },
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    },
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        userId: (req as any).user?.id,
      });
      
      res.status(429).json({
        error: 'Too many requests',
        message: options.message || 'Please try again later',
        retryAfter: res.getHeader('Retry-After'),
      });
    },
  });
};

// Slow down repeated requests
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per window without delay
  delayMs: (used) => (used - 50) * 100, // Add 100ms delay per request after limit
  maxDelayMs: 5000, // Maximum delay of 5 seconds
});

// Request ID middleware
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};

// IP whitelist/blacklist middleware
export const ipFilterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const clientIp = req.ip || req.socket.remoteAddress || '';
  
  // Check if IP is blacklisted
  const isBlacklisted = await redis.exists(`blacklist:ip:${clientIp}`);
  if (isBlacklisted) {
    logger.warn('Blacklisted IP attempted access', { ip: clientIp });
    return res.status(403).json({ error: 'Access denied' });
  }
  
  next();
};

// CORS middleware with dynamic origin validation
export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  
  if (origin && config.ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, X-Request-ID'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  
  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    });
  }
  
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  next();
};

function sanitizeString(str: string): string {
  // Remove null bytes
  str = str.replace(/\0/g, '');
  
  // Trim whitespace
  str = str.trim();
  
  // Limit length to prevent DoS
  if (str.length > 10000) {
    str = str.substring(0, 10000);
  }
  
  return str;
}

function sanitizeObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const sanitized: any = {};
    
    Object.keys(obj).forEach(key => {
      // Skip dangerous keys
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        return;
      }
      
      const value = obj[key];
      
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    });
    
    return sanitized;
  }
  
  return obj;
}

// Combined security middleware
export const securityMiddleware = [
  requestIdMiddleware,
  securityHeaders,
  corsMiddleware,
  ipFilterMiddleware,
  sanitizeInput,
];

// backend/src/middleware/monitoring.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { redis } from '../lib/redis';

interface RequestMetrics {
  path: string;
  method: string;
  statusCode: number;
  duration: number;
  userId?: string;
  userAgent?: string;
}

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Capture the original end function
  const originalEnd = res.end;
  
  res.end = function(...args: any[]) {
    // Calculate request duration
    const duration = Date.now() - startTime;
    
    // Collect metrics
    const metrics: RequestMetrics = {
      path: req.path,
      method: req.method,
      statusCode: res.statusCode,
      duration,
      userId: (req as any).user?.id,
      userAgent: req.headers['user-agent'],
    };
    
    // Log metrics
    logger.info('Request completed', metrics);
    
    // Store metrics in Redis for analytics
    const metricsKey = `metrics:${new Date().toISOString().split('T')[0]}`;
    redis.client.hIncrBy(metricsKey, `${req.method}:${req.path}:${res.statusCode}`, 1);
    redis.expire(metricsKey, 86400 * 7); // Keep for 7 days
    
    // Track slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        ...metrics,
        threshold: 1000,
      });
    }
    
    // Call the original end function
    originalEnd.apply(res, args);
  };
  
  next();
};

// Health check middleware
export const healthCheckMiddleware = async (req: Request, res: Response) => {
  const checks = {
    server: 'healthy',
    database: 'unknown',
    redis: 'unknown',
    memory: 'unknown',
  };
  
  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'healthy';
  } catch (error) {
    checks.database = 'unhealthy';
    logger.error('Database health check failed', error);
  }
  
  // Check Redis connection
  try {
    await redis.client.ping();
    checks.redis = 'healthy';
  } catch (error) {
    checks.redis = 'unhealthy';
    logger.error('Redis health check failed', error);
  }
  
  // Check memory usage
  const memUsage = process.memoryUsage();
  const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  if (memUsageMB < 500) {
    checks.memory = 'healthy';
  } else if (memUsageMB < 800) {
    checks.memory = 'warning';
  } else {
    checks.memory = 'critical';
  }
  
  const isHealthy = Object.values(checks).every(status => 
    status === 'healthy' || status === 'warning'
  );
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
    metrics: {
      memory: {
        used: memUsageMB,
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
      cpu: process.cpuUsage(),
    },
  });
};