// lib/ai-providers/cerebras-client.ts
import { Cerebras } from '@cerebras/cloud-sdk'

export interface CerebrasConfig {
  apiKey: string
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
}

export interface CerebrasMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CerebrasResponse {
  id: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  model: string
}

export interface CerebrasStreamChunk {
  id: string
  choices: Array<{
    index: number
    delta: {
      content?: string
      role?: string
    }
    finish_reason?: string
  }>
}

export class CerebrasClient {
  private client: Cerebras
  private config: CerebrasConfig

  constructor(config: CerebrasConfig) {
    this.config = config
    this.client = new Cerebras({
      apiKey: config.apiKey
    })
  }

  async createCompletion(
    messages: CerebrasMessage[],
    options?: Partial<CerebrasConfig>
  ): Promise<CerebrasResponse> {
    try {
      const response = await this.client.chat.completions.create({
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        model: options?.model || this.config.model || 'llama-4-scout-17b-16e-instruct',
        temperature: options?.temperature ?? this.config.temperature ?? 0.2,
        max_completion_tokens: options?.maxTokens || this.config.maxTokens || 2048,
        top_p: options?.topP ?? this.config.topP ?? 1,
        stream: false
      })

      return {
        id: response.id,
        choices: response.choices.map(choice => ({
          index: choice.index || 0,
          message: {
            role: choice.message?.role || 'assistant',
            content: choice.message?.content || ''
          },
          finish_reason: choice.finish_reason || 'stop'
        })),
        usage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0
        },
        model: response.model || 'llama-4-scout-17b-16e-instruct'
      }
    } catch (error) {
      console.error('Cerebras API error:', error)
      throw new Error(`Cerebras API error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async createStreamCompletion(
    messages: CerebrasMessage[],
    onChunk: (chunk: CerebrasStreamChunk) => void,
    options?: Partial<CerebrasConfig>
  ): Promise<void> {
    try {
      const stream = await this.client.chat.completions.create({
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        model: options?.model || this.config.model || 'llama-4-scout-17b-16e-instruct',
        temperature: options?.temperature ?? this.config.temperature ?? 0.2,
        max_completion_tokens: options?.maxTokens || this.config.maxTokens || 2048,
        top_p: options?.topP ?? this.config.topP ?? 1,
        stream: true
      })

      for await (const chunk of stream) {
        const processedChunk: CerebrasStreamChunk = {
          id: chunk.id,
          choices: chunk.choices.map(choice => ({
            index: choice.index || 0,
            delta: {
              content: choice.delta?.content,
              role: choice.delta?.role
            },
            finish_reason: choice.finish_reason
          }))
        }
        
        onChunk(processedChunk)
      }
    } catch (error) {
      console.error('Cerebras streaming error:', error)
      throw new Error(`Cerebras streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getAvailableModels(): Promise<string[]> {
    // Cerebras available models (update this list as new models become available)
    return [
      'llama-4-scout-17b-16e-instruct',
      'llama-3.1-8b-instruct',
      'llama-3.1-70b-instruct',
      'mixtral-8x7b-instruct',
      'gemma-7b-it'
    ]
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!this.config.apiKey) {
      errors.push('Cerebras API key is required')
    }

    if (this.config.temperature !== undefined) {
      if (this.config.temperature < 0 || this.config.temperature > 2) {
        errors.push('Temperature must be between 0 and 2')
      }
    }

    if (this.config.maxTokens !== undefined) {
      if (this.config.maxTokens < 1 || this.config.maxTokens > 8192) {
        errors.push('Max tokens must be between 1 and 8192')
      }
    }

    if (this.config.topP !== undefined) {
      if (this.config.topP < 0 || this.config.topP > 1) {
        errors.push('Top P must be between 0 and 1')
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  calculateCost(usage: { prompt_tokens: number; completion_tokens: number }): number {
    // Cerebras pricing (update with actual pricing)
    const PROMPT_COST_PER_TOKEN = 0.0000006  // $0.6 per 1M tokens
    const COMPLETION_COST_PER_TOKEN = 0.0000006  // $0.6 per 1M tokens
    
    return (
      usage.prompt_tokens * PROMPT_COST_PER_TOKEN +
      usage.completion_tokens * COMPLETION_COST_PER_TOKEN
    )
  }
}

// lib/execution/frameworks/cerebras-powered.ts
import { AgentFramework, FrameworkExecutionContext, FrameworkExecutionResult } from './base'
import { CerebrasClient, CerebrasMessage } from '@/lib/ai-providers/cerebras-client'

export class CerebrasPoweredExecutor implements AgentFramework {
  private cerebrasClient: CerebrasClient | null = null

  async execute(context: FrameworkExecutionContext): Promise<FrameworkExecutionResult> {
    const { input, configuration, onLog, onProgress } = context

    try {
      onLog({
        level: 'INFO',
        message: 'Starting Cerebras-powered agent execution',
        timestamp: new Date()
      })

      onProgress(10)

      // Initialize Cerebras client
      this.cerebrasClient = new CerebrasClient({
        apiKey: configuration.cerebras_api_key || process.env.CEREBRAS_API_KEY!,
        model: configuration.model || 'llama-4-scout-17b-16e-instruct',
        temperature: configuration.temperature || 0.2,
        maxTokens: configuration.max_tokens || 2048,
        topP: configuration.top_p || 1
      })

      // Validate configuration
      const validation = await this.validate(configuration)
      if (!validation.valid) {
        throw new Error(`Configuration invalid: ${validation.errors.join(', ')}`)
      }

      onProgress(30)

      // Prepare messages
      const messages: CerebrasMessage[] = [
        {
          role: 'system',
          content: configuration.system_message || 'You are a helpful AI assistant powered by Cerebras ultra-fast inference.'
        }
      ]

      // Add conversation history if provided
      if (configuration.conversation_history) {
        messages.push(...configuration.conversation_history)
      }

      // Add user input
      if (typeof input === 'string') {
        messages.push({
          role: 'user',
          content: input
        })
      } else if (input.message) {
        messages.push({
          role: 'user',
          content: input.message
        })
      }

      onProgress(50)

      onLog({
        level: 'INFO',
        message: `Processing with Cerebras model: ${configuration.model || 'llama-4-scout-17b-16e-instruct'}`,
        timestamp: new Date()
      })

      let response
      let totalTokens = 0

      if (configuration.stream) {
        // Stream response
        let fullContent = ''
        
        await this.cerebrasClient.createStreamCompletion(
          messages,
          (chunk) => {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              fullContent += content
              onLog({
                level: 'INFO',
                message: `Streaming response: ${content}`,
                timestamp: new Date()
              })
            }
          },
          {
            model: configuration.model,
            temperature: configuration.temperature,
            maxTokens: configuration.max_tokens,
            topP: configuration.top_p
          }
        )

        response = {
          id: 'cerebras-stream-' + Date.now(),
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: fullContent
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: this.estimateTokens(messages.map(m => m.content).join(' ')),
            completion_tokens: this.estimateTokens(fullContent),
            total_tokens: 0
          },
          model: configuration.model || 'llama-4-scout-17b-16e-instruct'
        }
        
        response.usage.total_tokens = response.usage.prompt_tokens + response.usage.completion_tokens
        totalTokens = response.usage.total_tokens

      } else {
        // Regular response
        response = await this.cerebrasClient.createCompletion(messages, {
          model: configuration.model,
          temperature: configuration.temperature,
          maxTokens: configuration.max_tokens,
          topP: configuration.top_p
        })
        
        totalTokens = response.usage.total_tokens
      }

      onProgress(90)

      // Calculate cost
      const cost = this.cerebrasClient.calculateCost(response.usage)

      onLog({
        level: 'INFO',
        message: `Cerebras execution completed. Tokens used: ${totalTokens}, Cost: $${cost.toFixed(6)}`,
        timestamp: new Date()
      })

      onProgress(100)

      return {
        success: true,
        output: {
          response: response.choices[0].message.content,
          model: response.model,
          usage: response.usage,
          messages: [...messages, response.choices[0].message],
          metadata: {
            provider: 'cerebras',
            inference_time: 'ultra-fast',
            finish_reason: response.choices[0].finish_reason
          }
        },
        tokensUsed: totalTokens,
        cost
      }

    } catch (error) {
      onLog({
        level: 'ERROR',
        message: `Cerebras execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.stack : undefined }
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async validate(configuration: any): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    if (!configuration.cerebras_api_key && !process.env.CEREBRAS_API_KEY) {
      errors.push('Cerebras API key is required')
    }

    if (configuration.model) {
      const availableModels = await this.getAvailableModels()
      if (!availableModels.includes(configuration.model)) {
        errors.push(`Invalid model. Available models: ${availableModels.join(', ')}`)
      }
    }

    if (configuration.temperature !== undefined) {
      if (typeof configuration.temperature !== 'number' || 
          configuration.temperature < 0 || 
          configuration.temperature > 2) {
        errors.push('Temperature must be a number between 0 and 2')
      }
    }

    if (configuration.max_tokens !== undefined) {
      if (typeof configuration.max_tokens !== 'number' || 
          configuration.max_tokens < 1 || 
          configuration.max_tokens > 8192) {
        errors.push('Max tokens must be a number between 1 and 8192')
      }
    }

    if (configuration.top_p !== undefined) {
      if (typeof configuration.top_p !== 'number' || 
          configuration.top_p < 0 || 
          configuration.top_p > 1) {
        errors.push('Top P must be a number between 0 and 1')
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  getSchema(): any {
    return {
      type: 'object',
      properties: {
        cerebras_api_key: {
          type: 'string',
          description: 'Cerebras API key (optional if set in environment)'
        },
        model: {
          type: 'string',
          enum: [
            'llama-4-scout-17b-16e-instruct',
            'llama-3.1-8b-instruct',
            'llama-3.1-70b-instruct',
            'mixtral-8x7b-instruct',
            'gemma-7b-it'
          ],
          default: 'llama-4-scout-17b-16e-instruct',
          description: 'Cerebras model to use for inference'
        },
        system_message: {
          type: 'string',
          default: 'You are a helpful AI assistant powered by Cerebras ultra-fast inference.',
          description: 'System message to set the assistant behavior'
        },
        temperature: {
          type: 'number',
          minimum: 0,
          maximum: 2,
          default: 0.2,
          description: 'Controls randomness in the response'
        },
        max_tokens: {
          type: 'number',
          minimum: 1,
          maximum: 8192,
          default: 2048,
          description: 'Maximum number of tokens to generate'
        },
        top_p: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 1,
          description: 'Controls diversity via nucleus sampling'
        },
        stream: {
          type: 'boolean',
          default: false,
          description: 'Whether to stream the response'
        },
        conversation_history: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: {
                type: 'string',
                enum: ['user', 'assistant', 'system']
              },
              content: {
                type: 'string'
              }
            }
          },
          description: 'Previous conversation messages for context'
        }
      },
      required: []
    }
  }

  private async getAvailableModels(): Promise<string[]> {
    const client = new CerebrasClient({
      apiKey: process.env.CEREBRAS_API_KEY || 'dummy'
    })
    return client.getAvailableModels()
  }

  private estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }
}

// lib/execution/frameworks/cerebras-autogen.ts
import { AgentFramework, FrameworkExecutionContext, FrameworkExecutionResult } from './base'
import { CerebrasClient, CerebrasMessage } from '@/lib/ai-providers/cerebras-client'

export class CerebrasAutoGenExecutor implements AgentFramework {
  async execute(context: FrameworkExecutionContext): Promise<FrameworkExecutionResult> {
    const { input, configuration, onLog, onProgress } = context

    try {
      onLog({
        level: 'INFO',
        message: 'Starting Cerebras-powered AutoGen multi-agent execution',
        timestamp: new Date()
      })

      onProgress(10)

      // Initialize Cerebras client
      const cerebrasClient = new CerebrasClient({
        apiKey: configuration.cerebras_api_key || process.env.CEREBRAS_API_KEY!,
        model: configuration.model || 'llama-4-scout-17b-16e-instruct',
        temperature: configuration.temperature || 0.2
      })

      const agents = configuration.agents || []
      const maxRounds = configuration.max_rounds || 5
      const conversation: any[] = []

      onProgress(20)

      for (let round = 0; round < maxRounds; round++) {
        onLog({
          level: 'INFO',
          message: `Starting conversation round ${round + 1}/${maxRounds}`,
          timestamp: new Date()
        })

        for (let agentIndex = 0; agentIndex < agents.length; agentIndex++) {
          const agent = agents[agentIndex]
          
          onLog({
            level: 'INFO',
            message: `Agent ${agent.name} is responding...`,
            timestamp: new Date()
          })

          // Prepare messages for this agent
          const messages: CerebrasMessage[] = [
            {
              role: 'system',
              content: agent.system_message || `You are ${agent.name}, ${agent.role}.`
            }
          ]

          // Add conversation history
          conversation.forEach(turn => {
            messages.push({
              role: turn.agent === agent.name ? 'assistant' : 'user',
              content: `${turn.agent}: ${turn.content}`
            })
          })

          // Add initial input if first round
          if (round === 0 && agentIndex === 0) {
            messages.push({
              role: 'user',
              content: typeof input === 'string' ? input : JSON.stringify(input)
            })
          }

          // Get response from Cerebras
          const response = await cerebrasClient.createCompletion(messages, {
            model: configuration.model,
            temperature: configuration.temperature,
            maxTokens: configuration.max_tokens || 1024
          })

          const agentResponse = response.choices[0].message.content

          conversation.push({
            round: round + 1,
            agent: agent.name,
            role: agent.role,
            content: agentResponse,
            tokens: response.usage.completion_tokens,
            cost: cerebrasClient.calculateCost(response.usage)
          })

          onLog({
            level: 'INFO',
            message: `${agent.name} responded: ${agentResponse.substring(0, 100)}...`,
            timestamp: new Date()
          })

          // Check if conversation should terminate
          if (agentResponse.toLowerCase().includes('conversation complete') ||
              agentResponse.toLowerCase().includes('terminate')) {
            onLog({
              level: 'INFO',
              message: 'Conversation terminated by agent decision',
              timestamp: new Date()
            })
            break
          }
        }

        onProgress(20 + ((round + 1) / maxRounds) * 70)
      }

      // Calculate totals
      const totalTokens = conversation.reduce((sum, turn) => sum + turn.tokens, 0)
      const totalCost = conversation.reduce((sum, turn) => sum + turn.cost, 0)

      onProgress(100)

      return {
        success: true,
        output: {
          conversation,
          summary: `Multi-agent conversation completed with ${conversation.length} turns`,
          provider: 'cerebras',
          model: configuration.model || 'llama-4-scout-17b-16e-instruct',
          total_rounds: Math.ceil(conversation.length / agents.length)
        },
        tokensUsed: totalTokens,
        cost: totalCost
      }

    } catch (error) {
      onLog({
        level: 'ERROR',
        message: `Cerebras AutoGen execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async validate(configuration: any): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    if (!configuration.cerebras_api_key && !process.env.CEREBRAS_API_KEY) {
      errors.push('Cerebras API key is required')
    }

    if (!configuration.agents || !Array.isArray(configuration.agents)) {
      errors.push('Agents array is required')
    } else if (configuration.agents.length < 2) {
      errors.push('At least 2 agents are required for multi-agent conversation')
    }

    return { valid: errors.length === 0, errors }
  }

  getSchema(): any {
    return {
      type: 'object',
      properties: {
        cerebras_api_key: {
          type: 'string',
          description: 'Cerebras API key'
        },
        model: {
          type: 'string',
          enum: [
            'llama-4-scout-17b-16e-instruct',
            'llama-3.1-8b-instruct',
            'llama-3.1-70b-instruct',
            'mixtral-8x7b-instruct'
          ],
          default: 'llama-4-scout-17b-16e-instruct'
        },
        agents: {
          type: 'array',
          minItems: 2,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              role: { type: 'string' },
              system_message: { type: 'string' }
            },
            required: ['name', 'role']
          }
        },
        max_rounds: {
          type: 'number',
          minimum: 1,
          maximum: 20,
          default: 5
        },
        temperature: {
          type: 'number',
          minimum: 0,
          maximum: 2,
          default: 0.2
        },
        max_tokens: {
          type: 'number',
          default: 1024
        }
      },
      required: ['agents']
    }
  }
}

// Update: lib/execution/execution-engine.ts - Add Cerebras support
// Add these imports at the top:
import { CerebrasPoweredExecutor } from './frameworks/cerebras-powered'
import { CerebrasAutoGenExecutor } from './frameworks/cerebras-autogen'

// In the initializeExecutors method, add:
private initializeExecutors() {
  // Existing executors...
  this.executors.set('autogen', new AutoGenExecutor())
  this.executors.set('crewai', new CrewAIExecutor())
  this.executors.set('autogpt', new AutoGPTExecutor())
  this.executors.set('babyagi', new BabyAGIExecutor())
  this.executors.set('langgraph', new LangGraphExecutor())
  
  // Add Cerebras-powered executors
  this.executors.set('cerebras', new CerebrasPoweredExecutor())
  this.executors.set('cerebras-autogen', new CerebrasAutoGenExecutor())
}

// app/api/ai-providers/cerebras/models/route.ts
import { NextResponse } from 'next/server'
import { CerebrasClient } from '@/lib/ai-providers/cerebras-client'

export async function GET() {
  try {
    if (!process.env.CEREBRAS_API_KEY) {
      return NextResponse.json(
        { error: 'Cerebras API key not configured' },
        { status: 503 }
      )
    }

    const client = new CerebrasClient({
      apiKey: process.env.CEREBRAS_API_KEY
    })

    const models = await client.getAvailableModels()
    
    return NextResponse.json({
      provider: 'cerebras',
      models: models.map(model => ({
        id: model,
        name: model,
        description: getCerebrasModelDescription(model),
        context_window: getCerebrasContextWindow(model),
        max_tokens: getCerebrasMaxTokens(model)
      }))
    })

  } catch (error) {
    console.error('Error fetching Cerebras models:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Cerebras models' },
      { status: 500 }
    )
  }
}

function getCerebrasModelDescription(model: string): string {
  const descriptions: Record<string, string> = {
    'llama-4-scout-17b-16e-instruct': 'Latest Llama 4 Scout model with 17B parameters - Ultra-fast inference',
    'llama-3.1-8b-instruct': 'Llama 3.1 8B - Balanced performance and speed',
    'llama-3.1-70b-instruct': 'Llama 3.1 70B - High-performance large model',
    'mixtral-8x7b-instruct': 'Mixtral 8x7B - Mixture of experts architecture',
    'gemma-7b-it': 'Google Gemma 7B - Instruction-tuned model'
  }
  return descriptions[model] || 'High-performance model with ultra-fast inference'
}

function getCerebrasContextWindow(model: string): number {
  const contextWindows: Record<string, number> = {
    'llama-4-scout-17b-16e-instruct': 16384,
    'llama-3.1-8b-instruct': 8192,
    'llama-3.1-70b-instruct': 8192,
    'mixtral-8x7b-instruct': 32768,
    'gemma-7b-it': 8192
  }
  return contextWindows[model] || 8192
}

function getCerebrasMaxTokens(model: string): number {
  const maxTokens: Record<string, number> = {
    'llama-4-scout-17b-16e-instruct': 8192,
    'llama-3.1-8b-instruct': 4096,
    'llama-3.1-70b-instruct': 4096,
    'mixtral-8x7b-instruct': 4096,
    'gemma-7b-it': 4096
  }
  return maxTokens[model] || 4096
}

// app/api/ai-providers/cerebras/test/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { CerebrasClient } from '@/lib/ai-providers/cerebras-client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { message, model, api_key } = await request.json()

    const client = new CerebrasClient({
      apiKey: api_key || process.env.CEREBRAS_API_KEY!,
      model: model || 'llama-4-scout-17b-16e-instruct'
    })

    const response = await client.createCompletion([
      {
        role: 'user',
        content: message || 'Hello! Please respond with a brief message to test the connection.'
      }
    ])

    return NextResponse.json({
      success: true,
      response: response.choices[0].message.content,
      model: response.model,
      usage: response.usage,
      cost: client.calculateCost(response.usage)
    })

  } catch (error) {
    console.error('Cerebras test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}