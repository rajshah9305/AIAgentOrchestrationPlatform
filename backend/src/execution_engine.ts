// lib/execution/execution-engine.ts
import { prisma } from '@/lib/prisma'
import { AgentFramework } from './frameworks'
import { AutoGenExecutor } from './frameworks/autogen'
import { CrewAIExecutor } from './frameworks/crewai'
import { AutoGPTExecutor } from './frameworks/autogpt'
import { BabyAGIExecutor } from './frameworks/babyagi'
import { LangGraphExecutor } from './frameworks/langgraph'
import { CerebrasPoweredExecutor } from './frameworks/cerebras-powered'
import { CerebrasAutoGenExecutor } from './frameworks/cerebras-autogen'
import { EventEmitter } from 'events'

export interface ExecutionContext {
  agentId: string
  userId: string
  input: any
  configuration: any
  environment: string
  trigger: string
}

export interface ExecutionResult {
  success: boolean
  output?: any
  error?: string
  duration: number
  tokensUsed?: number
  cost?: number
  logs: ExecutionLog[]
}

export interface ExecutionLog {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
  message: string
  timestamp: Date
  metadata?: any
}

export class ExecutionEngine extends EventEmitter {
  private executors = new Map<string, AgentFramework>()
  private activeExecutions = new Map<string, Promise<ExecutionResult>>()

  constructor() {
    super()
    this.initializeExecutors()
  }

  private initializeExecutors() {
    this.executors.set('autogen', new AutoGenExecutor())
    this.executors.set('crewai', new CrewAIExecutor())
    this.executors.set('autogpt', new AutoGPTExecutor())
    this.executors.set('babyagi', new BabyAGIExecutor())
    this.executors.set('langgraph', new LangGraphExecutor())
    
    // Cerebras ultra-fast inference executors
    this.executors.set('cerebras', new CerebrasPoweredExecutor())
    this.executors.set('cerebras-autogen', new CerebrasAutoGenExecutor())
    
    // Add more framework executors...
  }

  async executeAgent(context: ExecutionContext): Promise<string> {
    const executionId = await this.createExecution(context)
    
    // Start execution asynchronously
    const executionPromise = this.runExecution(executionId, context)
    this.activeExecutions.set(executionId, executionPromise)
    
    // Clean up after completion
    executionPromise.finally(() => {
      this.activeExecutions.delete(executionId)
    })

    return executionId
  }

  private async createExecution(context: ExecutionContext): Promise<string> {
    const agent = await prisma.agent.findUnique({
      where: { id: context.agentId }
    })

    if (!agent) {
      throw new Error('Agent not found')
    }

    const execution = await prisma.execution.create({
      data: {
        agentId: context.agentId,
        userId: context.userId,
        status: 'PENDING',
        input: context.input,
        trigger: context.trigger,
        environment: context.environment,
        startedAt: new Date()
      }
    })

    return execution.id
  }

  private async runExecution(executionId: string, context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now()
    const logs: ExecutionLog[] = []

    try {
      // Update execution status
      await this.updateExecutionStatus(executionId, 'RUNNING')
      
      // Get agent details
      const agent = await prisma.agent.findUnique({
        where: { id: context.agentId }
      })

      if (!agent) {
        throw new Error('Agent not found')
      }

      // Get framework executor
      const executor = this.executors.get(agent.framework.toLowerCase())
      if (!executor) {
        throw new Error(`Framework ${agent.framework} not supported`)
      }

      // Create execution context for framework
      const frameworkContext = {
        ...context,
        configuration: { ...agent.configuration, ...context.configuration },
        onLog: (log: ExecutionLog) => {
          logs.push(log)
          this.saveExecutionLog(executionId, log)
          this.emit('log', { executionId, log })
        },
        onProgress: (progress: number) => {
          this.emit('progress', { executionId, progress })
        }
      }

      // Execute agent
      this.emit('started', { executionId })
      const result = await executor.execute(frameworkContext)
      
      const duration = Date.now() - startTime
      
      // Update execution with results
      await prisma.execution.update({
        where: { id: executionId },
        data: {
          status: result.success ? 'COMPLETED' : 'FAILED',
          output: result.output,
          error: result.error,
          duration,
          tokensUsed: result.tokensUsed,
          cost: result.cost,
          completedAt: new Date()
        }
      })

      // Update agent metrics
      await this.updateAgentMetrics(context.agentId, result.success, duration)

      const finalResult = {
        ...result,
        duration,
        logs
      }

      this.emit('completed', { executionId, result: finalResult })
      return finalResult

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Update execution with error
      await prisma.execution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          error: errorMessage,
          duration,
          completedAt: new Date()
        }
      })

      // Log error
      const errorLog: ExecutionLog = {
        level: 'ERROR',
        message: errorMessage,
        timestamp: new Date(),
        metadata: { stack: error instanceof Error ? error.stack : undefined }
      }
      logs.push(errorLog)
      await this.saveExecutionLog(executionId, errorLog)

      const failureResult: ExecutionResult = {
        success: false,
        error: errorMessage,
        duration,
        logs
      }

      this.emit('failed', { executionId, error: errorMessage })
      return failureResult
    }
  }

  private async updateExecutionStatus(executionId: string, status: string) {
    await prisma.execution.update({
      where: { id: executionId },
      data: { status: status as any }
    })

    this.emit('statusChanged', { executionId, status })
  }

  private async saveExecutionLog(executionId: string, log: ExecutionLog) {
    try {
      await prisma.executionLog.create({
        data: {
          executionId,
          level: log.level,
          message: log.message,
          timestamp: log.timestamp,
          metadata: log.metadata
        }
      })
    } catch (error) {
      console.error('Failed to save execution log:', error)
    }
  }

  private async updateAgentMetrics(agentId: string, success: boolean, duration: number) {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId }
    })

    if (!agent) return

    const totalExecutions = agent.totalExecutions + 1
    const successfulExecutions = agent.successfulExecutions + (success ? 1 : 0)
    
    // Calculate new average execution time
    const currentAvg = agent.avgExecutionTime || 0
    const newAvg = (currentAvg * agent.totalExecutions + duration) / totalExecutions

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        totalExecutions,
        successfulExecutions,
        avgExecutionTime: newAvg,
        lastExecutedAt: new Date(),
        status: 'IDLE'
      }
    })
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const activeExecution = this.activeExecutions.get(executionId)
    if (!activeExecution) {
      return false
    }

    try {
      await prisma.execution.update({
        where: { id: executionId },
        data: {
          status: 'CANCELLED',
          completedAt: new Date()
        }
      })

      this.emit('cancelled', { executionId })
      return true
    } catch (error) {
      console.error('Failed to cancel execution:', error)
      return false
    }
  }

  async getExecutionStatus(executionId: string) {
    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        logs: {
          orderBy: { timestamp: 'desc' },
          take: 100
        }
      }
    })

    return execution
  }

  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys())
  }

  async getExecutionLogs(executionId: string, limit = 100) {
    return prisma.executionLog.findMany({
      where: { executionId },
      orderBy: { timestamp: 'desc' },
      take: limit
    })
  }
}

// Singleton instance
export const executionEngine = new ExecutionEngine()