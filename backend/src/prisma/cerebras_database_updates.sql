-- prisma/migrations/add_cerebras_support/migration.sql
-- Add Cerebras framework support

-- Update Framework enum to include Cerebras options
ALTER TYPE "Framework" ADD VALUE 'CEREBRAS';
ALTER TYPE "Framework" ADD VALUE 'CEREBRAS_AUTOGEN';

-- Insert Cerebras framework configurations
INSERT INTO "frameworks" (
  id,
  name,
  "displayName",
  description,
  category,
  difficulty,
  rating,
  growth,
  features,
  tags,
  "isActive",
  "isPopular",
  "isNew",
  "configSchema",
  "defaultConfig"
) VALUES 
(
  'cerebras',
  'CEREBRAS',
  'Cerebras AI',
  'Ultra-fast AI inference with Cerebras hardware acceleration. Powered by advanced silicon for lightning-speed responses.',
  'single-agent',
  'beginner',
  4.9,
  89,
  ARRAY['Ultra-fast inference', 'Multiple model support', 'Streaming responses', 'Cost-effective'],
  ARRAY['ultra-fast', 'hardware-accelerated', 'llama', 'cost-effective'],
  true,
  true,
  true,
  '{
    "type": "object",
    "properties": {
      "cerebras_api_key": {
        "type": "string",
        "description": "Cerebras API key (optional if set in environment)"
      },
      "model": {
        "type": "string",
        "enum": [
          "llama-4-scout-17b-16e-instruct",
          "llama-3.1-8b-instruct", 
          "llama-3.1-70b-instruct",
          "mixtral-8x7b-instruct",
          "gemma-7b-it"
        ],
        "default": "llama-4-scout-17b-16e-instruct"
      },
      "system_message": {
        "type": "string",
        "default": "You are a helpful AI assistant powered by Cerebras ultra-fast inference."
      },
      "temperature": {
        "type": "number",
        "minimum": 0,
        "maximum": 2,
        "default": 0.2
      },
      "max_tokens": {
        "type": "number",
        "minimum": 1,
        "maximum": 8192,
        "default": 2048
      },
      "top_p": {
        "type": "number",
        "minimum": 0,
        "maximum": 1,
        "default": 1
      },
      "stream": {
        "type": "boolean",
        "default": false
      }
    }
  }',
  '{
    "model": "llama-4-scout-17b-16e-instruct",
    "system_message": "You are a helpful AI assistant powered by Cerebras ultra-fast inference.",
    "temperature": 0.2,
    "max_tokens": 2048,
    "top_p": 1,
    "stream": false
  }'
),
(
  'cerebras-autogen',
  'CEREBRAS_AUTOGEN',
  'Cerebras AutoGen',
  'Multi-agent conversations powered by Cerebras ultra-fast inference. Perfect for collaborative AI workflows.',
  'multi-agent',
  'intermediate',
  4.8,
  75,
  ARRAY['Multi-agent conversations', 'Ultra-fast inference', 'Collaborative workflows', 'Custom agent roles'],
  ARRAY['multi-agent', 'ultra-fast', 'collaboration', 'autogen'],
  true,
  true,
  true,
  '{
    "type": "object",
    "properties": {
      "cerebras_api_key": {
        "type": "string",
        "description": "Cerebras API key"
      },
      "model": {
        "type": "string",
        "enum": [
          "llama-4-scout-17b-16e-instruct",
          "llama-3.1-8b-instruct",
          "llama-3.1-70b-instruct",
          "mixtral-8x7b-instruct"
        ],
        "default": "llama-4-scout-17b-16e-instruct"
      },
      "agents": {
        "type": "array",
        "minItems": 2,
        "items": {
          "type": "object",
          "properties": {
            "name": {"type": "string"},
            "role": {"type": "string"},
            "system_message": {"type": "string"}
          }
        }
      },
      "max_rounds": {
        "type": "number",
        "default": 5
      },
      "temperature": {
        "type": "number",
        "default": 0.2
      }
    }
  }',
  '{
    "model": "llama-4-scout-17b-16e-instruct",
    "agents": [
      {
        "name": "Assistant",
        "role": "helpful_assistant",
        "system_message": "You are a helpful AI assistant."
      },
      {
        "name": "Critic", 
        "role": "critic",
        "system_message": "You review and improve responses from other agents."
      }
    ],
    "max_rounds": 5,
    "temperature": 0.2
  }'
);

-- Add Cerebras configuration templates
INSERT INTO "saved_configurations" (
  id,
  name,
  description,
  framework,
  configuration,
  "isTemplate",
  "isPublic",
  "userId"
) VALUES 
(
  'cerebras-chatbot-template',
  'Cerebras Ultra-Fast Chatbot',
  'High-speed conversational AI powered by Cerebras inference for instant responses',
  'CEREBRAS',
  '{
    "model": "llama-4-scout-17b-16e-instruct",
    "system_message": "You are a helpful, fast, and efficient AI chatbot. Provide concise and accurate responses.",
    "temperature": 0.3,
    "max_tokens": 1024,
    "top_p": 0.9,
    "stream": true
  }',
  true,
  true,
  'system'
),
(
  'cerebras-code-assistant-template',
  'Cerebras Code Assistant',
  'Lightning-fast code analysis and generation with Cerebras acceleration',
  'CEREBRAS',
  '{
    "model": "llama-3.1-70b-instruct",
    "system_message": "You are an expert programming assistant. Provide clear, well-commented code and explanations. Focus on best practices and efficiency.",
    "temperature": 0.1,
    "max_tokens": 4096,
    "top_p": 0.95,
    "stream": false
  }',
  true,
  true,
  'system'
),
(
  'cerebras-research-team-template',
  'Cerebras Research Team',
  'Multi-agent research collaboration with ultra-fast processing',
  'CEREBRAS_AUTOGEN',
  '{
    "model": "llama-4-scout-17b-16e-instruct",
    "agents": [
      {
        "name": "Researcher",
        "role": "primary_researcher",
        "system_message": "You are a thorough researcher who gathers and analyzes information systematically."
      },
      {
        "name": "Analyst",
        "role": "data_analyst", 
        "system_message": "You analyze data and findings provided by the researcher, identifying patterns and insights."
      },
      {
        "name": "Reviewer",
        "role": "peer_reviewer",
        "system_message": "You critically review research findings and analysis, suggesting improvements and identifying potential issues."
      }
    ],
    "max_rounds": 6,
    "temperature": 0.2,
    "max_tokens": 2048
  }',
  true,
  true,
  'system'
),
(
  'cerebras-creative-team-template',
  'Cerebras Creative Team',
  'Multi-agent creative collaboration for content generation',
  'CEREBRAS_AUTOGEN',
  '{
    "model": "llama-3.1-8b-instruct",
    "agents": [
      {
        "name": "Creator",
        "role": "creative_writer",
        "system_message": "You are a creative writer who generates original ideas and content."
      },
      {
        "name": "Editor",
        "role": "content_editor",
        "system_message": "You edit and refine content, improving clarity, flow, and impact."
      },
      {
        "name": "Strategist",
        "role": "content_strategist",
        "system_message": "You provide strategic guidance on content direction and audience appeal."
      }
    ],
    "max_rounds": 4,
    "temperature": 0.7,
    "max_tokens": 1500
  }',
  true,
  true,
  'system'
);

-- Add package.json dependency for Cerebras SDK
-- Note: This would be added to your package.json file
-- "@cerebras/cloud-sdk": "^1.0.0"

-- Environment Variables (.env updates)
# Cerebras AI Configuration
CEREBRAS_API_KEY="your-cerebras-api-key-here"
CEREBRAS_BASE_URL="https://api.cerebras.ai/v1"

# Cerebras Pricing (per 1M tokens)
CEREBRAS_PROMPT_COST=0.0006
CEREBRAS_COMPLETION_COST=0.0006

-- lib/config/cerebras-config.ts
export interface CerebrasConfigOptions {
  apiKey: string
  baseUrl?: string
  defaultModel?: string
  timeout?: number
  maxRetries?: number
}

export class CerebrasConfig {
  private static instance: CerebrasConfig
  private config: CerebrasConfigOptions

  private constructor() {
    this.config = {
      apiKey: process.env.CEREBRAS_API_KEY || '',
      baseUrl: process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1',
      defaultModel: 'llama-4-scout-17b-16e-instruct',
      timeout: 60000, // 60 seconds
      maxRetries: 3
    }
  }

  static getInstance(): CerebrasConfig {
    if (!CerebrasConfig.instance) {
      CerebrasConfig.instance = new CerebrasConfig()
    }
    return CerebrasConfig.instance
  }

  getConfig(): CerebrasConfigOptions {
    return { ...this.config }
  }

  isConfigured(): boolean {
    return !!this.config.apiKey
  }

  getAvailableModels(): string[] {
    return [
      'llama-4-scout-17b-16e-instruct',
      'llama-3.1-8b-instruct',
      'llama-3.1-70b-instruct', 
      'mixtral-8x7b-instruct',
      'gemma-7b-it'
    ]
  }

  getModelInfo(model: string): {
    name: string
    contextWindow: number
    maxTokens: number
    description: string
    costPer1MTokens: number
  } {
    const modelInfo: Record<string, any> = {
      'llama-4-scout-17b-16e-instruct': {
        name: 'Llama 4 Scout 17B',
        contextWindow: 16384,
        maxTokens: 8192,
        description: 'Latest Llama 4 Scout model with ultra-fast inference',
        costPer1MTokens: 0.60
      },
      'llama-3.1-8b-instruct': {
        name: 'Llama 3.1 8B Instruct',
        contextWindow: 8192,
        maxTokens: 4096,
        description: 'Balanced performance and speed',
        costPer1MTokens: 0.60
      },
      'llama-3.1-70b-instruct': {
        name: 'Llama 3.1 70B Instruct',
        contextWindow: 8192,
        maxTokens: 4096,
        description: 'High-performance large model',
        costPer1MTokens: 0.60
      },
      'mixtral-8x7b-instruct': {
        name: 'Mixtral 8x7B Instruct',
        contextWindow: 32768,
        maxTokens: 4096,
        description: 'Mixture of experts architecture',
        costPer1MTokens: 0.60
      },
      'gemma-7b-it': {
        name: 'Gemma 7B IT',
        contextWindow: 8192,
        maxTokens: 4096,
        description: 'Google Gemma instruction-tuned model',
        costPer1MTokens: 0.60
      }
    }

    return modelInfo[model] || {
      name: model,
      contextWindow: 8192,
      maxTokens: 4096,
      description: 'High-performance model with ultra-fast inference',
      costPer1MTokens: 0.60
    }
  }
}

-- lib/hooks/useCerebrasModels.ts
import { useState, useEffect } from 'react'

interface CerebrasModel {
  id: string
  name: string
  description: string
  context_window: number
  max_tokens: number
}

export function useCerebrasModels() {
  const [models, setModels] = useState<CerebrasModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch('/api/ai-providers/cerebras/models')
        
        if (!response.ok) {
          throw new Error('Failed to fetch Cerebras models')
        }
        
        const data = await response.json()
        setModels(data.models)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchModels()
  }, [])

  const testConnection = async (apiKey?: string) => {
    try {
      const response = await fetch('/api/ai-providers/cerebras/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Test connection',
          api_key: apiKey
        })
      })

      const data = await response.json()
      return data
    } catch (error) {
      throw new Error('Connection test failed')
    }
  }

  return {
    models,
    loading,
    error,
    testConnection
  }
}

-- components/CerebrasModelSelector.tsx (React component)
import React from 'react'
import { useCerebrasModels } from '@/lib/hooks/useCerebrasModels'

interface CerebrasModelSelectorProps {
  selectedModel: string
  onModelChange: (model: string) => void
  disabled?: boolean
}

export function CerebrasModelSelector({ 
  selectedModel, 
  onModelChange, 
  disabled = false 
}: CerebrasModelSelectorProps) {
  const { models, loading, error } = useCerebrasModels()

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="text-sm text-gray-600">Loading Cerebras models...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
        Error loading models: {error}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Cerebras Model
      </label>
      <select
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name} - {model.description}
          </option>
        ))}
      </select>
      
      {selectedModel && (
        <div className="text-xs text-gray-500">
          {(() => {
            const model = models.find(m => m.id === selectedModel)
            return model ? (
              <div>
                Context: {model.context_window.toLocaleString()} tokens | 
                Max output: {model.max_tokens.toLocaleString()} tokens
              </div>
            ) : null
          })()}
        </div>
      )}
    </div>
  )
}

-- Update next.config.js to include Cerebras SDK
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@cerebras/cloud-sdk']
  },
  webpack: (config) => {
    config.externals.push({
      '@cerebras/cloud-sdk': 'commonjs @cerebras/cloud-sdk'
    })
    return config
  }
}

module.exports = nextConfig

-- Installation commands for package.json
{
  "dependencies": {
    "@cerebras/cloud-sdk": "^1.0.0",
    // ... other dependencies
  },
  "scripts": {
    "setup:cerebras": "echo 'Please add your CEREBRAS_API_KEY to your .env file'",
    "test:cerebras": "node scripts/test-cerebras.js"
  }
}

-- scripts/test-cerebras.js
const { Cerebras } = require('@cerebras/cloud-sdk')

async function testCerebrasConnection() {
  try {
    if (!process.env.CEREBRAS_API_KEY) {
      console.error('❌ CEREBRAS_API_KEY not found in environment variables')
      process.exit(1)
    }

    console.log('🧠 Testing Cerebras API connection...')

    const client = new Cerebras({
      apiKey: process.env.CEREBRAS_API_KEY
    })

    const response = await client.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: 'Hello! Please respond with "Cerebras connection successful!" to confirm the API is working.'
        }
      ],
      model: 'llama-4-scout-17b-16e-instruct',
      max_completion_tokens: 50,
      temperature: 0.1
    })

    console.log('✅ Connection successful!')
    console.log('Response:', response.choices[0].message.content)
    console.log('Model:', response.model)
    console.log('Tokens used:', response.usage.total_tokens)

  } catch (error) {
    console.error('❌ Connection failed:', error.message)
    process.exit(1)
  }
}

testCerebrasConnection()