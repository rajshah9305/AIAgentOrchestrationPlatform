// app/api/dashboard/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '30d'
    
    const dateRange = getDateRange(timeframe)
    const userId = session.user.id

    // Get current metrics
    const [
      activeAgents,
      totalFrameworks,
      executions,
      savedConfigs,
      recentExecutions,
      frameworkStats,
      executionTrends
    ] = await Promise.all([
      getActiveAgentsCount(userId),
      getFrameworksCount(userId),
      getExecutionsMetrics(userId, dateRange),
      getSavedConfigsCount(userId),
      getRecentExecutions(userId),
      getFrameworkStatistics(userId, dateRange),
      getExecutionTrends(userId, dateRange)
    ])

    return NextResponse.json({
      overview: {
        activeAgents: {
          value: activeAgents.current,
          change: activeAgents.change,
          trend: activeAgents.trend
        },
        frameworks: {
          value: totalFrameworks.current,
          change: totalFrameworks.change
        },
        executions: {
          value: executions.total,
          change: executions.change,
          trend: executions.trend
        },
        savedConfigs: {
          value: savedConfigs.current,
          change: savedConfigs.change
        }
      },
      charts: {
        executionTrends,
        frameworkDistribution: frameworkStats,
        performance: await getPerformanceMetrics(userId, dateRange)
      },
      recentActivity: recentExecutions
    })
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getActiveAgentsCount(userId: string) {
  const now = new Date()
  const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  
  const [current, previous] = await Promise.all([
    prisma.agent.count({
      where: {
        userId,
        isActive: true,
        status: { in: ['IDLE', 'RUNNING'] }
      }
    }),
    prisma.agent.count({
      where: {
        userId,
        isActive: true,
        createdAt: { lt: lastMonth }
      }
    })
  ])

  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0
  
  return {
    current,
    change: Math.round(change),
    trend: change >= 0 ? 'up' : 'down'
  }
}

async function getFrameworksCount(userId: string) {
  const [current, previous] = await Promise.all([
    prisma.agent.groupBy({
      by: ['framework'],
      where: { userId, isActive: true },
      _count: true
    }),
    prisma.agent.groupBy({
      by: ['framework'],
      where: {
        userId,
        createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      _count: true
    })
  ])

  return {
    current: current.length,
    change: current.length - previous.length
  }
}

async function getExecutionsMetrics(userId: string, dateRange: { start: Date; end: Date }) {
  const [currentPeriod, previousPeriod] = await Promise.all([
    prisma.execution.count({
      where: {
        userId,
        startedAt: {
          gte: dateRange.start,
          lte: dateRange.end
        }
      }
    }),
    prisma.execution.count({
      where: {
        userId,
        startedAt: {
          gte: new Date(dateRange.start.getTime() - (dateRange.end.getTime() - dateRange.start.getTime())),
          lt: dateRange.start
        }
      }
    })
  ])

  const change = previousPeriod > 0 ? ((currentPeriod - previousPeriod) / previousPeriod) * 100 : 0
  
  return {
    total: currentPeriod,
    change: Math.round(change),
    trend: change >= 0 ? 'up' : 'down'
  }
}

async function getSavedConfigsCount(userId: string) {
  const [current, previous] = await Promise.all([
    prisma.savedConfiguration.count({
      where: { userId }
    }),
    prisma.savedConfiguration.count({
      where: {
        userId,
        createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    })
  ])

  return {
    current,
    change: current - previous
  }
}

async function getRecentExecutions(userId: string, limit = 10) {
  return prisma.execution.findMany({
    where: { userId },
    take: limit,
    orderBy: { startedAt: 'desc' },
    include: {
      agent: {
        select: { name: true, framework: true }
      }
    }
  })
}

async function getFrameworkStatistics(userId: string, dateRange: { start: Date; end: Date }) {
  const stats = await prisma.execution.groupBy({
    by: ['agent'],
    where: {
      userId,
      startedAt: {
        gte: dateRange.start,
        lte: dateRange.end
      }
    },
    _count: true,
    _avg: {
      duration: true
    }
  })

  // Get agent details with framework info
  const agentIds = stats.map(s => s.agent)
  const agents = await prisma.agent.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, framework: true, name: true }
  })

  const frameworkStats = new Map()
  
  stats.forEach(stat => {
    const agent = agents.find(a => a.id === stat.agent)
    if (agent) {
      const framework = agent.framework
      if (!frameworkStats.has(framework)) {
        frameworkStats.set(framework, {
          framework,
          executions: 0,
          avgDuration: 0,
          agents: new Set()
        })
      }
      
      const current = frameworkStats.get(framework)
      current.executions += stat._count
      current.avgDuration = (current.avgDuration + (stat._avg.duration || 0)) / 2
      current.agents.add(agent.id)
    }
  })

  return Array.from(frameworkStats.values()).map(stat => ({
    ...stat,
    agents: stat.agents.size
  }))
}

async function getExecutionTrends(userId: string, dateRange: { start: Date; end: Date }) {
  const trends = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC('day', started_at) as date,
      COUNT(*) as executions,
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as successful,
      COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
      AVG(duration) as avg_duration
    FROM executions 
    WHERE user_id = ${userId}
      AND started_at >= ${dateRange.start}
      AND started_at <= ${dateRange.end}
    GROUP BY DATE_TRUNC('day', started_at)
    ORDER BY date ASC
  `

  return trends
}

async function getPerformanceMetrics(userId: string, dateRange: { start: Date; end: Date }) {
  const metrics = await prisma.execution.aggregate({
    where: {
      userId,
      startedAt: {
        gte: dateRange.start,
        lte: dateRange.end
      },
      status: 'COMPLETED'
    },
    _avg: {
      duration: true,
      tokensUsed: true,
      cost: true
    },
    _sum: {
      tokensUsed: true,
      cost: true
    },
    _count: true
  })

  const successRate = await prisma.$queryRaw`
    SELECT 
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::float / COUNT(*)::float * 100 as success_rate
    FROM executions 
    WHERE user_id = ${userId}
      AND started_at >= ${dateRange.start}
      AND started_at <= ${dateRange.end}
  `

  return {
    avgDuration: metrics._avg.duration,
    avgTokensUsed: metrics._avg.tokensUsed,
    avgCost: metrics._avg.cost,
    totalTokens: metrics._sum.tokensUsed,
    totalCost: metrics._sum.cost,
    totalExecutions: metrics._count,
    successRate: successRate[0]?.success_rate || 0
  }
}

function getDateRange(timeframe: string) {
  const now = new Date()
  let start: Date

  switch (timeframe) {
    case '24h':
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      break
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case '90d':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  return { start, end: now }
}

// app/api/dashboard/real-time/route.ts
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Set up Server-Sent Events
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
      )

      // Set up real-time updates
      const interval = setInterval(async () => {
        try {
          const realTimeData = await getRealTimeMetrics(session.user.id)
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'metrics_update',
              data: realTimeData
            })}\n\n`)
          )
        } catch (error) {
          console.error('Error sending real-time update:', error)
        }
      }, 5000) // Update every 5 seconds

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}

async function getRealTimeMetrics(userId: string) {
  const [activeExecutions, queuedExecutions, systemHealth] = await Promise.all([
    prisma.execution.count({
      where: {
        userId,
        status: 'RUNNING'
      }
    }),
    prisma.execution.count({
      where: {
        userId,
        status: 'PENDING'
      }
    }),
    getSystemHealth(userId)
  ])

  return {
    activeExecutions,
    queuedExecutions,
    systemHealth,
    timestamp: new Date().toISOString()
  }
}

async function getSystemHealth(userId: string) {
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  
  const [totalAgents, healthyAgents, recentErrors] = await Promise.all([
    prisma.agent.count({
      where: { userId, isActive: true }
    }),
    prisma.agent.count({
      where: {
        userId,
        isActive: true,
        status: { in: ['IDLE', 'RUNNING'] }
      }
    }),
    prisma.execution.count({
      where: {
        userId,
        status: 'FAILED',
        startedAt: { gte: last24h }
      }
    })
  ])

  const healthScore = totalAgents > 0 ? (healthyAgents / totalAgents) * 100 : 100

  return {
    score: Math.round(healthScore),
    status: healthScore >= 90 ? 'excellent' : healthScore >= 70 ? 'good' : 'needs_attention',
    recentErrors
  }
}