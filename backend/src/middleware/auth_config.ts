// lib/auth.ts
import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import DiscordProvider from 'next-auth/providers/discord'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        // Save user to database if first time
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! }
        })

        if (!existingUser) {
          const newUser = await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              image: user.image,
            }
          })
          token.userId = newUser.id
        } else {
          token.userId = existingUser.id
          
          // Update last login
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { lastLoginAt: new Date() }
          })
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string
        
        // Get user role and subscription
        const user = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: { role: true, subscription: true }
        })
        
        if (user) {
          session.user.role = user.role
          session.user.subscription = user.subscription
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  events: {
    async signIn({ user, account, profile }) {
      // Log sign-in event
      if (user.id) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'USER_LOGIN',
            resourceType: 'USER',
            resourceId: user.id,
            details: {
              provider: account?.provider,
              ip: 'unknown' // You can capture this from request headers
            }
          }
        })
      }
    },
    async signOut({ session }) {
      // Log sign-out event
      if (session?.user?.id) {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'USER_LOGOUT',
            resourceType: 'USER',
            resourceId: session.user.id,
            details: {}
          }
        })
      }
    }
  }
}

// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }

// app/api/configurations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const configSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  framework: z.enum([
    'autogen', 'metagpt', 'crewai', 'autogpt', 'babyagi', 
    'langgraph', 'camelai', 'agentverse', 'openagents', 'miniagi', 'orca',
    'cerebras', 'cerebras-autogen'
  ]),
  configuration: z.record(z.any()),
  isTemplate: z.boolean().default(false),
  isPublic: z.boolean().default(false)
})

// GET /api/configurations - List saved configurations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const framework = searchParams.get('framework')
    const isTemplate = searchParams.get('template') === 'true'
    const isPublic = searchParams.get('public') === 'true'
    const search = searchParams.get('search')

    const where = {
      OR: [
        { userId: session.user.id },
        ...(isPublic ? [{ isPublic: true }] : [])
      ],
      ...(framework && { framework }),
      ...(isTemplate && { isTemplate }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      })
    }

    const configurations = await prisma.savedConfiguration.findMany({
      where,
      orderBy: [
        { usageCount: 'desc' },
        { updatedAt: 'desc' }
      ],
      include: {
        user: {
          select: { name: true, image: true }
        }
      }
    })

    return NextResponse.json({ configurations })

  } catch (error) {
    console.error('Error fetching configurations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/configurations - Save new configuration
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = configSchema.parse(body)

    // Check if name already exists for user
    const existing = await prisma.savedConfiguration.findFirst({
      where: {
        userId: session.user.id,
        name: data.name
      }
    })

    if (existing) {
      return NextResponse.json({ 
        error: 'Configuration with this name already exists' 
      }, { status: 409 })
    }

    const configuration = await prisma.savedConfiguration.create({
      data: {
        ...data,
        userId: session.user.id
      }
    })

    // Log configuration creation
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CONFIG_SAVED',
        resourceType: 'CONFIGURATION',
        resourceId: configuration.id,
        details: {
          name: configuration.name,
          framework: configuration.framework
        }
      }
    })

    return NextResponse.json(configuration, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: error.errors 
      }, { status: 400 })
    }

    console.error('Error saving configuration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// app/api/configurations/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configuration = await prisma.savedConfiguration.findFirst({
      where: {
        id: params.id,
        OR: [
          { userId: session.user.id },
          { isPublic: true }
        ]
      },
      include: {
        user: {
          select: { name: true, image: true }
        }
      }
    })

    if (!configuration) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    // Increment usage count
    await prisma.savedConfiguration.update({
      where: { id: params.id },
      data: { usageCount: { increment: 1 } }
    })

    return NextResponse.json(configuration)

  } catch (error) {
    console.error('Error fetching configuration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/configurations/[id] - Update configuration
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
    const data = configSchema.partial().parse(body)

    const configuration = await prisma.savedConfiguration.updateMany({
      where: {
        id: params.id,
        userId: session.user.id
      },
      data
    })

    if (configuration.count === 0) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    const updatedConfig = await prisma.savedConfiguration.findUnique({
      where: { id: params.id }
    })

    return NextResponse.json(updatedConfig)

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: error.errors 
      }, { status: 400 })
    }

    console.error('Error updating configuration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/configurations/[id] - Delete configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configuration = await prisma.savedConfiguration.deleteMany({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (configuration.count === 0) {
      return NextResponse.json({ error: 'Configuration not found' }, { status: 404 })
    }

    // Log configuration deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CONFIG_DELETED',
        resourceType: 'CONFIGURATION',
        resourceId: params.id,
        details: {}
      }
    })

    return NextResponse.json({ message: 'Configuration deleted successfully' })

  } catch (error) {
    console.error('Error deleting configuration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// app/api/configurations/templates/route.ts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const framework = searchParams.get('framework')

    const where = {
      isTemplate: true,
      isPublic: true,
      ...(framework && { framework })
    }

    const templates = await prisma.savedConfiguration.findMany({
      where,
      orderBy: { usageCount: 'desc' },
      include: {
        user: {
          select: { name: true, image: true }
        }
      }
    })

    return NextResponse.json({ templates })

  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

export const prisma = globalThis.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

// middleware.ts
import { withAuth } from 'next-auth/middleware'

export default withAuth(
  function middleware(req) {
    // Add any additional middleware logic here
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Protect API routes
        if (req.nextUrl.pathname.startsWith('/api/')) {
          return !!token
        }
        
        // Protect dashboard routes
        if (req.nextUrl.pathname.startsWith('/dashboard')) {
          return !!token
        }
        
        return true
      },
    },
  }
)

export const config = {
  matcher: [
    '/api/((?!auth|health).*)/:path*',
    '/dashboard/:path*'
  ]
}