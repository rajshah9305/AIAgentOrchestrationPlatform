import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import Redis from 'redis'

export const healthCheck = async (req: Request, res: Response) => {
  const startTime = Date.now()
  
  try {
    // Check database connection
    const dbCheck = await checkDatabase()
    
    // Check Redis connection
    const redisCheck = await checkRedis()
    
    // Check system resources
    const systemCheck = await checkSystemResources()
    
    // Determine overall health
    const checks = {
      database: dbCheck,
      redis: redisCheck,
      system: systemCheck
    }
    
    const overallStatus = determineOverallStatus(checks)
    
    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      checks,
      responseTime: Date.now() - startTime
    }
    
    const statusCode = overallStatus === 'healthy' ? 200 : 503
    res.status(statusCode).json(response)
    
  } catch (error) {
    console.error('Health check failed:', error)
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      responseTime: Date.now() - startTime
    })
  }
}

async function checkDatabase() {
  const startTime = Date.now()
  
  try {
    await prisma.$queryRaw`SELECT 1`
    
    return {
      status: 'pass',
      responseTime: Date.now() - startTime,
      message: 'Database connection healthy'
    }
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - startTime,
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function checkRedis() {
  const startTime = Date.now()
  
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    const client = Redis.createClient({ url: redisUrl })
    
    await client.connect()
    await client.ping()
    await client.disconnect()
    
    return {
      status: 'pass',
      responseTime: Date.now() - startTime,
      message: 'Redis connection healthy'
    }
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - startTime,
      message: 'Redis connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function checkSystemResources() {
  const startTime = Date.now()
  
  try {
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    const memoryUsage = {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    }
    
    // Check if memory usage is acceptable (less than 80%)
    const memoryStatus = memoryUsage.percentage < 80 ? 'pass' : 'warn'
    
    return {
      status: memoryStatus,
      responseTime: Date.now() - startTime,
      message: 'System resources check completed',
      details: {
        memory: memoryUsage,
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      }
    }
  } catch (error) {
    return {
      status: 'fail',
      responseTime: Date.now() - startTime,
      message: 'System resources check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function determineOverallStatus(checks: Record<string, any>): 'healthy' | 'degraded' | 'unhealthy' {
  const statuses = Object.values(checks).map(check => check.status)
  
  if (statuses.every(status => status === 'pass')) {
    return 'healthy'
  } else if (statuses.some(status => status === 'fail')) {
    return 'unhealthy'
  } else {
    return 'degraded'
  }
}