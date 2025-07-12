// frontend/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Agent Orchestrator',
  description: 'Ultra-fast AI agent management platform with Cerebras integration',
  keywords: ['AI', 'agents', 'orchestration', 'Cerebras', 'automation'],
  authors: [{ name: 'AI Agent Orchestrator Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
  openGraph: {
    title: 'AI Agent Orchestrator',
    description: 'Ultra-fast AI agent management platform',
    type: 'website',
    url: process.env.NEXT_PUBLIC_FRONTEND_URL,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased`}>
        <div className="min-h-screen bg-background text-foreground">
          {children}
        </div>
      </body>
    </html>
  )
}

// ---

// frontend/app/page.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-16">
      <div className="text-center mb-16">
        <h1 className="text-6xl font-bold gradient-text mb-6">
          AI Agent Orchestrator
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Ultra-fast AI agent management platform with Cerebras integration. 
          Build, deploy, and monitor AI agents with lightning speed.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/dashboard">Get Started</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/docs">Documentation</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⚡ Ultra-Fast Performance
            </CardTitle>
            <CardDescription>
              50x faster than traditional AI APIs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>• Sub-second response times</li>
              <li>• 2000+ tokens/second processing</li>
              <li>• Real-time streaming responses</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💰 Cost-Effective
            </CardTitle>
            <CardDescription>
              $0.60 per 1M tokens vs $30 for GPT-4
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>• 50x cheaper than premium models</li>
              <li>• Transparent cost tracking</li>
              <li>• Usage analytics dashboard</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🤖 Multi-Framework Support
            </CardTitle>
            <CardDescription>
              Support for all major AI frameworks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>• AutoGen, CrewAI, LangGraph</li>
              <li>• Cerebras ultra-fast inference</li>
              <li>• Custom framework integration</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        <h2 className="text-3xl font-bold mb-8">Ready to Get Started?</h2>
        <div className="bg-card border rounded-lg p-8 max-w-2xl mx-auto">
          <h3 className="text-xl font-semibold mb-4">Quick Setup</h3>
          <div className="text-left space-y-2 text-sm font-mono bg-muted p-4 rounded">
            <div>git clone your-repo</div>
            <div>cd ai-agent-orchestrator</div>
            <div>chmod +x scripts/setup.sh</div>
            <div>./scripts/setup.sh</div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Your AI agent platform will be ready in minutes!
          </p>
        </div>
      </div>
    </main>
  )
}

// ---

// frontend/app/globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 24 100% 55%;
    --primary-foreground: 0 0% 98%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 24 100% 55%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@layer components {
  .gradient-text {
    @apply bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent;
  }
  
  .card-glow {
    @apply shadow-lg shadow-orange-500/10 border-orange-500/20;
  }
  
  .btn-glow {
    @apply shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-shadow;
  }
}

// ---

// frontend/app/dashboard/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Agent {
  id: string
  name: string
  framework: string
  status: string
  totalExecutions: number
  lastExecutedAt: string | null
}

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Mock data for now - replace with actual API call
    setTimeout(() => {
      setAgents([
        {
          id: '1',
          name: 'Customer Support Bot',
          framework: 'CEREBRAS',
          status: 'IDLE',
          totalExecutions: 142,
          lastExecutedAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Content Generator',
          framework: 'CEREBRAS_AUTOGEN',
          status: 'RUNNING',
          totalExecutions: 89,
          lastExecutedAt: new Date().toISOString(),
        },
      ])
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-500">
          <p>Error loading dashboard: {error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your AI agents and monitor performance
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents.length}</div>
            <p className="text-xs text-muted-foreground">+2 from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents.reduce((sum, agent) => sum + agent.totalExecutions, 0)}
            </div>
            <p className="text-xs text-muted-foreground">+15% from last week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0.5s</div>
            <p className="text-xs text-muted-foreground">50x faster than traditional APIs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$1,247</div>
            <p className="text-xs text-muted-foreground">vs traditional AI APIs</p>
          </CardContent>
        </Card>
      </div>

      {/* Agents List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Agents</CardTitle>
              <CardDescription>
                Manage and monitor your AI agents
              </CardDescription>
            </div>
            <Button>Create Agent</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div>
                    <h3 className="font-medium">{agent.name}</h3>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <span>{agent.framework}</span>
                      <span>•</span>
                      <span>{agent.totalExecutions} executions</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={agent.status === 'RUNNING' ? 'default' : 'secondary'}
                  >
                    {agent.status}
                  </Badge>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---

// frontend/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatNumber(num: number) {
  return new Intl.NumberFormat('en-US').format(num)
}

// ---

// frontend/components/ui/button.tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }