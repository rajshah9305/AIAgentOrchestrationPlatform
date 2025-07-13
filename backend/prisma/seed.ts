import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed frameworks
  const frameworks = [
    {
      name: 'AUTOGEN',
      displayName: 'AutoGen',
      description: 'Multi-agent conversation framework with customizable agents that can collaborate to solve complex tasks.',
      category: 'multi-agent',
      difficulty: 'intermediate',
      rating: 4.4,
      growth: 16,
      features: ['Multi-agent conversations', 'Code execution', 'Human-in-the-loop'],
      tags: ['conversation', 'collaboration', 'microsoft'],
      isPopular: true,
      configSchema: {
        type: 'object',
        properties: {
          agents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                role: { type: 'string' },
                system_message: { type: 'string' }
              }
            }
          },
          llm_config: {
            type: 'object',
            properties: {
              model: { type: 'string' },
              temperature: { type: 'number' }
            }
          }
        }
      }
    },
    {
      name: 'CREWAI',
      displayName: 'CrewAI',
      description: 'Framework for orchestrating role-playing, autonomous AI agents to tackle complex tasks.',
      category: 'multi-agent',
      difficulty: 'intermediate',
      rating: 4.7,
      growth: 17,
      features: ['Role-playing agents', 'Task delegation', 'Hierarchical execution'],
      tags: ['role-playing', 'orchestration', 'tasks'],
      isPopular: true
    },
    {
      name: 'AUTOGPT',
      displayName: 'Auto-GPT',
      description: 'Autonomous GPT-4 agent that chains together LLM thoughts to autonomously achieve goals.',
      category: 'single-agent',
      difficulty: 'beginner',
      rating: 4.1,
      growth: 42,
      features: ['Autonomous execution', 'Goal-oriented', 'Memory management'],
      tags: ['autonomous', 'goal-oriented', 'gpt'],
      isPopular: true
    },
    {
      name: 'BABYAGI',
      displayName: 'BabyAGI',
      description: 'AI-powered task management system that creates, prioritizes, and executes tasks.',
      category: 'single-agent',
      difficulty: 'beginner',
      rating: 4.9,
      growth: 14,
      features: ['Task creation', 'Prioritization', 'Execution loop'],
      tags: ['task-management', 'simple', 'agi'],
      isPopular: true
    },
    {
      name: 'LANGGRAPH',
      displayName: 'LangGraph',
      description: 'Library for building stateful, multi-actor applications with LLMs using graph-based workflows.',
      category: 'multi-agent',
      difficulty: 'advanced',
      rating: 4.9,
      growth: 13,
      features: ['Graph workflows', 'State management', 'Multi-actor'],
      tags: ['graph', 'stateful', 'langchain'],
      isPopular: true
    }
  ]

  for (const framework of frameworks) {
    await prisma.framework.upsert({
      where: { name: framework.name },
      update: framework,
      create: framework
    })
  }

  // Seed a test user
  const user = await prisma.user.upsert({
    where: { email: 'test@agentorchestra.dev' },
    update: {},
    create: {
      email: 'test@agentorchestra.dev',
      name: 'Test User',
      role: 'ADMIN',
      isActive: true
    }
  })

  // Seed template configurations
  const templates = [
    {
      name: 'Customer Support Crew',
      description: 'A multi-agent team for handling customer support inquiries',
      framework: 'CREWAI',
      configuration: {
        agents: [
          {
            role: 'Customer Support Specialist',
            goal: 'Resolve customer inquiries efficiently and professionally',
            backstory: 'Expert in customer service with 5+ years experience'
          },
          {
            role: 'Technical Expert',
            goal: 'Provide technical solutions and troubleshooting',
            backstory: 'Senior engineer with deep product knowledge'
          }
        ],
        tasks: [
          {
            description: 'Analyze customer inquiry and categorize the issue',
            agent: 'Customer Support Specialist'
          },
          {
            description: 'Provide technical solution if needed',
            agent: 'Technical Expert'
          }
        ]
      },
      isTemplate: true,
      isPublic: true,
      userId: user.id
    },
    {
      name: 'Research Assistant',
      description: 'Autonomous agent for conducting research and analysis',
      framework: 'AUTOGPT',
      configuration: {
        role: 'Research Assistant',
        goals: [
          'Gather comprehensive information on given topics',
          'Analyze and summarize findings',
          'Provide actionable insights'
        ],
        tools: ['web_search', 'document_analysis', 'data_visualization']
      },
      isTemplate: true,
      isPublic: true,
      userId: user.id
    }
  ]

  for (const template of templates) {
    await prisma.savedConfiguration.upsert({
      where: { id: template.name.toLowerCase().replace(/ /g, '-') },
      update: template,
      create: {
        id: template.name.toLowerCase().replace(/ /g, '-'),
        ...template
      }
    })
  }

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 