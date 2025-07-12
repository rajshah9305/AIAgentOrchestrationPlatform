import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

// Test database client
const prisma = new PrismaClient()

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/test_db'
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379'
  
  // Connect to test database
  await prisma.$connect()
  
  // Clean database
  await cleanDatabase()
})

// Clean up after all tests
afterAll(async () => {
  await cleanDatabase()
  await prisma.$disconnect()
})

// Clean database before each test
beforeEach(async () => {
  await cleanDatabase()
})

// Clean database after each test
afterEach(async () => {
  await cleanDatabase()
})

// Helper function to clean database
async function cleanDatabase() {
  const tables = [
    'execution_logs',
    'executions',
    'agents',
    'saved_configurations',
    'audit_logs',
    'api_keys',
    'api_key_usage',
    'users',
  ]
  
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`)
    } catch (error) {
      // Table might not exist, ignore error
    }
  }
}

// Mock environment variables for testing
process.env.JWT_SECRET = 'test-jwt-secret'
process.env.CEREBRAS_API_KEY = 'test-cerebras-key'
process.env.CORS_ORIGIN = 'http://localhost:3000'
process.env.RATE_LIMIT_WINDOW_MS = '900000'
process.env.RATE_LIMIT_MAX_REQUESTS = '100'

// Export test utilities
export { prisma } 