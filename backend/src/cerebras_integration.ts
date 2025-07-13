import axios from 'axios'

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
  private client: any
  private config: CerebrasConfig

  constructor(config: CerebrasConfig) {
    this.config = {
      model: 'llama-4-scout-17b-16e-instruct',
      temperature: 0.7,
      maxTokens: 1024,
      topP: 1,
      stream: false,
      ...config
    }
  }

  async createCompletion(
    messages: CerebrasMessage[],
    options?: Partial<CerebrasConfig>
  ): Promise<CerebrasResponse> {
    try {
      const response = await axios.post(
        'https://api.cerebras.ai/v1/chat/completions',
        {
          model: options?.model || this.config.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          temperature: options?.temperature || this.config.temperature,
          max_tokens: options?.maxTokens || this.config.maxTokens,
          top_p: options?.topP || this.config.topP,
          stream: options?.stream || this.config.stream
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      return response.data
    } catch (error) {
      console.error('Cerebras API error:', error)
      throw new Error('Failed to create completion')
    }
  }

  async createStreamCompletion(
    messages: CerebrasMessage[],
    onChunk: (chunk: CerebrasStreamChunk) => void,
    options?: Partial<CerebrasConfig>
  ): Promise<void> {
    try {
      const response = await axios.post(
        'https://api.cerebras.ai/v1/chat/completions',
        {
          model: options?.model || this.config.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          temperature: options?.temperature || this.config.temperature,
          max_tokens: options?.maxTokens || this.config.maxTokens,
          top_p: options?.topP || this.config.topP,
          stream: true
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      )

      // Handle streaming response
      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') return
            
            try {
              const parsed = JSON.parse(data)
              onChunk(parsed)
            } catch (error) {
              console.error('Error parsing stream chunk:', error)
            }
          }
        }
      })
    } catch (error) {
      console.error('Cerebras stream error:', error)
      throw new Error('Failed to create stream completion')
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await axios.get(
        'https://api.cerebras.ai/v1/models',
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`
          }
        }
      )
      
      return response.data.data.map((model: any) => model.id)
    } catch (error) {
      console.error('Error fetching Cerebras models:', error)
      return []
    }
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!this.config.apiKey) {
      errors.push('API key is required')
    }

    if (this.config.temperature && (this.config.temperature < 0 || this.config.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2')
    }

    if (this.config.maxTokens && (this.config.maxTokens < 1 || this.config.maxTokens > 8192)) {
      errors.push('Max tokens must be between 1 and 8192')
    }

    if (this.config.topP && (this.config.topP < 0 || this.config.topP > 1)) {
      errors.push('Top P must be between 0 and 1')
    }

    return { valid: errors.length === 0, errors }
  }

  calculateCost(usage: { prompt_tokens: number; completion_tokens: number }): number {
    // Cerebras pricing (example rates - check actual pricing)
    const promptCostPerToken = 0.0001
    const completionCostPerToken = 0.0002
    
    return (usage.prompt_tokens * promptCostPerToken) + (usage.completion_tokens * completionCostPerToken)
  }
}

export interface FrameworkExecutionContext {
  agentId: string
  input: any
  configuration: any
  userId: string
}

export interface FrameworkExecutionResult {
  success: boolean
  output?: any
  error?: string
  logs?: string[]
  metadata?: any
}

export interface AgentFramework {
  execute(context: FrameworkExecutionContext): Promise<FrameworkExecutionResult>
  validate(configuration: any): Promise<{ valid: boolean; errors: string[] }>
  getSchema(): any
}

export class CerebrasPoweredExecutor implements AgentFramework {
  private cerebrasClient: CerebrasClient | null = null

  async execute(context: FrameworkExecutionContext): Promise<FrameworkExecutionResult> {
    try {
      const { configuration, input } = context
      
      // Initialize Cerebras client
      if (!this.cerebrasClient) {
        this.cerebrasClient = new CerebrasClient({
          apiKey: configuration.cerebras_api_key || process.env.CEREBRAS_API_KEY!,
          model: configuration.model || 'llama-4-scout-17b-16e-instruct',
          temperature: configuration.temperature || 0.7,
          maxTokens: configuration.max_tokens || 1024
        })
      }

      // Prepare messages
      const messages: CerebrasMessage[] = []
      
      // Add system message if provided
      if (configuration.system_message) {
        messages.push({
          role: 'system',
          content: configuration.system_message
        })
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
      } else {
        messages.push({
          role: 'user',
          content: JSON.stringify(input)
        })
      }

      // Create completion
      const response = await this.cerebrasClient.createCompletion(messages)

      return {
        success: true,
        output: {
          content: response.choices[0].message.content,
          model: response.model,
          usage: response.usage,
          cost: this.cerebrasClient.calculateCost(response.usage)
        },
        metadata: {
          model: response.model,
          tokens_used: response.usage.total_tokens,
          finish_reason: response.choices[0].finish_reason
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }

  async validate(configuration: any): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    if (!configuration.cerebras_api_key && !process.env.CEREBRAS_API_KEY) {
      errors.push('Cerebras API key is required')
    }

    if (configuration.model && !['llama-4-scout-17b-16e-instruct', 'llama-3.1-8b-instruct', 'llama-3.1-70b-instruct', 'mixtral-8x7b-instruct'].includes(configuration.model)) {
      errors.push('Invalid model specified')
    }

    if (configuration.temperature && (configuration.temperature < 0 || configuration.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2')
    }

    if (configuration.max_tokens && (configuration.max_tokens < 1 || configuration.max_tokens > 8192)) {
      errors.push('Max tokens must be between 1 and 8192')
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
        system_message: {
          type: 'string',
          description: 'System message to set context'
        },
        temperature: {
          type: 'number',
          minimum: 0,
          maximum: 2,
          default: 0.7
        },
        max_tokens: {
          type: 'number',
          minimum: 1,
          maximum: 8192,
          default: 1024
        }
      },
      required: ['cerebras_api_key']
    }
  }
}

export class CerebrasAutoGenExecutor implements AgentFramework {
  async execute(context: FrameworkExecutionContext): Promise<FrameworkExecutionResult> {
    try {
      const { configuration, input } = context
      
      // Initialize Cerebras client
      const cerebrasClient = new CerebrasClient({
        apiKey: configuration.cerebras_api_key || process.env.CEREBRAS_API_KEY!,
        model: configuration.model || 'llama-4-scout-17b-16e-instruct',
        temperature: configuration.temperature || 0.7,
        maxTokens: configuration.max_tokens || 1024
      })

      // Validate configuration
      const validation = await this.validate(configuration)
      if (!validation.valid) {
        return {
          success: false,
          error: `Configuration validation failed: ${validation.errors.join(', ')}`
        }
      }

      // Simulate multi-agent conversation
      const agents = configuration.agents || []
      const maxRounds = configuration.max_rounds || 5
      const conversation: any[] = []
      
      // Add initial user message
      if (typeof input === 'string') {
        conversation.push({ role: 'user', content: input })
      } else if (input.message) {
        conversation.push({ role: 'user', content: input.message })
      }

      // Simulate conversation rounds
      for (let round = 0; round < maxRounds; round++) {
        for (const agent of agents) {
          // Add agent context
          const agentMessages: CerebrasMessage[] = [
            {
              role: 'system',
              content: agent.system_message || `You are ${agent.name}, a ${agent.role}.`
            },
            ...conversation.map(msg => ({
              role: msg.role as 'user' | 'assistant',
              content: msg.content
            }))
          ]

          // Get agent response
          const response = await cerebrasClient.createCompletion(agentMessages)
          const agentResponse = response.choices[0].message.content

          conversation.push({
            role: 'assistant',
            content: `${agent.name}: ${agentResponse}`
          })
        }
      }

      return {
        success: true,
        output: {
          conversation,
          final_response: conversation[conversation.length - 1]?.content || 'No response generated'
        },
        metadata: {
          agents_used: agents.length,
          conversation_rounds: maxRounds,
          total_messages: conversation.length
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`]
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