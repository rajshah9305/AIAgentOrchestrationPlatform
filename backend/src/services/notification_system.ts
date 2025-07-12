// lib/email/email-service.ts
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  attachments?: any[]
}

export interface EmailTemplate {
  name: string
  subject: string
  html: string
  variables: string[]
}

class EmailService {
  private transporter: nodemailer.Transporter
  private templates = new Map<string, EmailTemplate>()

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })

    this.loadTemplates()
  }

  private loadTemplates() {
    // Agent execution completed template
    this.templates.set('execution_completed', {
      name: 'execution_completed',
      subject: '✅ Agent {{agentName}} execution completed',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🎉 Execution Completed!</h1>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa;">
            <h2 style="color: #333; margin-top: 0;">Agent: {{agentName}}</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Your agent has successfully completed its execution.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Execution Details</h3>
              <ul style="color: #666;">
                <li><strong>Framework:</strong> {{framework}}</li>
                <li><strong>Duration:</strong> {{duration}}</li>
                <li><strong>Status:</strong> <span style="color: #28a745;">{{status}}</span></li>
                <li><strong>Started:</strong> {{startTime}}</li>
                <li><strong>Completed:</strong> {{endTime}}</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{dashboardUrl}}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Results
              </a>
            </div>
          </div>
          
          <div style="background: #e9ecef; padding: 20px; text-align: center; color: #666; font-size: 14px;">
            <p>This is an automated notification from AgentOrchestra.</p>
            <p><a href="{{unsubscribeUrl}}" style="color: #666;">Unsubscribe from notifications</a></p>
          </div>
        </div>
      `,
      variables: ['agentName', 'framework', 'duration', 'status', 'startTime', 'endTime', 'dashboardUrl', 'unsubscribeUrl']
    })

    // Agent execution failed template
    this.templates.set('execution_failed', {
      name: 'execution_failed',
      subject: '❌ Agent {{agentName}} execution failed',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">⚠️ Execution Failed</h1>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa;">
            <h2 style="color: #333; margin-top: 0;">Agent: {{agentName}}</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Your agent execution encountered an error and was unable to complete.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Error Details</h3>
              <div style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 4px; margin: 15px 0;">
                <strong>Error:</strong> {{errorMessage}}
              </div>
              <ul style="color: #666;">
                <li><strong>Framework:</strong> {{framework}}</li>
                <li><strong>Duration:</strong> {{duration}}</li>
                <li><strong>Failed at:</strong> {{failTime}}</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{logsUrl}}" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
                View Logs
              </a>
              <a href="{{retryUrl}}" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Retry Execution
              </a>
            </div>
          </div>
          
          <div style="background: #e9ecef; padding: 20px; text-align: center; color: #666; font-size: 14px;">
            <p>This is an automated notification from AgentOrchestra.</p>
            <p><a href="{{unsubscribeUrl}}" style="color: #666;">Unsubscribe from notifications</a></p>
          </div>
        </div>
      `,
      variables: ['agentName', 'framework', 'duration', 'errorMessage', 'failTime', 'logsUrl', 'retryUrl', 'unsubscribeUrl']
    })

    // Welcome email template
    this.templates.set('welcome', {
      name: 'welcome',
      subject: '🚀 Welcome to AgentOrchestra!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">Welcome to AgentOrchestra! 🎉</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Your AI Agent Orchestration Platform</p>
          </div>
          
          <div style="padding: 40px; background: #f8f9fa;">
            <h2 style="color: #333; margin-top: 0;">Hi {{userName}}!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Thank you for joining AgentOrchestra! You now have access to a powerful platform for orchestrating 
              AI agents across multiple frameworks.
            </p>
            
            <div style="background: white; padding: 25px; border-radius: 8px; margin: 30px 0;">
              <h3 style="color: #333; margin-top: 0;">🚀 Get Started</h3>
              <ul style="color: #666; line-height: 1.8;">
                <li>Create your first AI agent</li>
                <li>Choose from 11+ AI frameworks</li>
                <li>Monitor executions in real-time</li>
                <li>Set up webhooks for integrations</li>
                <li>Configure scheduled runs</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{{dashboardUrl}}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px;">
                Go to Dashboard
              </a>
            </div>
            
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #1976d2; margin-top: 0;">💡 Pro Tip</h4>
              <p style="color: #666; margin: 0;">
                Start with one of our templates to get familiar with the platform. You can find them in the configuration library!
              </p>
            </div>
          </div>
          
          <div style="background: #e9ecef; padding: 25px; text-align: center; color: #666;">
            <p style="margin: 0 0 10px 0;">Need help? Check out our <a href="{{docsUrl}}" style="color: #667eea;">documentation</a> or contact support.</p>
            <p style="margin: 0; font-size: 14px;">
              <a href="{{unsubscribeUrl}}" style="color: #666;">Manage notification preferences</a>
            </p>
          </div>
        </div>
      `,
      variables: ['userName', 'dashboardUrl', 'docsUrl', 'unsubscribeUrl']
    })
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail({
        from: options.from || process.env.SMTP_FROM || process.env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        attachments: options.attachments
      })

      console.log('Email sent successfully:', info.messageId)
      return true

    } catch (error) {
      console.error('Error sending email:', error)
      return false
    }
  }

  async sendTemplateEmail(
    templateName: string,
    to: string | string[],
    variables: Record<string, string>,
    options?: Partial<EmailOptions>
  ): Promise<boolean> {
    const template = this.templates.get(templateName)
    if (!template) {
      throw new Error(`Template ${templateName} not found`)
    }

    // Replace variables in subject and HTML
    let subject = template.subject
    let html = template.html

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g')
      subject = subject.replace(placeholder, value)
      html = html.replace(placeholder, value)
    }

    return this.sendEmail({
      to,
      subject,
      html,
      ...options
    })
  }

  async sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
    const dashboardUrl = `${process.env.NEXTAUTH_URL}/dashboard`
    const docsUrl = `${process.env.NEXTAUTH_URL}/docs`
    const unsubscribeUrl = `${process.env.NEXTAUTH_URL}/notifications/unsubscribe`

    return this.sendTemplateEmail('welcome', userEmail, {
      userName,
      dashboardUrl,
      docsUrl,
      unsubscribeUrl
    })
  }

  async sendExecutionNotification(
    userEmail: string,
    agentName: string,
    execution: any,
    status: 'completed' | 'failed'
  ): Promise<boolean> {
    const templateName = status === 'completed' ? 'execution_completed' : 'execution_failed'
    const dashboardUrl = `${process.env.NEXTAUTH_URL}/dashboard/executions/${execution.id}`
    const unsubscribeUrl = `${process.env.NEXTAUTH_URL}/notifications/unsubscribe`

    const variables: Record<string, string> = {
      agentName,
      framework: execution.agent?.framework || 'Unknown',
      duration: execution.duration ? `${Math.round(execution.duration / 1000)}s` : 'Unknown',
      status: execution.status,
      startTime: execution.startedAt ? new Date(execution.startedAt).toLocaleString() : 'Unknown',
      dashboardUrl,
      unsubscribeUrl
    }

    if (status === 'completed') {
      variables.endTime = execution.completedAt ? new Date(execution.completedAt).toLocaleString() : 'Unknown'
    } else {
      variables.errorMessage = execution.error || 'Unknown error'
      variables.failTime = execution.completedAt ? new Date(execution.completedAt).toLocaleString() : 'Unknown'
      variables.logsUrl = `${dashboardUrl}/logs`
      variables.retryUrl = `${dashboardUrl}/retry`
    }

    return this.sendTemplateEmail(templateName, userEmail, variables)
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      return true
    } catch (error) {
      console.error('Email service connection failed:', error)
      return false
    }
  }
}

export const emailService = new EmailService()

// lib/notifications/notification-service.ts
import { JobScheduler } from '@/lib/jobs/job-queue'
import { getWebSocketManager } from '@/lib/websocket/websocket-server'

export type NotificationType = 
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_started' 
  | 'agent_created'
  | 'agent_updated'
  | 'system_alert'
  | 'webhook_failed'
  | 'security_alert'

export interface NotificationPreferences {
  userId: string
  email: boolean
  browser: boolean
  webhook: boolean
  types: NotificationType[]
}

export class NotificationService {
  async sendNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: any,
    email?: {
      subject: string
      html: string
    }
  ): Promise<void> {
    try {
      // Get user notification preferences
      const preferences = await this.getUserPreferences(userId)
      
      if (!preferences || !preferences.types.includes(type)) {
        return // User has disabled this notification type
      }

      // Send browser notification
      if (preferences.browser) {
        await JobScheduler.sendNotification(userId, type, title, message, data)
      }

      // Send email notification
      if (preferences.email && email) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true }
        })

        if (user?.email) {
          await JobScheduler.sendEmail(user.email, email.subject, email.html, userId)
        }
      }

      // Trigger webhook if enabled
      if (preferences.webhook) {
        await this.triggerWebhookNotification(userId, type, { title, message, data })
      }

    } catch (error) {
      console.error('Error sending notification:', error)
    }
  }

  async sendExecutionNotification(
    userId: string,
    execution: any,
    type: 'started' | 'completed' | 'failed'
  ): Promise<void> {
    const agent = execution.agent
    const notificationType = `execution_${type}` as NotificationType

    let title: string
    let message: string

    switch (type) {
      case 'started':
        title = `🚀 ${agent.name} Started`
        message = `Your ${agent.framework} agent has started execution`
        break
      case 'completed':
        title = `✅ ${agent.name} Completed`
        message = `Your ${agent.framework} agent completed successfully in ${Math.round(execution.duration / 1000)}s`
        break
      case 'failed':
        title = `❌ ${agent.name} Failed`
        message = `Your ${agent.framework} agent failed: ${execution.error}`
        break
    }

    // Send notification
    await this.sendNotification(
      userId,
      notificationType,
      title,
      message,
      {
        agentId: agent.id,
        executionId: execution.id,
        framework: agent.framework
      },
      type !== 'started' ? {
        subject: title,
        html: await this.generateExecutionEmailHtml(execution, type)
      } : undefined
    )
  }

  async sendSystemAlert(
    title: string,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    affectedUsers?: string[]
  ): Promise<void> {
    const users = affectedUsers || await this.getAllActiveUsers()

    for (const userId of users) {
      await this.sendNotification(
        userId,
        'system_alert',
        `🚨 ${title}`,
        message,
        { severity }
      )
    }
  }

  private async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    const preferences = await prisma.notificationPreference.findUnique({
      where: { userId }
    })

    if (!preferences) {
      // Create default preferences
      return await prisma.notificationPreference.create({
        data: {
          userId,
          email: true,
          browser: true,
          webhook: false,
          types: [
            'execution_completed',
            'execution_failed',
            'system_alert'
          ]
        }
      })
    }

    return preferences
  }

  private async triggerWebhookNotification(
    userId: string,
    type: NotificationType,
    data: any
  ): Promise<void> {
    // Import dynamically to avoid circular dependency
    const { webhookManager } = await import('@/lib/webhooks/webhook-manager')
    
    await webhookManager.triggerWebhook(
      `notification.${type}`,
      data,
      userId
    )
  }

  private async generateExecutionEmailHtml(execution: any, type: string): Promise<string> {
    // Generate HTML email content based on execution data and type
    const user = await prisma.user.findUnique({
      where: { id: execution.userId },
      select: { email: true, name: true }
    })

    if (type === 'completed') {
      return await emailService.sendExecutionNotification(
        user!.email,
        execution.agent.name,
        execution,
        'completed'
      ) ? 'sent' : 'failed'
    } else {
      return await emailService.sendExecutionNotification(
        user!.email,
        execution.agent.name,
        execution,
        'failed'
      ) ? 'sent' : 'failed'
    }
  }

  private async getAllActiveUsers(): Promise<string[]> {
    const users = await prisma.user.findMany({
      where: {
        lastLoginAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Active in last 30 days
        }
      },
      select: { id: true }
    })

    return users.map(user => user.id)
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    return await prisma.notificationPreference.upsert({
      where: { userId },
      update: preferences,
      create: {
        userId,
        email: true,
        browser: true,
        webhook: false,
        types: [
          'execution_completed',
          'execution_failed',
          'system_alert'
        ],
        ...preferences
      }
    })
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId
      },
      data: { isRead: true }
    })

    return result.count > 0
  }

  async markAllNotificationsAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: { isRead: true }
    })

    return result.count
  }

  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false
  ): Promise<{ notifications: any[], total: number, unread: number }> {
    const skip = (page - 1) * limit
    
    const where = {
      userId,
      ...(unreadOnly && { isRead: false })
    }

    const [notifications, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId, isRead: false }
      })
    ])

    return { notifications, total, unread }
  }
}

export const notificationService = new NotificationService()