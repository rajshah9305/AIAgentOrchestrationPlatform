// lib/api-keys/api-key-manager.ts
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export interface ApiKeyData {
  id: string
  name: string
  key: string
  permissions: string[]
  isActive: boolean
  lastUsedAt?: Date
  usageCount: number
  expiresAt?: Date
  createdAt: Date
}

export interface ApiKeyUsage {
  endpoint: string
  method: string
  statusCode: number
  timestamp: Date
  ipAddress?: string
  userAgent?: string
}

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.enum([
    'agents:read',
    'agents:write',
    'agents:delete',
    'executions:read',
    'executions:write',
    'executions:delete',
    'configurations:read',
    'configurations:write',
    'configurations:delete',
    'webhooks:read',
    'webhooks:write',
    'webhooks:delete',
    'analytics:read',
    'admin:all'
  ])).min(1),
  expiresAt: z.string().datetime().optional()
})

export class ApiKeyManager {
  private static readonly KEY_PREFIX = 'ao_'
  private static readonly KEY_LENGTH = 64

  static generateApiKey(): string {
    const randomBytes = crypto.randomBytes(this.KEY_LENGTH)
    const key = randomBytes.toString('hex')
    return `${this.KEY_PREFIX}${key}`
  }

  static hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex')
  }

  async createApiKey(
    userId: string,
    name: string,
    permissions: string[],
    expiresAt?: Date
  ): Promise<{ id: string; key: string }> {
    const apiKey = ApiKeyManager.generateApiKey()
    const hashedKey = ApiKeyManager.hashApiKey(apiKey)

    const apiKeyRecord = await prisma.apiKey.create({
      data: {
        userId,
        name,
        key: hashedKey,
        permissions,
        expiresAt,
        isActive: true
      }
    })

    // Log API key creation
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'API_KEY_CREATED',
        resourceType: 'API_KEY',
        resourceId: apiKeyRecord.id,
        details: {
          name,
          permissions,
          expiresAt: expiresAt?.toISOString()
        }
      }
    })

    return {
      id: apiKeyRecord.id,
      key: apiKey // Return unhashed key only once
    }
  }

  async validateApiKey(key: string): Promise<{
    valid: boolean
    userId?: string
    permissions?: string[]
    keyId?: string
  }> {
    if (!key.startsWith(ApiKeyManager.KEY_PREFIX)) {
      return { valid: false }
    }

    const hashedKey = ApiKeyManager.hashApiKey(key)

    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { key: hashedKey },
      include: { user: true }
    })

    if (!apiKeyRecord) {
      return { valid: false }
    }

    if (!apiKeyRecord.isActive) {
      return { valid: false }
    }

    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      // Automatically disable expired keys
      await prisma.apiKey.update({
        where: { id: apiKeyRecord.id },
        data: { isActive: false }
      })
      return { valid: false }
    }

    // Update last used timestamp and usage count
    await prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 }
      }
    })

    return {
      valid: true,
      userId: apiKeyRecord.userId,
      permissions: apiKeyRecord.permissions,
      keyId: apiKeyRecord.id
    }
  }

  async getUserApiKeys(userId: string): Promise<ApiKeyData[]> {
    return prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        key: false, // Never return the actual key
        permissions: true,
        isActive: true,
        lastUsedAt: true,
        usageCount: true,
        expiresAt: true,
        createdAt: true
      }
    }) as Promise<ApiKeyData[]>
  }

  async updateApiKey(
    keyId: string,
    userId: string,
    updates: {
      name?: string
      permissions?: string[]
      isActive?: boolean
      expiresAt?: Date
    }
  ): Promise<boolean> {
    const result = await prisma.apiKey.updateMany({
      where: {
        id: keyId,
        userId
      },
      data: updates
    })

    if (result.count > 0) {
      // Log API key update
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'API_KEY_UPDATED',
          resourceType: 'API_KEY',
          resourceId: keyId,
          details: updates
        }
      })
    }

    return result.count > 0
  }

  async revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    const result = await prisma.apiKey.updateMany({
      where: {
        id: keyId,
        userId
      },
      data: { isActive: false }
    })

    if (result.count > 0) {
      // Log API key revocation
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'API_KEY_REVOKED',
          resourceType: 'API_KEY',
          resourceId: keyId,
          details: {}
        }
      })
    }

    return result.count > 0
  }

  async deleteApiKey(keyId: string, userId: string): Promise<boolean> {
    const result = await prisma.apiKey.deleteMany({
      where: {
        id: keyId,
        userId
      }
    })

    if (result.count > 0) {
      // Log API key deletion
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'API_KEY_DELETED',
          resourceType: 'API_KEY',
          resourceId: keyId,
          details: {}
        }
      })
    }

    return result.count > 0
  }

  async logApiUsage(
    keyId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await prisma.apiKeyUsage.create({
        data: {
          apiKeyId: keyId,
          endpoint,
          method,
          statusCode,
          ipAddress,
          userAgent,
          timestamp: new Date()
        }
      })
    } catch (error) {
      console.error('Error logging API usage:', error)
    }
  }

  async getApiKeyUsageStats(
    keyId: string,
    userId: string,
    timeframe: 'hour' | 'day' | 'week' | 'month' = 'week'
  ): Promise<any> {
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId }
    })

    if (!apiKey) {
      throw new Error('API key not found')
    }

    const now = new Date()
    let startDate: Date

    switch (timeframe) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
    }

    const [
      totalRequests,
      successfulRequests,
      errorRequests,
      topEndpoints,
      requestsByHour
    ] = await Promise.all([
      prisma.apiKeyUsage.count({
        where: {
          apiKeyId: keyId,
          timestamp: { gte: startDate }
        }
      }),
      prisma.apiKeyUsage.count({
        where: {
          apiKeyId: keyId,
          timestamp: { gte: startDate },
          statusCode: { gte: 200, lt: 400 }
        }
      }),
      prisma.apiKeyUsage.count({
        where: {
          apiKeyId: keyId,
          timestamp: { gte: startDate },
          statusCode: { gte: 400 }
        }
      }),
      prisma.apiKeyUsage.groupBy({
        by: ['endpoint', 'method'],
        where: {
          apiKeyId: keyId,
          timestamp: { gte: startDate }
        },
        _count: true,
        orderBy: { _count: { endpoint: 'desc' } },
        take: 10
      }),
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('hour', timestamp) as hour,
          COUNT(*) as requests
        FROM api_key_usage 
        WHERE api_key_id = ${keyId}
          AND timestamp >= ${startDate}
        GROUP BY DATE_TRUNC('hour', timestamp)
        ORDER BY hour ASC
      `
    ])

    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0

    return {
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        permissions: apiKey.permissions
      },
      timeframe,
      stats: {
        totalRequests,
        successfulRequests,
        errorRequests,
        successRate: Math.round(successRate * 100) / 100
      },
      topEndpoints,
      requestsByHour
    }
  }

  hasPermission(userPermissions: string[], requiredPermission: string): boolean {
    if (userPermissions.includes('admin:all')) {
      return true
    }

    return userPermissions.includes(requiredPermission)
  }
}

export const apiKeyManager = new ApiKeyManager()

// lib/rate-limiting/rate-limiter.ts
import { Redis } from 'ioredis'

export interface RateLimit {
  requests: number
  windowMs: number
  message?: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: Date
  totalHits: number
}

export class RateLimiter {
  private redis: Redis

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
  }

  async checkRateLimit(
    identifier: string,
    limit: RateLimit
  ): Promise<RateLimitResult> {
    const key = `rate_limit:${identifier}`
    const window = Math.floor(Date.now() / limit.windowMs)
    const windowKey = `${key}:${window}`

    try {
      const pipeline = this.redis.pipeline()
      pipeline.incr(windowKey)
      pipeline.expire(windowKey, Math.ceil(limit.windowMs / 1000))
      
      const results = await pipeline.exec()
      const currentHits = results?.[0]?.[1] as number || 0

      const remaining = Math.max(0, limit.requests - currentHits)
      const resetTime = new Date((window + 1) * limit.windowMs)

      return {
        allowed: currentHits <= limit.requests,
        remaining,
        resetTime,
        totalHits: currentHits
      }

    } catch (error) {
      console.error('Rate limiter error:', error)
      // Fail open - allow request if rate limiter is down
      return {
        allowed: true,
        remaining: limit.requests,
        resetTime: new Date(Date.now() + limit.windowMs),
        totalHits: 0
      }
    }
  }

  async getRateLimits(): Promise<Record<string, RateLimit>> {
    return {
      // General API limits
      'api:general': {
        requests: 1000,
        windowMs: 60 * 60 * 1000, // 1 hour
        message: 'Too many API requests. Please try again later.'
      },
      
      // Agent execution limits
      'api:execution': {
        requests: 100,
        windowMs: 60 * 60 * 1000, // 1 hour
        message: 'Too many execution requests. Please try again later.'
      },
      
      // Authentication limits
      'auth:login': {
        requests: 10,
        windowMs: 15 * 60 * 1000, // 15 minutes
        message: 'Too many login attempts. Please try again later.'
      },
      
      // Webhook limits
      'api:webhook': {
        requests: 50,
        windowMs: 60 * 60 * 1000, // 1 hour
        message: 'Too many webhook requests. Please try again later.'
      }
    }
  }
}

export const rateLimiter = new RateLimiter()

// middleware/api-auth.ts
import { NextRequest, NextResponse } from 'next/server'
import { apiKeyManager } from '@/lib/api-keys/api-key-manager'
import { rateLimiter } from '@/lib/rate-limiting/rate-limiter'

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string
    permissions: string[]
    keyId: string
  }
}

export function withApiAuth(requiredPermission?: string) {
  return async function authMiddleware(
    request: AuthenticatedRequest
  ): Promise<NextResponse | null> {
    try {
      // Extract API key from Authorization header
      const authHeader = request.headers.get('Authorization')
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Missing or invalid Authorization header' },
          { status: 401 }
        )
      }

      const apiKey = authHeader.substring(7) // Remove 'Bearer ' prefix

      // Validate API key
      const validation = await apiKeyManager.validateApiKey(apiKey)
      
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Invalid or expired API key' },
          { status: 401 }
        )
      }

      // Check permissions if required
      if (requiredPermission && !apiKeyManager.hasPermission(validation.permissions!, requiredPermission)) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      }

      // Check rate limits
      const rateLimits = await rateLimiter.getRateLimits()
      const generalLimit = rateLimits['api:general']
      
      const rateCheck = await rateLimiter.checkRateLimit(
        `api:${validation.userId}`,
        generalLimit
      )

      if (!rateCheck.allowed) {
        return NextResponse.json(
          { 
            error: generalLimit.message,
            resetTime: rateCheck.resetTime.toISOString()
          },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': generalLimit.requests.toString(),
              'X-RateLimit-Remaining': rateCheck.remaining.toString(),
              'X-RateLimit-Reset': rateCheck.resetTime.toISOString()
            }
          }
        )
      }

      // Add user info to request
      request.user = {
        id: validation.userId!,
        permissions: validation.permissions!,
        keyId: validation.keyId!
      }

      // Log API usage
      const url = new URL(request.url)
      await apiKeyManager.logApiUsage(
        validation.keyId!,
        url.pathname,
        request.method,
        200, // We'll update this after the response
        request.headers.get('x-forwarded-for') || 'unknown',
        request.headers.get('user-agent') || 'unknown'
      )

      return null // Continue to the actual handler

    } catch (error) {
      console.error('API authentication error:', error)
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      )
    }
  }
}

// app/api/auth/api-keys/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { apiKeyManager } from '@/lib/api-keys/api-key-manager'

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).min(1),
  expiresAt: z.string().datetime().optional()
})

// GET /api/auth/api-keys - List user's API keys
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKeys = await apiKeyManager.getUserApiKeys(session.user.id)
    return NextResponse.json({ apiKeys })

  } catch (error) {
    console.error('Error fetching API keys:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/auth/api-keys - Create new API key
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createApiKeySchema.parse(body)

    const result = await apiKeyManager.createApiKey(
      session.user.id,
      data.name,
      data.permissions,
      data.expiresAt ? new Date(data.expiresAt) : undefined
    )

    return NextResponse.json({
      id: result.id,
      key: result.key,
      message: 'API key created successfully. Store this key securely - it will not be shown again.'
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: error.errors 
      }, { status: 400 })
    }

    console.error('Error creating API key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}