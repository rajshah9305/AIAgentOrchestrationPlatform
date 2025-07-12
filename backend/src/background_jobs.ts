// lib/jobs/job-queue.ts
import Queue from 'bull'
import Redis from 'ioredis'
import { prisma } from '@/lib/prisma'
import { webhookManager } from '@/lib/webhooks/webhook-manager'
import { getWebSocketManager } from '@/lib/websocket/websocket-server'

// Redis configuration
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

// Job queues
export const executionQueue = new Queue('execution', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
})

export const webhookQueue = new Queue('webhook', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
})

export const cleanupQueue = new Queue('cleanup', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 50,
    attempts: 2
  }
})

export const notificationQueue = new Queue('notification', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3
  }
})

// Job processors
executionQueue.process('schedule_agent_execution', async (job) => {
  const { agentId, userId, configuration, trigger } = job.data
  
  try {
    console.log(`Processing scheduled execution for agent ${agentId}`)
    
    // Import execution engine dynamically to avoid circular dependencies
    const { executionEngine } = await import('@/lib/execution/execution-engine')
    
    const executionId = await executionEngine.executeAgent({
      agentId,
      userId,
      input: {},
      configuration: configuration || {},
      environment: 'production',
      trigger: trigger || 'scheduled'
    })

    console.log(`Scheduled execution started: ${executionId}`)
    return { executionId, status: 'started' }

  } catch (error) {
    console.error('Error in scheduled execution:', error)
    throw error
  }
})

webhookQueue.process('deliver_webhook', async (job) => {
  const { webhookId, event, attempt = 1 } = job.data
  
  try {
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId }
    })

    if (!webhook || !webhook.isActive) {
      console.log(`Webhook ${webhookId} not found or inactive`)
      return { status: 'skipped', reason: 'webhook_inactive' }
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AgentOrchestra-Webhooks/1.0',
        'X-Webhook-Event': event.type,
        'X-Webhook-Attempt': attempt.toString()
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`)
    }

    // Log successful delivery
    await prisma.webhookLog.create({
      data: {
        userId: webhook.userId,
        webhookId,
        eventType: event.type,
        status: 'SUCCESS',
        statusCode: response.status,
        duration: Date.now() - job.timestamp
      }
    })

    return { status: 'delivered', statusCode: response.status }

  } catch (error) {
    console.error('Webhook delivery error:', error)
    
    // Log failed delivery
    if (webhookId) {
      const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } })
      if (webhook) {
        await prisma.webhookLog.create({
          data: {
            userId: webhook.userId,
            webhookId,
            eventType: job.data.event?.type || 'unknown',
            status: 'FAILED',
            error: error instanceof Error ? error.message : 'Unknown error',
            metadata: { attempt }
          }
        })
      }
    }
    
    throw error
  }
})

cleanupQueue.process('cleanup_old_executions', async (job) => {
  const { daysToKeep = 30 } = job.data
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
  
  try {
    // Delete old execution logs first (foreign key constraint)
    const deletedLogs = await prisma.executionLog.deleteMany({
      where: {
        execution: {
          completedAt: {
            lt: cutoffDate
          }
        }
      }
    })

    // Delete old executions
    const deletedExecutions = await prisma.execution.deleteMany({
      where: {
        completedAt: {
          lt: cutoffDate
        },
        status: {
          in: ['COMPLETED', 'FAILED', 'CANCELLED']
        }
      }
    })

    console.log(`Cleanup completed: ${deletedExecutions.count} executions, ${deletedLogs.count} logs deleted`)
    
    return {
      deletedExecutions: deletedExecutions.count,
      deletedLogs: deletedLogs.count,
      cutoffDate
    }

  } catch (error) {
    console.error('Cleanup job error:', error)
    throw error
  }
})

cleanupQueue.process('cleanup_old_logs', async (job) => {
  const { daysToKeep = 7 } = job.data
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
  
  try {
    const deletedAuditLogs = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    })

    const deletedWebhookLogs = await prisma.webhookLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    })

    return {
      deletedAuditLogs: deletedAuditLogs.count,
      deletedWebhookLogs: deletedWebhookLogs.count
    }

  } catch (error) {
    console.error('Log cleanup error:', error)
    throw error
  }
})

notificationQueue.process('send_email', async (job) => {
  const { to, subject, html, userId } = job.data
  
  try {
    // Import email service dynamically
    const { emailService } = await import('@/lib/email/email-service')
    
    await emailService.sendEmail({
      to,
      subject,
      html
    })

    // Log successful email
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'EMAIL_SENT',
        resourceType: 'EMAIL',
        details: { to, subject, status: 'success' }
      }
    })

    return { status: 'sent', to, subject }

  } catch (error) {
    console.error('Email sending error:', error)
    
    // Log failed email
    await prisma.auditLog.create({
      data: {
        userId: userId || 'system',
        action: 'EMAIL_FAILED',
        resourceType: 'EMAIL',
        details: { 
          to, 
          subject, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      }
    })
    
    throw error
  }
})

notificationQueue.process('send_notification', async (job) => {
  const { userId, type, title, message, data } = job.data
  
  try {
    // Save notification to database
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data || {},
        isRead: false
      }
    })

    // Send real-time notification via WebSocket
    const wsManager = getWebSocketManager()
    if (wsManager) {
      wsManager.notifyUser(userId, {
        id: notification.id,
        type,
        title,
        message,
        data,
        createdAt: notification.createdAt
      })
    }

    return { notificationId: notification.id, status: 'sent' }

  } catch (error) {
    console.error('Notification sending error:', error)
    throw error
  }
})

// Job scheduling functions
export class JobScheduler {
  static async scheduleAgentExecution(
    agentId: string, 
    userId: string, 
    scheduleTime: Date, 
    configuration?: any
  ): Promise<string> {
    const job = await executionQueue.add(
      'schedule_agent_execution',
      {
        agentId,
        userId,
        configuration,
        trigger: 'scheduled'
      },
      {
        delay: scheduleTime.getTime() - Date.now(),
        jobId: `scheduled-${agentId}-${scheduleTime.getTime()}`
      }
    )

    return job.id.toString()
  }

  static async scheduleRecurringExecution(
    agentId: string,
    userId: string,
    cronPattern: string,
    configuration?: any
  ): Promise<string> {
    const job = await executionQueue.add(
      'schedule_agent_execution',
      {
        agentId,
        userId,
        configuration,
        trigger: 'recurring'
      },
      {
        repeat: { cron: cronPattern },
        jobId: `recurring-${agentId}`
      }
    )

    return job.id.toString()
  }

  static async cancelScheduledExecution(jobId: string): Promise<boolean> {
    try {
      const job = await executionQueue.getJob(jobId)
      if (job) {
        await job.remove()
        return true
      }
      return false
    } catch (error) {
      console.error('Error cancelling scheduled execution:', error)
      return false
    }
  }

  static async sendWebhook(webhookId: string, event: any, delay = 0): Promise<void> {
    await webhookQueue.add(
      'deliver_webhook',
      { webhookId, event },
      { delay }
    )
  }

  static async sendEmail(
    to: string,
    subject: string,
    html: string,
    userId: string,
    delay = 0
  ): Promise<void> {
    await notificationQueue.add(
      'send_email',
      { to, subject, html, userId },
      { delay }
    )
  }

  static async sendNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: any,
    delay = 0
  ): Promise<void> {
    await notificationQueue.add(
      'send_notification',
      { userId, type, title, message, data },
      { delay }
    )
  }

  static async scheduleCleanup(): Promise<void> {
    // Schedule daily cleanup at 2 AM
    await cleanupQueue.add(
      'cleanup_old_executions',
      { daysToKeep: 30 },
      {
        repeat: { cron: '0 2 * * *' },
        jobId: 'daily-execution-cleanup'
      }
    )

    // Schedule weekly log cleanup
    await cleanupQueue.add(
      'cleanup_old_logs',
      { daysToKeep: 7 },
      {
        repeat: { cron: '0 3 * * 0' },
        jobId: 'weekly-log-cleanup'
      }
    )
  }

  static async getQueueStats() {
    const [
      executionStats,
      webhookStats,
      cleanupStats,
      notificationStats
    ] = await Promise.all([
      this.getQueueInfo(executionQueue),
      this.getQueueInfo(webhookQueue),
      this.getQueueInfo(cleanupQueue),
      this.getQueueInfo(notificationQueue)
    ])

    return {
      execution: executionStats,
      webhook: webhookStats,
      cleanup: cleanupStats,
      notification: notificationStats
    }
  }

  private static async getQueueInfo(queue: Queue.Queue) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed()
    ])

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length
    }
  }
}

// Queue monitoring and health checks
export class QueueMonitor {
  static async getHealth() {
    try {
      const stats = await JobScheduler.getQueueStats()
      const redisConnected = await this.checkRedisConnection()
      
      const totalActive = Object.values(stats).reduce((sum, queue) => sum + queue.active, 0)
      const totalFailed = Object.values(stats).reduce((sum, queue) => sum + queue.failed, 0)
      
      const health = {
        status: redisConnected && totalFailed < 10 ? 'healthy' : 'degraded',
        redis: redisConnected,
        queues: stats,
        summary: {
          totalActive,
          totalFailed
        }
      }

      return health
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private static async checkRedisConnection(): Promise<boolean> {
    try {
      await redis.ping()
      return true
    } catch (error) {
      return false
    }
  }
}

// Initialize scheduled jobs
export async function initializeScheduledJobs() {
  console.log('Initializing scheduled jobs...')
  
  try {
    // Schedule cleanup jobs
    await JobScheduler.scheduleCleanup()
    
    // Schedule health check reporting
    await notificationQueue.add(
      'health_check',
      {},
      {
        repeat: { cron: '*/15 * * * *' }, // Every 15 minutes
        jobId: 'health-check-report'
      }
    )

    console.log('Scheduled jobs initialized successfully')
  } catch (error) {
    console.error('Error initializing scheduled jobs:', error)
  }
}

// Graceful shutdown
export async function shutdownQueues() {
  console.log('Shutting down job queues...')
  
  await Promise.all([
    executionQueue.close(),
    webhookQueue.close(),
    cleanupQueue.close(),
    notificationQueue.close()
  ])
  
  await redis.disconnect()
  console.log('Job queues shut down successfully')
}