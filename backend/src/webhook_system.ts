// lib/webhooks/webhook-manager.ts
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { z } from 'zod'

export interface WebhookEvent {
  id: string
  type: string
  data: any
  timestamp: Date
  source: string
}

export interface WebhookEndpoint {
  id: string
  url: string
  events: string[]
  secret: string
  isActive: boolean
  userId: string
}

const webhookEventSchema = z.object({
  type: z.enum([
    'agent.created',
    'agent.updated',
    'agent.deleted',
    'execution.started',
    'execution.completed',
    'execution.failed',
    'execution.cancelled',
    'configuration.saved',
    'user.login'
  ]),
  data: z.record(z.any()),
  agentId: z.string().optional(),
  executionId: z.string().optional()
})

export class WebhookManager {
  private static instance: WebhookManager
  private deliveryQueue: WebhookEvent[] = []
  private isProcessing = false

  static getInstance(): WebhookManager {
    if (!WebhookManager.instance) {
      WebhookManager.instance = new WebhookManager()
    }
    return WebhookManager.instance
  }

  async registerWebhook(userId: string, url: string, events: string[], secret?: string): Promise<string> {
    const webhookSecret = secret || this.generateSecret()
    
    const webhook = await prisma.webhook.create({
      data: {
        userId,
        url,
        events,
        secret: webhookSecret,
        isActive: true
      }
    })

    return webhook.id
  }

  async updateWebhook(webhookId: string, userId: string, updates: Partial<WebhookEndpoint>): Promise<boolean> {
    const result = await prisma.webhook.updateMany({
      where: {
        id: webhookId,
        userId
      },
      data: updates
    })

    return result.count > 0
  }

  async deleteWebhook(webhookId: string, userId: string): Promise<boolean> {
    const result = await prisma.webhook.deleteMany({
      where: {
        id: webhookId,
        userId
      }
    })

    return result.count > 0
  }

  async getUserWebhooks(userId: string): Promise<WebhookEndpoint[]> {
    return prisma.webhook.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })
  }

  async triggerWebhook(eventType: string, data: any, userId: string, metadata?: any): Promise<void> {
    try {
      // Validate event data
      const validatedEvent = webhookEventSchema.parse({
        type: eventType,
        data,
        ...metadata
      })

      // Find webhooks subscribed to this event type
      const webhooks = await prisma.webhook.findMany({
        where: {
          userId,
          isActive: true,
          events: {
            has: eventType
          }
        }
      })

      if (webhooks.length === 0) {
        return
      }

      // Create webhook event
      const webhookEvent: WebhookEvent = {
        id: crypto.randomUUID(),
        type: eventType,
        data: validatedEvent.data,
        timestamp: new Date(),
        source: 'agentorchestra'
      }

      // Queue delivery for each webhook
      for (const webhook of webhooks) {
        await this.queueWebhookDelivery(webhook, webhookEvent)
      }

    } catch (error) {
      console.error('Error triggering webhook:', error)
      
      // Log webhook error
      await prisma.webhookLog.create({
        data: {
          userId,
          eventType,
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
          metadata: { originalData: data }
        }
      })
    }
  }

  private async queueWebhookDelivery(webhook: WebhookEndpoint, event: WebhookEvent): Promise<void> {
    try {
      const delivery = await prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          eventId: event.id,
          eventType: event.type,
          payload: event,
          status: 'PENDING',
          attemptCount: 0,
          scheduledAt: new Date()
        }
      })

      // Add to processing queue
      this.deliveryQueue.push(event)
      this.processDeliveryQueue()

    } catch (error) {
      console.error('Error queueing webhook delivery:', error)
    }
  }

  private async processDeliveryQueue(): Promise<void> {
    if (this.isProcessing || this.deliveryQueue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      // Process pending deliveries from database
      const pendingDeliveries = await prisma.webhookDelivery.findMany({
        where: {
          status: { in: ['PENDING', 'RETRY'] },
          scheduledAt: { lte: new Date() }
        },
        include: {
          webhook: true
        },
        take: 50,
        orderBy: { scheduledAt: 'asc' }
      })

      for (const delivery of pendingDeliveries) {
        await this.processWebhookDelivery(delivery)
      }

    } catch (error) {
      console.error('Error processing webhook delivery queue:', error)
    } finally {
      this.isProcessing = false
      
      // Continue processing if more items were added
      if (this.deliveryQueue.length > 0) {
        setTimeout(() => this.processDeliveryQueue(), 1000)
      }
    }
  }

  private async processWebhookDelivery(delivery: any): Promise<void> {
    const maxAttempts = 5
    const webhook = delivery.webhook

    try {
      // Update attempt count
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attemptCount: { increment: 1 },
          status: 'DELIVERING'
        }
      })

      // Create webhook signature
      const signature = this.createSignature(delivery.payload, webhook.secret)

      // Send webhook
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AgentOrchestra-Webhooks/1.0',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': delivery.eventType,
          'X-Webhook-Delivery': delivery.id
        },
        body: JSON.stringify(delivery.payload),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      if (response.ok) {
        // Delivery successful
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'DELIVERED',
            statusCode: response.status,
            deliveredAt: new Date(),
            responseHeaders: Object.fromEntries(response.headers.entries())
          }
        })

        // Log successful delivery
        await prisma.webhookLog.create({
          data: {
            userId: webhook.userId,
            webhookId: webhook.id,
            deliveryId: delivery.id,
            eventType: delivery.eventType,
            status: 'SUCCESS',
            statusCode: response.status,
            duration: Date.now() - delivery.scheduledAt.getTime()
          }
        })

      } else {
        // Delivery failed
        await this.handleDeliveryFailure(delivery, response.status, await response.text())
      }

    } catch (error) {
      // Network or other error
      await this.handleDeliveryFailure(delivery, 0, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  private async handleDeliveryFailure(delivery: any, statusCode: number, errorMessage: string): Promise<void> {
    const maxAttempts = 5
    const webhook = delivery.webhook

    if (delivery.attemptCount >= maxAttempts) {
      // Mark as failed permanently
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'FAILED',
          statusCode,
          error: errorMessage,
          failedAt: new Date()
        }
      })

      // Disable webhook if too many failures
      const recentFailures = await prisma.webhookDelivery.count({
        where: {
          webhookId: webhook.id,
          status: 'FAILED',
          failedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })

      if (recentFailures >= 10) {
        await prisma.webhook.update({
          where: { id: webhook.id },
          data: { isActive: false }
        })

        // Notify user about webhook being disabled
        // This could trigger an email notification
      }

    } else {
      // Schedule retry with exponential backoff
      const retryDelay = Math.pow(2, delivery.attemptCount) * 1000 // 2s, 4s, 8s, 16s, 32s
      const scheduledAt = new Date(Date.now() + retryDelay)

      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'RETRY',
          statusCode,
          error: errorMessage,
          scheduledAt
        }
      })
    }

    // Log failed delivery
    await prisma.webhookLog.create({
      data: {
        userId: webhook.userId,
        webhookId: webhook.id,
        deliveryId: delivery.id,
        eventType: delivery.eventType,
        status: 'FAILED',
        statusCode,
        error: errorMessage,
        metadata: { attemptCount: delivery.attemptCount }
      }
    })
  }

  private createSignature(payload: any, secret: string): string {
    const body = JSON.stringify(payload)
    return crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  async verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  }

  async getWebhookStats(webhookId: string, userId: string): Promise<any> {
    const webhook = await prisma.webhook.findFirst({
      where: { id: webhookId, userId }
    })

    if (!webhook) {
      throw new Error('Webhook not found')
    }

    const [
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      recentDeliveries
    ] = await Promise.all([
      prisma.webhookDelivery.count({
        where: { webhookId }
      }),
      prisma.webhookDelivery.count({
        where: { webhookId, status: 'DELIVERED' }
      }),
      prisma.webhookDelivery.count({
        where: { webhookId, status: 'FAILED' }
      }),
      prisma.webhookDelivery.findMany({
        where: { webhookId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          eventType: true,
          status: true,
          statusCode: true,
          createdAt: true,
          deliveredAt: true
        }
      })
    ])

    const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0

    return {
      webhook,
      stats: {
        totalDeliveries,
        successfulDeliveries,
        failedDeliveries,
        successRate: Math.round(successRate * 100) / 100
      },
      recentDeliveries
    }
  }
}

// Global webhook manager instance
export const webhookManager = WebhookManager.getInstance()

// app/api/webhooks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { webhookManager } from '@/lib/webhooks/webhook-manager'
import { z } from 'zod'

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().optional()
})

// GET /api/webhooks - List user webhooks
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const webhooks = await webhookManager.getUserWebhooks(session.user.id)
    return NextResponse.json({ webhooks })

  } catch (error) {
    console.error('Error fetching webhooks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/webhooks - Create new webhook
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createWebhookSchema.parse(body)

    const webhookId = await webhookManager.registerWebhook(
      session.user.id,
      data.url,
      data.events,
      data.secret
    )

    return NextResponse.json({ 
      id: webhookId,
      message: 'Webhook created successfully' 
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: error.errors 
      }, { status: 400 })
    }

    console.error('Error creating webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// app/api/webhooks/[id]/route.ts
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updates = createWebhookSchema.partial().parse(body)

    const success = await webhookManager.updateWebhook(params.id, session.user.id, updates)
    
    if (!success) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Webhook updated successfully' })

  } catch (error) {
    console.error('Error updating webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const success = await webhookManager.deleteWebhook(params.id, session.user.id)
    
    if (!success) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Webhook deleted successfully' })

  } catch (error) {
    console.error('Error deleting webhook:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// app/api/webhooks/[id]/stats/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stats = await webhookManager.getWebhookStats(params.id, session.user.id)
    return NextResponse.json(stats)

  } catch (error) {
    console.error('Error fetching webhook stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}