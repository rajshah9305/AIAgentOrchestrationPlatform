// app/api/agents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  framework: z.enum([
    'autogen', 'metagpt', 'crewai', 'autogpt', 'babyagi', 
    'langgraph', 'camelai', 'agentverse', 'openagents', 'miniagi', 'orca',
    'cerebras', 'cerebras-autogen'
  ]),
  description: z.string().optional(),
  configuration: z.record(z.any()),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().default(true)
})

// GET /api/agents - List all agents for user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const framework = searchParams.get('framework')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const where = {
      userId: session.user.id,
      ...(framework && { framework }),
      ...(status && { status })
    }

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          executions: {
            take: 1,
            orderBy: { createdAt: 'desc' }
          },
          _count: {
            select: { executions: true }
          }
        }
      }),
      prisma.agent.count({ where })
    ])

    return NextResponse.json({
      agents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching agents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/agents - Create new agent
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createAgentSchema.parse(body)

    const agent = await prisma.agent.create({
      data: {
        ...data,
        userId: session.user.id,
        status: 'idle'
      },
      include: {
        _count: {
          select: { executions: true }
        }
      }
    })

    // Log agent creation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'AGENT_CREATED',
        resourceType: 'AGENT',
        resourceId: agent.id,
        details: { agentName: agent.name, framework: agent.framework }
      }
    })

    return NextResponse.json(agent, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('Error creating agent:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// app/api/agents/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agent = await prisma.agent.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      },
      include: {
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: { executions: true }
        }
      }
    })

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json(agent)
  } catch (error) {
    console.error('Error fetching agent:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/agents/[id] - Update agent
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
    const data = createAgentSchema.partial().parse(body)

    const agent = await prisma.agent.updateMany({
      where: {
        id: params.id,
        userId: session.user.id
      },
      data
    })

    if (agent.count === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const updatedAgent = await prisma.agent.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { executions: true }
        }
      }
    })

    // Log agent update
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'AGENT_UPDATED',
        resourceType: 'AGENT',
        resourceId: params.id,
        details: { changes: data }
      }
    })

    return NextResponse.json(updatedAgent)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('Error updating agent:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/agents/[id] - Delete agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agent = await prisma.agent.deleteMany({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (agent.count === 0) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Log agent deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'AGENT_DELETED',
        resourceType: 'AGENT',
        resourceId: params.id,
        details: {}
      }
    })

    return NextResponse.json({ message: 'Agent deleted successfully' })
  } catch (error) {
    console.error('Error deleting agent:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}