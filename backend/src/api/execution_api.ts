// app/api/executions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { executionEngine } from '@/lib/execution/execution-engine'
import { z } from 'zod'

const executeAgentSchema = z.object({
  agentId: z.string().cuid(),
  input: z.any().optional(),
  configuration: z.record(z.any()).optional(),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  trigger: z.enum(['manual', 'scheduled', 'webhook']).default('manual')
})

// POST /api/executions - Start agent execution
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = executeAgentSchema.parse(body)

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: {
        id: data.agentId,
        userId: session.user.id
      }
    })

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (!agent.isActive) {
      return NextResponse.json({ error: 'Agent is not active' }, { status: 400 })
    }

    // Check if agent is already running
    const runningExecution = await prisma.execution.findFirst({
      where: {
        agentId: data.agentId,
        status: { in: ['PENDING', 'RUNNING'] }
      }
    })

    if (runningExecution) {
      return NextResponse.json({ 
        error: 'Agent is already running',
        executionId: runningExecution.id 
      }, { status: 409 })
    }

    // Update agent status
    await prisma.agent.update({
      where: { id: data.agentId },
      data: { status: 'RUNNING' }
    })

    // Start execution
    const executionId = await executionEngine.executeAgent({
      agentId: data.agentId,
      userId: session.user.id,
      input: data.input,
      configuration: data.configuration || {},
      environment: data.environment,
      trigger: data.trigger
    })

    // Log execution start
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'EXECUTION_STARTED',
        resourceType: 'EXECUTION',
        resourceId: executionId,
        details: {
          agentId: data.agentId,
          agentName: agent.name,
          trigger: data.trigger
        }
      }
    })

    return NextResponse.json({
      executionId,
      status: 'started',
      message: 'Agent execution started successfully'
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: error.errors 
      }, { status: 400 })
    }

    console.error('Error starting execution:', error)
    return NextResponse.json({ 
      error: 'Failed to start execution' 
    }, { status: 500 })
  }
}

// GET /api/executions - List executions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where = {
      userId: session.user.id,
      ...(agentId && { agentId }),
      ...(status && { status })
    }

    const [executions, total] = await Promise.all([
      prisma.execution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              framework: true
            }
          },
          logs: {
            take: 5,
            orderBy: { timestamp: 'desc' }
          }
        }
      }),
      prisma.execution.count({ where })
    ])

    return NextResponse.json({
      executions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching executions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// app/api/executions/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const execution = await prisma.execution.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            framework: true,
            configuration: true
          }
        },
        logs: {
          orderBy: { timestamp: 'asc' }
        }
      }
    })

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
    }

    return NextResponse.json(execution)

  } catch (error) {
    console.error('Error fetching execution:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/executions/[id] - Cancel execution
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify execution ownership
    const execution = await prisma.execution.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      },
      include: {
        agent: true
      }
    })

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
    }

    if (!['PENDING', 'RUNNING'].includes(execution.status)) {
      return NextResponse.json({ 
        error: 'Cannot cancel execution in current status' 
      }, { status: 400 })
    }

    // Cancel execution
    const cancelled = await executionEngine.cancelExecution(params.id)
    
    if (!cancelled) {
      return NextResponse.json({ 
        error: 'Failed to cancel execution' 
      }, { status: 500 })
    }

    // Update agent status
    await prisma.agent.update({
      where: { id: execution.agentId },
      data: { status: 'IDLE' }
    })

    // Log cancellation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'EXECUTION_CANCELLED',
        resourceType: 'EXECUTION',
        resourceId: params.id,
        details: {
          agentId: execution.agentId,
          agentName: execution.agent.name
        }
      }
    })

    return NextResponse.json({ 
      message: 'Execution cancelled successfully' 
    })

  } catch (error) {
    console.error('Error cancelling execution:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// app/api/executions/[id]/logs/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Verify execution ownership
    const execution = await prisma.execution.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
    }

    const where = {
      executionId: params.id,
      ...(level && { level })
    }

    const [logs, total] = await Promise.all([
      prisma.executionLog.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { timestamp: 'asc' }
      }),
      prisma.executionLog.count({ where })
    ])

    return NextResponse.json({
      logs,
      pagination: {
        offset,
        limit,
        total,
        hasMore: offset + logs.length < total
      }
    })

  } catch (error) {
    console.error('Error fetching execution logs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// app/api/executions/[id]/stream/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Verify execution ownership
  const execution = await prisma.execution.findFirst({
    where: {
      id: params.id,
      userId: session.user.id
    }
  })

  if (!execution) {
    return new Response('Execution not found', { status: 404 })
  }

  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial execution status
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({
          type: 'status',
          execution
        })}\n\n`)
      )

      // Listen for execution events
      const handleLog = (event: any) => {
        if (event.executionId === params.id) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'log',
              data: event.log
            })}\n\n`)
          )
        }
      }

      const handleProgress = (event: any) => {
        if (event.executionId === params.id) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              data: { progress: event.progress }
            })}\n\n`)
          )
        }
      }

      const handleCompleted = (event: any) => {
        if (event.executionId === params.id) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'completed',
              data: event.result
            })}\n\n`)
          )
          controller.close()
        }
      }

      const handleFailed = (event: any) => {
        if (event.executionId === params.id) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'failed',
              data: { error: event.error }
            })}\n\n`)
          )
          controller.close()
        }
      }

      // Register event listeners
      executionEngine.on('log', handleLog)
      executionEngine.on('progress', handleProgress)
      executionEngine.on('completed', handleCompleted)
      executionEngine.on('failed', handleFailed)

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        executionEngine.off('log', handleLog)
        executionEngine.off('progress', handleProgress)
        executionEngine.off('completed', handleCompleted)
        executionEngine.off('failed', handleFailed)
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

// app/api/executions/bulk/route.ts
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, executionIds } = await request.json()

    if (!Array.isArray(executionIds) || executionIds.length === 0) {
      return NextResponse.json({ error: 'Invalid execution IDs' }, { status: 400 })
    }

    // Verify ownership of all executions
    const executions = await prisma.execution.findMany({
      where: {
        id: { in: executionIds },
        userId: session.user.id
      }
    })

    if (executions.length !== executionIds.length) {
      return NextResponse.json({ error: 'Some executions not found' }, { status: 404 })
    }

    let results = []

    switch (action) {
      case 'cancel':
        for (const execution of executions) {
          if (['PENDING', 'RUNNING'].includes(execution.status)) {
            const cancelled = await executionEngine.cancelExecution(execution.id)
            results.push({ id: execution.id, success: cancelled })
          } else {
            results.push({ id: execution.id, success: false, reason: 'Cannot cancel' })
          }
        }
        break

      case 'retry':
        for (const execution of executions) {
          if (['FAILED', 'CANCELLED'].includes(execution.status)) {
            try {
              const newExecutionId = await executionEngine.executeAgent({
                agentId: execution.agentId,
                userId: session.user.id,
                input: execution.input,
                configuration: {},
                environment: execution.environment || 'development',
                trigger: 'manual'
              })
              results.push({ id: execution.id, success: true, newExecutionId })
            } catch (error) {
              results.push({ id: execution.id, success: false, reason: error.message })
            }
          } else {
            results.push({ id: execution.id, success: false, reason: 'Cannot retry' })
          }
        }
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ results })

  } catch (error) {
    console.error('Error in bulk execution operation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}