import { PrismaClient } from '@prisma/client'
import { beforeAll, afterAll, beforeEach } from 'vitest'

const prisma = new PrismaClient()

// Test database setup
beforeAll(async () => {
  // Connect to test database
  await prisma.$connect()
  
  // Clean database before all tests
  await cleanDatabase()
})

afterAll(async () => {
  // Clean database after all tests
  await cleanDatabase()
  
  // Disconnect from database
  await prisma.$disconnect()
})

beforeEach(async () => {
  // Clean database before each test
  await cleanDatabase()
})

async function cleanDatabase() {
  // Delete all data in reverse order of dependencies
  await prisma.executionLog.deleteMany()
  await prisma.execution.deleteMany()
  await prisma.agent.deleteMany()
  await prisma.savedConfiguration.deleteMany()
  await prisma.webhookLog.deleteMany()
  await prisma.webhook.deleteMany()
  await prisma.apiKey.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.user.deleteMany()
  await prisma.framework.deleteMany()
}

// Export test utilities
export const createTestUser = async (data: any = {}) => {
  return await prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      role: 'USER',
      ...data
    }
  })
}

export const createTestAgent = async (userId: string, data: any = {}) => {
  return await prisma.agent.create({
    data: {
      name: `Test Agent ${Date.now()}`,
      description: 'Test agent for testing',
      framework: 'AUTOGEN',
      configuration: {},
      userId,
      ...data
    }
  })
}

export const createTestExecution = async (agentId: string, userId: string, data: any = {}) => {
  return await prisma.execution.create({
    data: {
      agentId,
      userId,
      status: 'PENDING',
      input: {},
      ...data
    }
  })
}

export { prisma } 