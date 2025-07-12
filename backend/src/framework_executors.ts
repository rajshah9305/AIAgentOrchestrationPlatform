// lib/execution/frameworks/base.ts
export interface AgentFramework {
  execute(context: FrameworkExecutionContext): Promise<FrameworkExecutionResult>
  validate(configuration: any): Promise<ValidationResult>
  getSchema(): ConfigurationSchema
}

export interface FrameworkExecutionContext {
  agentId: string
  userId: string
  input: any
  configuration: any
  environment: string
  onLog: (log: ExecutionLog) => void
  onProgress: (progress: number) => void
}

export interface FrameworkExecutionResult {
  success: boolean
  output?: any
  error?: string
  tokensUsed?: number
  cost?: number
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface ConfigurationSchema {
  type: 'object'
  properties: Record<string, any>
  required: string[]
}

// lib/execution/frameworks/autogen.ts
import { AgentFramework, FrameworkExecutionContext, FrameworkExecutionResult } from './base'

export class AutoGenExecutor implements AgentFramework {
  async execute(context: FrameworkExecutionContext): Promise<FrameworkExecutionResult> {
    throw new Error('AutoGenExecutor is not implemented in this minimal backend.');
  }
  async validate(configuration: any): Promise<ValidationResult> {
    return { valid: true, errors: [] }
  }
  getSchema(): ConfigurationSchema {
    return { type: 'object', properties: {}, required: [] }
  }
}

// lib/execution/frameworks/crewai.ts
export class CrewAIExecutor implements AgentFramework {
  async execute(context: FrameworkExecutionContext): Promise<FrameworkExecutionResult> {
    throw new Error('CrewAIExecutor is not implemented in this minimal backend.');
  }
  async validate(configuration: any): Promise<ValidationResult> {
    return { valid: true, errors: [] }
  }
  getSchema(): ConfigurationSchema {
    return { type: 'object', properties: {}, required: [] }
  }
}

// lib/execution/frameworks/autogpt.ts
export class AutoGPTExecutor implements AgentFramework {
  async execute(context: FrameworkExecutionContext): Promise<FrameworkExecutionResult> {
    throw new Error('AutoGPTExecutor is not implemented in this minimal backend.');
  }
  async validate(configuration: any): Promise<ValidationResult> {
    return { valid: true, errors: [] }
  }
  getSchema(): ConfigurationSchema {
    return { type: 'object', properties: {}, required: [] }
  }
}

// Export additional framework executors
export class BabyAGIExecutor implements AgentFramework {
  async execute(context: FrameworkExecutionContext): Promise<FrameworkExecutionResult> {
    throw new Error('BabyAGIExecutor is not implemented in this minimal backend.');
  }
  async validate(configuration: any): Promise<ValidationResult> {
    return { valid: true, errors: [] }
  }
  getSchema(): ConfigurationSchema {
    return { type: 'object', properties: {}, required: [] }
  }
}

export class LangGraphExecutor implements AgentFramework {
  async execute(context: FrameworkExecutionContext): Promise<FrameworkExecutionResult> {
    throw new Error('LangGraphExecutor is not implemented in this minimal backend.');
  }
  async validate(configuration: any): Promise<ValidationResult> {
    return { valid: true, errors: [] }
  }
  getSchema(): ConfigurationSchema {
    return { type: 'object', properties: {}, required: [] }
  }
}