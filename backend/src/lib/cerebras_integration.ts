import axios, { AxiosInstance } from 'axios'

export interface CerebrasConfig {
  apiKey: string
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
  baseURL?: string
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
  private client: AxiosInstance
  private config: CerebrasConfig

  constructor(config: CerebrasConfig) {
    this.config = config
    this.client = axios.create({
      baseURL: config.baseURL || 'https://api.cerebras.com',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    })
  }

  async createCompletion(
    messages: CerebrasMessage[],
    options?: Partial<CerebrasConfig>
  ): Promise<CerebrasResponse> {
    try {
      const response = await this.client.post('/v1/chat/completions', {
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        model: options?.model || this.config.model || 'llama-4-scout-17b-16e-instruct',
        temperature: options?.temperature ?? this.config.temperature ?? 0.2,
        max_tokens: options?.maxTokens || this.config.maxTokens || 2048,
        top_p: options?.topP ?? this.config.topP ?? 1,
        stream: false
      })

      return {
        id: response.data.id,
        choices: response.data.choices.map((choice: any) => ({
          index: choice.index || 0,
          message: {
            role: choice.message?.role || 'assistant',
            content: choice.message?.content || ''
          },
          finish_reason: choice.finish_reason || 'stop'
        })),
        usage: {
          prompt_tokens: response.data.usage?.prompt_tokens || 0,
          completion_tokens: response.data.usage?.completion_tokens || 0,
          total_tokens: response.data.usage?.total_tokens || 0
        },
        model: response.data.model || 'llama-4-scout-17b-16e-instruct'
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
      const response = await this.client.post('/v1/chat/completions', {
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        model: options?.model || this.config.model || 'llama-4-scout-17b-16e-instruct',
        temperature: options?.temperature ?? this.config.temperature ?? 0.2,
        max_tokens: options?.maxTokens || this.config.maxTokens || 2048,
        top_p: options?.topP ?? this.config.topP ?? 1,
        stream: true
      }, {
        responseType: 'stream'
      })

      // Handle streaming response
      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') return
            
            try {
              const parsed = JSON.parse(data)
              const processedChunk: CerebrasStreamChunk = {
                id: parsed.id,
                choices: parsed.choices.map((choice: any) => ({
                  index: choice.index || 0,
                  delta: {
                    content: choice.delta?.content,
                    role: choice.delta?.role
                  },
                  finish_reason: choice.finish_reason
                }))
              }
              
              onChunk(processedChunk)
            } catch (e) {
              console.error('Error parsing stream chunk:', e)
            }
          }
        }
      })
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