import { Server as HttpServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { prisma } from '../lib/prisma'

let io: SocketIOServer | null = null

export const setupWebSocket = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  })

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`)

    // Handle authentication
    socket.on('authenticate', async (data) => {
      try {
        const { token } = data
        
        // Verify token (implement your token verification logic)
        const user = await verifyToken(token)
        
        if (user) {
          socket.data.userId = user.id
          socket.join(`user:${user.id}`)
          socket.emit('authenticated', { success: true })
          console.log(`User ${user.id} authenticated`)
        } else {
          socket.emit('authenticated', { success: false, error: 'Invalid token' })
        }
      } catch (error) {
        socket.emit('authenticated', { success: false, error: 'Authentication failed' })
      }
    })

    // Handle agent subscriptions
    socket.on('subscribe:agent', async (data) => {
      const { agentId } = data
      const userId = socket.data.userId
      
      if (!userId) {
        socket.emit('error', { message: 'Not authenticated' })
        return
      }

      try {
        // Verify user has access to this agent
        const agent = await prisma.agent.findFirst({
          where: { id: agentId, userId }
        })

        if (agent) {
          socket.join(`agent:${agentId}`)
          socket.emit('subscribed:agent', { agentId, success: true })
          
          // Send current agent status
          socket.emit('agent:status', {
            agentId,
            status: agent.status,
            lastExecutedAt: agent.lastExecutedAt
          })
        } else {
          socket.emit('error', { message: 'Agent not found or access denied' })
        }
      } catch (error) {
        socket.emit('error', { message: 'Failed to subscribe to agent' })
      }
    })

    // Handle execution subscriptions
    socket.on('subscribe:execution', async (data) => {
      const { executionId } = data
      const userId = socket.data.userId
      
      if (!userId) {
        socket.emit('error', { message: 'Not authenticated' })
        return
      }

      try {
        // Verify user has access to this execution
        const execution = await prisma.execution.findFirst({
          where: { id: executionId, userId }
        })

        if (execution) {
          socket.join(`execution:${executionId}`)
          socket.emit('subscribed:execution', { executionId, success: true })
          
          // Send current execution status
          socket.emit('execution:status', {
            executionId,
            status: execution.status,
            progress: execution.progress || 0
          })
        } else {
          socket.emit('error', { message: 'Execution not found or access denied' })
        }
      } catch (error) {
        socket.emit('error', { message: 'Failed to subscribe to execution' })
      }
    })

    // Handle unsubscriptions
    socket.on('unsubscribe:agent', (data) => {
      const { agentId } = data
      socket.leave(`agent:${agentId}`)
      socket.emit('unsubscribed:agent', { agentId })
    })

    socket.on('unsubscribe:execution', (data) => {
      const { executionId } = data
      socket.leave(`execution:${executionId}`)
      socket.emit('unsubscribed:execution', { executionId })
    })

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`)
    })
  })

  return io
}

// Helper function to verify JWT token
async function verifyToken(token: string) {
  try {
    // Implement your JWT verification logic here
    // For now, return a mock user
    return { id: 'user-123' }
  } catch (error) {
    return null
  }
}

// Export functions to emit events
export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data)
  }
}

export const emitToAgent = (agentId: string, event: string, data: any) => {
  if (io) {
    io.to(`agent:${agentId}`).emit(event, data)
  }
}

export const emitToExecution = (executionId: string, event: string, data: any) => {
  if (io) {
    io.to(`execution:${executionId}`).emit(event, data)
  }
}

export const emitToAll = (event: string, data: any) => {
  if (io) {
    io.emit(event, data)
  }
}

export const getConnectedUsers = () => {
  if (!io) return []
  
  const users = new Set<string>()
  io.sockets.sockets.forEach((socket) => {
    if (socket.data.userId) {
      users.add(socket.data.userId)
    }
  })
  
  return Array.from(users)
}