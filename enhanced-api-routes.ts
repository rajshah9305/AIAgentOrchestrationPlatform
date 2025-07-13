// backend/src/api/agents/schema.ts
import { z } from 'zod';

export const agentFrameworks = [
  'autogen', 'metagpt', 'crewai', 'autogpt', 'babyagi',
  'langgraph', 'camelai', 'agentverse', 'openagents',
  'miniagi', 'orca', 'cerebras', 'cerebras-autogen'
] as const;

export const createAgentSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).trim(),
    description: z.string().max(500).optional(),
    framework: z.enum(agentFrameworks),
    configuration: z.record(z.any()).refine(
      (config) => {
        const size = JSON.stringify(config).length;
        return size <= 100000; // 100KB limit
      },
      { message: 'Configuration too large (max 100KB)' }
    ),
    tags: z.array(z.string().max(50)).max(10).optional(),
    isPublic: z.boolean().default(false),
  }),
});

export const updateAgentSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).trim().optional(),
    description: z.string().max(500).optional(),
    configuration: z.record(z.any()).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    isPublic: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const listAgentsSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('10'),
    framework: z.enum(agentFrameworks).optional(),
    search: z.string().max(100).optional(),
    tags: z.string().transform(val => val.split(',')).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'executions']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
});

// backend/src/api/agents/routes.ts
import { Router } from 'express';
import { prisma } from '../../lib/database';
import { redis } from '../../lib/redis';
import { logger } from '../../lib/logger';
import { validate } from '../../middleware/validation';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/error-handler';
import {
  createAgentSchema,
  updateAgentSchema,
  listAgentsSchema,
} from './schema';

const router = Router();

// List agents with pagination and filtering
router.get('/',
  validate(listAgentsSchema),
  async (req: AuthRequest, res) => {
    const { page, limit, framework, search, tags, sortBy, order } = req.query as any;
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {
      userId: req.user!.id,
      isActive: true,
    };

    if (framework) {
      where.framework = framework;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    // Check cache
    const cacheKey = `agents:${req.user!.id}:${JSON.stringify({ where, sortBy, order, page, limit })}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Fetch from database
    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        orderBy: { [sortBy]: order },
        skip: offset,
        take: limit,
        include: {
          _count: {
            select: { executions: true },
          },
        },
      }),
      prisma.agent.count({ where }),
    ]);

    const response = {
      agents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(response), 300);

    res.json(response);
  }
);

// Get single agent
router.get('/:id',
  async (req: AuthRequest, res) => {
    const { id } = req.params;

    const agent = await prisma.agent.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
      include: {
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            createdAt: true,
            completedAt: true,
          },
        },
        _count: {
          select: { executions: true },
        },
      },
    });

    if (!agent) {
      throw new AppError(404, 'Agent not found');
    }

    res.json(agent);
  }
);

// Create agent
router.post('/',
  validate(createAgentSchema),
  async (req: AuthRequest, res) => {
    const data = req.body;

    // Check agent limit
    const agentCount = await prisma.agent.count({
      where: { userId: req.user!.id },
    });

    if (agentCount >= 50) {
      throw new AppError(400, 'Agent limit reached (max 50)');
    }

    const agent = await prisma.agent.create({
      data: {
        ...data,
        userId: req.user!.id,
      },
    });

    // Clear cache
    await redis.del(`agents:${req.user!.id}:*`);

    // Log creation
    logger.info('Agent created', {
      agentId: agent.id,
      userId: req.user!.id,
      framework: agent.framework,
    });

    res.status(201).json(agent);
  }
);

// Update agent
router.put('/:id',
  validate(updateAgentSchema),
  async (req: AuthRequest, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const existing = await prisma.agent.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!existing) {
      throw new AppError(404, 'Agent not found');
    }

    const agent = await prisma.agent.update({
      where: { id },
      data: updates,
    });

    // Clear cache
    await redis.del(`agents:${req.user!.id}:*`);

    res.json(agent);
  }
);

// Delete agent
router.delete('/:id',
  async (req: AuthRequest, res) => {
    const { id } = req.params;

    // Verify ownership
    const agent = await prisma.agent.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!agent) {
      throw new AppError(404, 'Agent not found');
    }

    // Soft delete
    await prisma.agent.update({
      where: { id },
      data: { isActive: false },
    });

    // Clear cache
    await redis.del(`agents:${req.user!.id}:*`);

    res.json({ message: 'Agent deleted successfully' });
  }
);

// Clone agent
router.post('/:id/clone',
  async (req: AuthRequest, res) => {
    const { id } = req.params;

    const original = await prisma.agent.findFirst({
      where: {
        id,
        OR: [
          { userId: req.user!.id },
          { isPublic: true },
        ],
      },
    });

    if (!original) {
      throw new AppError(404, 'Agent not found');
    }

    const cloned = await prisma.agent.create({
      data: {
        name: `${original.name} (Copy)`,
        description: original.description,
        framework: original.framework,
        configuration: original.configuration,
        tags: original.tags,
        userId: req.user!.id,
      },
    });

    res.status(201).json(cloned);
  }
);

export { router as agentsRouter };

// backend/src/api/executions/schema.ts
import { z } from 'zod';

export const startExecutionSchema = z.object({
  body: z.object({
    agentId: z.string().uuid(),
    input: z.any(),
    webhookUrl: z.string().url().optional(),
    timeout: z.number().min(1000).max(300000).default(60000),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
  }),
});

export const listExecutionsSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('10'),
    agentId: z.string().uuid().optional(),
    status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

// backend/src/api/executions/routes.ts
import { Router } from 'express';
import { prisma } from '../../lib/database';
import { redis } from '../../lib/redis';
import { logger } from '../../lib/logger';
import { validate } from '../../middleware/validation';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/error-handler';
import { executeAgent } from '../../services/execution-engine';
import {
  startExecutionSchema,
  listExecutionsSchema,
} from './schema';

const router = Router();

// List executions
router.get('/',
  validate(listExecutionsSchema),
  async (req: AuthRequest, res) => {
    const { page, limit, agentId, status, startDate, endDate } = req.query as any;
    const offset = (page - 1) * limit;

    const where: any = {
      userId: req.user!.id,
    };

    if (agentId) {
      where.agentId = agentId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [executions, total] = await Promise.all([
      prisma.execution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          agent: {
            select: { id: true, name: true, framework: true },
          },
        },
      }),
      prisma.execution.count({ where }),
    ]);

    res.json({
      executions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  }
);

// Get execution details
router.get('/:id',
  async (req: AuthRequest, res) => {
    const { id } = req.params;

    const execution = await prisma.execution.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
      include: {
        agent: true,
        logs: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!execution) {
      throw new AppError(404, 'Execution not found');
    }

    res.json(execution);
  }
);

// Start execution
router.post('/',
  validate(startExecutionSchema),
  async (req: AuthRequest, res) => {
    const { agentId, input, webhookUrl, timeout, priority } = req.body;

    // Verify agent ownership
    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        userId: req.user!.id,
        isActive: true,
      },
    });

    if (!agent) {
      throw new AppError(404, 'Agent not found');
    }

    // Check concurrent execution limit
    const runningExecutions = await prisma.execution.count({
      where: {
        userId: req.user!.id,
        status: 'RUNNING',
      },
    });

    if (runningExecutions >= 10) {
      throw new AppError(429, 'Too many concurrent executions (max 10)');
    }

    // Create execution record
    const execution = await prisma.execution.create({
      data: {
        agentId,
        userId: req.user!.id,
        input,
        status: 'PENDING',
        priority,
        metadata: {
          webhookUrl,
          timeout,
        },
      },
    });

    // Queue execution
    await executeAgent(execution.id, agent, input, {
      webhookUrl,
      timeout,
      priority,
    });

    res.status(202).json({
      executionId: execution.id,
      status: 'queued',
      message: 'Execution queued successfully',
    });
  }
);

// Cancel execution
router.post('/:id/cancel',
  async (req: AuthRequest, res) => {
    const { id } = req.params;

    const execution = await prisma.execution.findFirst({
      where: {
        id,
        userId: req.user!.id,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });

    if (!execution) {
      throw new AppError(404, 'Execution not found or already completed');
    }

    await prisma.execution.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });

    // Cancel actual execution job
    const cancelled = await executionEngine.cancelExecution(executionId)
    if (!cancelled) {
      return res.status(500).json({ error: 'Failed to cancel execution' })
    }

    res.json({ message: 'Execution cancelled' });
  }
);

// Get execution logs (streaming)
router.get('/:id/logs',
  async (req: AuthRequest, res) => {
    const { id } = req.params;

    const execution = await prisma.execution.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!execution) {
      throw new AppError(404, 'Execution not found');
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send existing logs
    const logs = await prisma.executionLog.findMany({
      where: { executionId: id },
      orderBy: { timestamp: 'asc' },
    });

    logs.forEach(log => {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    });

    // Subscribe to new logs
    const channel = `execution:${id}:logs`;
    const subscriber = redis.client.duplicate();
    await subscriber.connect();
    await subscriber.subscribe(channel, (message) => {
      res.write(`data: ${message}\n\n`);
    });

    // Clean up on disconnect
    req.on('close', async () => {
      await subscriber.unsubscribe(channel);
      await subscriber.disconnect();
    });
  }
);

export { router as executionsRouter };