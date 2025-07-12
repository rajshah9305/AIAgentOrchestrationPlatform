// lib/monitoring/health-checker.ts
import { prisma } from '@/lib/prisma'
import { Redis } from 'ioredis'
import { QueueMonitor } from '@/lib/jobs/job-queue'
import { emailService } from '@/lib/email/email-service'

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date
  version: string
  uptime: number
  checks: {
    database: HealthCheck
    redis: HealthCheck
    queues: HealthCheck
    email: HealthCheck
    storage: HealthCheck
    external_apis: HealthCheck
  }
  metrics: SystemMetrics
}

export interface HealthCheck {
  status: 'pass' | 'warn' | 'fail'
  responseTime: number
  message?: string
  details?: any
}

export interface SystemMetrics {
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    percentage: number
  }
  activeConnections: number
  activeExecutions: number
  queueSizes: {
    execution: number
    webhook: number
    notification: number
    cleanup: number
  }
  errorRate: number
}

export class HealthMonitor {
  private redis: Redis
  private startTime: Date
  private healthHistory: HealthStatus[] = []
  private maxHistorySize = 100

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
    this.startTime = new Date()
  }

  async checkHealth(): Promise<HealthStatus> {
    const checkStartTime = Date.now()
    
    const [
      databaseCheck,
      redisCheck,
      queuesCheck,
      emailCheck,
      storageCheck,
      externalApisCheck
    ] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueues(),
      this.checkEmail(),
      this.checkStorage(),
      this.checkExternalAPIs()
    ])

    const checks = {
      database: this.getCheckResult(databaseCheck),
      redis: this.getCheckResult(redisCheck),
      queues: this.getCheckResult(queuesCheck),
      email: this.getCheckResult(emailCheck),
      storage: this.getCheckResult(storageCheck),
      external_apis: this.getCheckResult(externalApisCheck)
    }

    const metrics = await this.getSystemMetrics()
    const overallStatus = this.calculateOverallStatus(checks)

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Date.now() - this.startTime.getTime(),
      checks,
      metrics
    }

    // Store health status in history
    this.healthHistory.push(healthStatus)
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.shift()
    }

    // Alert if system is unhealthy
    if (overallStatus === 'unhealthy') {
      await this.sendHealthAlert(healthStatus)
    }

    return healthStatus
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      await prisma.$queryRaw`SELECT 1`
      
      return {
        status: 'pass',
        responseTime: Date.now() - startTime,
        message: 'Database connection successful'
      }
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: 'Database connection failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      await this.redis.ping()
      
      return {
        status: 'pass',
        responseTime: Date.now() - startTime,
        message: 'Redis connection successful'
      }
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: 'Redis connection failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  private async checkQueues(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const queueHealth = await QueueMonitor.getHealth()
      
      if (queueHealth.status === 'healthy') {
        return {
          status: 'pass',
          responseTime: Date.now() - startTime,
          message: 'All queues operational',
          details: queueHealth
        }
      } else {
        return {
          status: queueHealth.status === 'degraded' ? 'warn' : 'fail',
          responseTime: Date.now() - startTime,
          message: `Queue system status: ${queueHealth.status}`,
          details: queueHealth
        }
      }
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: 'Queue health check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  private async checkEmail(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const isConnected = await emailService.verifyConnection()
      
      return {
        status: isConnected ? 'pass' : 'fail',
        responseTime: Date.now() - startTime,
        message: isConnected ? 'Email service operational' : 'Email service unavailable'
      }
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: 'Email service check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  private async checkStorage(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      // Check file system storage
      const fs = await import('fs/promises')
      const stats = await fs.stat(process.cwd())
      
      return {
        status: 'pass',
        responseTime: Date.now() - startTime,
        message: 'Storage accessible',
        details: { accessible: true }
      }
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: 'Storage check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }

  private async checkExternalAPIs(): Promise<HealthCheck> {
    const startTime = Date.now()
    const checks = []

    // Check OpenAI API
    if (process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(5000)
        })
        
        checks.push({
          service: 'OpenAI',
          status: response.ok ? 'pass' : 'fail',
          statusCode: response.status
        })
      } catch (error) {
        checks.push({
          service: 'OpenAI',
          status: 'fail',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Check Anthropic API
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }]
          }),
          signal: AbortSignal.timeout(5000)
        })
        
        checks.push({
          service: 'Anthropic',
          status: response.ok ? 'pass' : 'fail',
          statusCode: response.status
        })
      } catch (error) {
        checks.push({
          service: 'Anthropic',
          status: 'fail',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const failedChecks = checks.filter(check => check.status === 'fail')
    
    return {
      status: failedChecks.length === 0 ? 'pass' : failedChecks.length < checks.length ? 'warn' : 'fail',
      responseTime: Date.now() - startTime,
      message: `${checks.length - failedChecks.length}/${checks.length} external APIs operational`,
      details: { checks }
    }
  }

  private async getSystemMetrics(): Promise<SystemMetrics> {
    const process = await import('process')
    const memoryUsage = process.memoryUsage()
    
    // Get active executions count
    const activeExecutions = await prisma.execution.count({
      where: { status: { in: ['PENDING', 'RUNNING'] } }
    })

    // Get queue sizes
    const queueStats = await QueueMonitor.getHealth()
    const queueSizes = {
      execution: queueStats.queues?.execution?.active + queueStats.queues?.execution?.waiting || 0,
      webhook: queueStats.queues?.webhook?.active + queueStats.queues?.webhook?.waiting || 0,
      notification: queueStats.queues?.notification?.active + queueStats.queues?.notification?.waiting || 0,
      cleanup: queueStats.queues?.cleanup?.active + queueStats.queues?.cleanup?.waiting || 0
    }

    // Calculate error rate (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const [totalExecutions, failedExecutions] = await Promise.all([
      prisma.execution.count({
        where: { startedAt: { gte: oneHourAgo } }
      }),
      prisma.execution.count({
        where: {
          startedAt: { gte: oneHourAgo },
          status: 'FAILED'
        }
      })
    ])

    const errorRate = totalExecutions > 0 ? (failedExecutions / totalExecutions) * 100 : 0

    return {
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      cpu: {
        percentage: process.cpuUsage().user / 1000000 // Convert microseconds to percentage (simplified)
      },
      activeConnections: 0, // Would need to implement connection tracking
      activeExecutions,
      queueSizes,
      errorRate: Math.round(errorRate * 100) / 100
    }
  }

  private getCheckResult(settledResult: PromiseSettledResult<HealthCheck>): HealthCheck {
    if (settledResult.status === 'fulfilled') {
      return settledResult.value
    } else {
      return {
        status: 'fail',
        responseTime: 0,
        message: 'Health check threw an exception',
        details: { error: settledResult.reason }
      }
    }
  }

  private calculateOverallStatus(checks: Record<string, HealthCheck>): 'healthy' | 'degraded' | 'unhealthy' {
    const checkValues = Object.values(checks)
    const failedChecks = checkValues.filter(check => check.status === 'fail')
    const warnChecks = checkValues.filter(check => check.status === 'warn')

    if (failedChecks.length === 0 && warnChecks.length === 0) {
      return 'healthy'
    } else if (failedChecks.length === 0) {
      return 'degraded'
    } else {
      return 'unhealthy'
    }
  }

  private async sendHealthAlert(healthStatus: HealthStatus): Promise<void> {
    try {
      // Get admin users
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { email: true, name: true }
      })

      const failedChecks = Object.entries(healthStatus.checks)
        .filter(([_, check]) => check.status === 'fail')
        .map(([name, check]) => ({ name, message: check.message }))

      for (const admin of adminUsers) {
        await emailService.sendEmail({
          to: admin.email,
          subject: '🚨 AgentOrchestra System Health Alert',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #dc3545; color: white; padding: 20px; text-align: center;">
                <h1>🚨 System Health Alert</h1>
                <p>AgentOrchestra is experiencing issues</p>
              </div>
              
              <div style="padding: 20px;">
                <h2>Failed Health Checks:</h2>
                <ul>
                  ${failedChecks.map(check => `<li><strong>${check.name}:</strong> ${check.message}</li>`).join('')}
                </ul>
                
                <h3>System Status: ${healthStatus.status.toUpperCase()}</h3>
                <p>Timestamp: ${healthStatus.timestamp.toISOString()}</p>
                
                <div style="margin-top: 20px;">
                  <a href="${process.env.NEXTAUTH_URL}/admin/health" 
                     style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    View System Dashboard
                  </a>
                </div>
              </div>
            </div>
          `
        })
      }
    } catch (error) {
      console.error('Failed to send health alert:', error)
    }
  }

  getHealthHistory(): HealthStatus[] {
    return [...this.healthHistory]
  }

  async getMetricsTrend(hours = 24): Promise<any> {
    const now = new Date()
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000)
    
    // This would typically come from a time-series database
    // For now, return recent health history
    return this.healthHistory
      .filter(status => status.timestamp >= startTime)
      .map(status => ({
        timestamp: status.timestamp,
        status: status.status,
        responseTime: Object.values(status.checks).reduce((sum, check) => sum + check.responseTime, 0) / Object.values(status.checks).length,
        errorRate: status.metrics.errorRate,
        activeExecutions: status.metrics.activeExecutions
      }))
  }
}

export const healthMonitor = new HealthMonitor()

// app/api/health/route.ts
import { NextResponse } from 'next/server'
import { healthMonitor } from '@/lib/monitoring/health-checker'

export async function GET() {
  try {
    const health = await healthMonitor.checkHealth()
    
    // Return appropriate HTTP status based on health
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503

    return NextResponse.json(health, { status: statusCode })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date(),
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    )
  }
}

// app/api/health/metrics/route.ts
export async function GET() {
  try {
    const trends = await healthMonitor.getMetricsTrend(24)
    return NextResponse.json({ trends })
  } catch (error) {
    console.error('Metrics fetch failed:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

// app/api/admin/health/detailed/route.ts
import { getServerSession } from 'next-auth'

export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [health, history] = await Promise.all([
      healthMonitor.checkHealth(),
      healthMonitor.getHealthHistory()
    ])

    // Additional admin-only details
    const detailedHealth = {
      ...health,
      history: history.slice(-50), // Last 50 health checks
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        env: process.env.NODE_ENV,
        pid: process.pid
      }
    }

    return NextResponse.json(detailedHealth)
  } catch (error) {
    console.error('Detailed health check failed:', error)
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    )
  }
}

// lib/monitoring/performance-monitor.ts
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Map<string, number[]> = new Map()

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    
    const values = this.metrics.get(name)!
    values.push(value)
    
    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift()
    }
  }

  getMetricStats(name: string): { avg: number, min: number, max: number, count: number } | null {
    const values = this.metrics.get(name)
    if (!values || values.length === 0) {
      return null
    }

    const sum = values.reduce((a, b) => a + b, 0)
    return {
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    }
  }

  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {}
    
    for (const [name, values] of this.metrics.entries()) {
      result[name] = this.getMetricStats(name)
    }
    
    return result
  }

  clearMetrics(): void {
    this.metrics.clear()
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance()

// middleware/performance-tracking.ts
import { NextRequest, NextResponse } from 'next/server'
import { performanceMonitor } from '@/lib/monitoring/performance-monitor'

export function withPerformanceTracking() {
  return async function performanceMiddleware(
    request: NextRequest,
    next: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    const startTime = Date.now()
    
    try {
      const response = await next()
      const duration = Date.now() - startTime
      
      // Record performance metrics
      const url = new URL(request.url)
      const route = url.pathname
      
      performanceMonitor.recordMetric(`response_time:${route}`, duration)
      performanceMonitor.recordMetric(`response_time:${request.method}:${response.status}`, duration)
      performanceMonitor.recordMetric('response_time:overall', duration)
      
      // Add performance headers
      response.headers.set('X-Response-Time', `${duration}ms`)
      
      return response
    } catch (error) {
      const duration = Date.now() - startTime
      performanceMonitor.recordMetric('response_time:error', duration)
      throw error
    }
  }
}