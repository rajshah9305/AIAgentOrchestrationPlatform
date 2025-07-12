// src/test/global-setup.ts
import { execSync } from 'child_process'
import { randomBytes } from 'crypto'

export default async function globalSetup() {
  // Generate a unique test database
  const testDbSuffix = randomBytes(8).toString('hex')
  const testDatabaseUrl = `postgresql://postgres:postgres@localhost:5432/test_db_${testDbSuffix}`
  
  // Set environment variables for tests
  process.env.DATABASE_URL = testDatabaseUrl
  process.env.DIRECT_URL = testDatabaseUrl
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-jwt-secret'
  process.env.REDIS_URL = 'redis://localhost:6379/1'
  
  try {
    // Create test database
    execSync(`createdb test_db_${testDbSuffix}`, { stdio: 'ignore' })
    
    // Run Prisma migrations
    execSync('npx prisma db push --force-reset', {
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: 'ignore'
    })
    
    console.log(`Test database created: test_db_${testDbSuffix}`)
  } catch (error) {
    console.warn('Could not set up test database:', error)
  }
}

// ---

// src/test/setup.ts
import { beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

// Mock external services
vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: vi.fn().mockResolvedValue(true),
  })),
}))

// Mock Cerebras API
vi.mock('../lib/cerebras', () => ({
  CerebrasClient: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      },
    },
  })),
}))

// Mock Bull queues
vi.mock('bull', () => ({
  default: vi.fn(() => ({
    add: vi.fn(),
    process: vi.fn(),
    clean: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
  })),
}))

// Mock Socket.IO
vi.mock('socket.io', () => ({
  Server: vi.fn(() => ({
    emit: vi.fn(),
    to: vi.fn(() => ({ emit: vi.fn() })),
    on: vi.fn(),
    close: vi.fn(),
  })),
}))

// Global test setup
let prisma: PrismaClient
let redis: Redis

beforeAll(async () => {
  // Initialize test database connection
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
  
  // Initialize test Redis connection
  redis = new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 1,
    retryDelayOnFailover: 100,
    lazyConnect: true,
  })
  
  try {
    await redis.connect()
  } catch (error) {
    console.warn('Could not connect to Redis for tests:', error)
  }
})

afterAll(async () => {
  // Cleanup
  await prisma?.$disconnect()
  await redis?.disconnect()
})

beforeEach(async () => {
  // Clean database before each test
  if (prisma) {
    const tableNames = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public';
    `
    
    for (const { tablename } of tableNames) {
      if (tablename !== '_prisma_migrations') {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`)
      }
    }
  }
  
  // Clear Redis test database
  if (redis.status === 'ready') {
    await redis.flushdb()
  }
})

// Export test utilities
export { prisma, redis }

// Test utilities
export const createTestUser = async (overrides = {}) => {
  return prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      ...overrides,
    },
  })
}

export const createTestAgent = async (userId: string, overrides = {}) => {
  return prisma.agent.create({
    data: {
      name: 'Test Agent',
      description: 'A test agent',
      framework: 'CEREBRAS',
      configuration: {
        model: 'llama-4-scout-17b-16e-instruct',
        temperature: 0.2,
      },
      userId,
      ...overrides,
    },
  })
}

export const createTestExecution = async (agentId: string, userId: string, overrides = {}) => {
  return prisma.execution.create({
    data: {
      input: { message: 'Test input' },
      status: 'PENDING',
      trigger: 'MANUAL',
      environment: 'DEVELOPMENT',
      agentId,
      userId,
      ...overrides,
    },
  })
}

// Mock authentication middleware
export const mockAuthUser = (user: any) => {
  return (req: any, res: any, next: any) => {
    req.user = user
    next()
  }
}

// HTTP test helpers
export const createTestApp = async () => {
  const { app } = await import('../index')
  return app
}

// Clean up function for tests
export const cleanup = async () => {
  if (prisma) {
    await prisma.$disconnect()
  }
  if (redis && redis.status === 'ready') {
    await redis.disconnect()
  }
}

// ---

// src/test/helpers.ts
import supertest from 'supertest'
import { sign } from 'jsonwebtoken'
import type { User } from '@prisma/client'

export const generateTestToken = (user: Partial<User>) => {
  return sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  )
}

export const authenticatedRequest = (app: any, user: Partial<User>) => {
  const token = generateTestToken(user)
  return supertest(app).set('Authorization', `Bearer ${token}`)
}

export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const expectToThrow = async (fn: () => Promise<any>, expectedError?: string) => {
  try {
    await fn()
    throw new Error('Expected function to throw')
  } catch (error) {
    if (expectedError && !error.message.includes(expectedError)) {
      throw new Error(`Expected error containing "${expectedError}", got: ${error.message}`)
    }
  }
}

// Database test helpers
export const clearTable = async (tableName: string) => {
  const { prisma } = await import('./setup')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE`)
}

export const seedTestData = async () => {
  const { createTestUser, createTestAgent } = await import('./setup')
  
  const user = await createTestUser()
  const agent = await createTestAgent(user.id)
  
  return { user, agent }
}