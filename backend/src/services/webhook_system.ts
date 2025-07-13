import { prisma } from '../lib/prisma'
import { addWebhookJob } from './background_jobs'

export const setupWebhooks = () => {
  console.log('✅ Webhook system initialized')
}

// Webhook event types
export type WebhookEventType = 
  | 'execution_started'
  | 'execution_completed'
  | 'execution_failed'
  | 'agent_created'
  | 'agent_updated'
  | 'agent_deleted'
  | 'system_alert'

// Webhook event interface
export interface WebhookEvent {
  type: WebhookEventType
  data: any
  timestamp: Date
  source: string
}

// Register a new webhook
export const registerWebhook = async (userId: string, url: string, events: string[], secret?: string) => {
  try {
    const webhook = await prisma.webhook.create({
      data: {
        userId,
        url,
        events,
        secret: secret || generateSecret(),
        isActive: true
      }
    })

    return {
      success: true,
      webhookId: webhook.id,
      message: 'Webhook registered successfully'
    }
  } catch (error) {
    console.error('Failed to register webhook:', error)
    return {
      success: false,
      error: 'Failed to register webhook'
    }
  }
}

// Trigger webhook event
export const triggerWebhook = async (eventType: WebhookEventType, data: any, userId?: string) => {
  try {
    // Find active webhooks for this event type
    const webhooks = await prisma.webhook.findMany({
      where: {
        events: {
          has: eventType
        },
        isActive: true,
        ...(userId && { userId })
      }
    })

    // Queue webhook deliveries
    const promises = webhooks.map(webhook => 
      addWebhookJob({
        webhookId: webhook.id,
        event: eventType,
        data: {
          ...data,
          webhookId: webhook.id,
          timestamp: new Date().toISOString()
        }
      })
    )

    await Promise.all(promises)

    return {
      success: true,
      webhooksTriggered: webhooks.length
    }
  } catch (error) {
    console.error('Failed to trigger webhook:', error)
    return {
      success: false,
      error: 'Failed to trigger webhook'
    }
  }
}

// Get user's webhooks
export const getUserWebhooks = async (userId: string) => {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    return {
      success: true,
      webhooks
    }
  } catch (error) {
    console.error('Failed to get user webhooks:', error)
    return {
      success: false,
      error: 'Failed to get webhooks'
    }
  }
}

// Update webhook
export const updateWebhook = async (webhookId: string, userId: string, updates: any) => {
  try {
    const webhook = await prisma.webhook.update({
      where: {
        id: webhookId,
        userId
      },
      data: updates
    })

    return {
      success: true,
      webhook
    }
  } catch (error) {
    console.error('Failed to update webhook:', error)
    return {
      success: false,
      error: 'Failed to update webhook'
    }
  }
}

// Delete webhook
export const deleteWebhook = async (webhookId: string, userId: string) => {
  try {
    await prisma.webhook.delete({
      where: {
        id: webhookId,
        userId
      }
    })

    return {
      success: true,
      message: 'Webhook deleted successfully'
    }
  } catch (error) {
    console.error('Failed to delete webhook:', error)
    return {
      success: false,
      error: 'Failed to delete webhook'
    }
  }
}

// Get webhook logs
export const getWebhookLogs = async (webhookId: string, userId: string, limit = 50) => {
  try {
    // Verify webhook belongs to user
    const webhook = await prisma.webhook.findFirst({
      where: { id: webhookId, userId }
    })

    if (!webhook) {
      return {
        success: false,
        error: 'Webhook not found'
      }
    }

    const logs = await prisma.webhookLog.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return {
      success: true,
      logs
    }
  } catch (error) {
    console.error('Failed to get webhook logs:', error)
    return {
      success: false,
      error: 'Failed to get webhook logs'
    }
  }
}

// Test webhook
export const testWebhook = async (webhookId: string, userId: string) => {
  try {
    const webhook = await prisma.webhook.findFirst({
      where: { id: webhookId, userId }
    })

    if (!webhook) {
      return {
        success: false,
        error: 'Webhook not found'
      }
    }

    // Send test event
    const testData = {
      message: 'This is a test webhook event',
      timestamp: new Date().toISOString(),
      test: true
    }

    await addWebhookJob({
      webhookId: webhook.id,
      event: 'test',
      data: testData
    })

    return {
      success: true,
      message: 'Test webhook queued successfully'
    }
  } catch (error) {
    console.error('Failed to test webhook:', error)
    return {
      success: false,
      error: 'Failed to test webhook'
    }
  }
}

// Generate webhook secret
function generateSecret(): string {
  const crypto = require('crypto')
  return crypto.randomBytes(32).toString('hex')
}

// Verify webhook signature
export const verifyWebhookSignature = (payload: string, signature: string, secret: string): boolean => {
  try {
    const crypto = require('crypto')
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    const expectedSignature = hmac.digest('hex')
    return signature === expectedSignature
  } catch (error) {
    return false
  }
}