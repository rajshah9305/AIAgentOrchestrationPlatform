// lib/websocket/websocket-server.ts
import { Server as SocketIOServer } from 'socket.io'
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executionEngine } from '@/lib/execution/execution-engine'

export interface SocketData {
  userId: string
  sessionId: string
}

export class WebSocketManager {
  private io: SocketIOServer
  private userSockets = new Map<string, Set<string>>() // userId -> socketIds

  constructor(server: any) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    })

    this.setupSocketHandlers()
    this.setupExecutionEngineListeners()
  }

  private setupSocketHandlers() {
    this.io.use(async (socket, next) => {
      try {
        // Authenticate socket connection
        const token = socket.handshake.auth.token
        if (!token) {
          return next(new Error('Authentication required'))
        }

        // Verify session token (implement your token verification here)
        const session = await this.verifySessionToken(token)
        if (!session) {
          return next(new Error('Invalid session'))
        }

        socket.data.userId = session.userId
        socket.data.sessionId = session.sessionId
        next()
      } catch (error) {
        next(new Error('Authentication failed'))
      }
    })

    this.io.on('connection', (socket) => {
      console.log(`User ${socket.data.userId} connected via WebSocket`)
      
      // Track user connections
      this.addUserSocket(socket.data.userId, socket.id)

      // Join user-specific room
      socket.join(`user:${socket.data.userId}`)

      // Handle client events
      socket.on('subscribe_agent', (agentId: string) => {
        this.handleAgentSubscription(socket, agentId)
      })

      socket.on('subscribe_execution', (executionId: string) => {
        this.handleExecutionSubscription(socket, executionId)
      })

      socket.on('unsubscribe_agent', (agentId: string) => {
        socket.leave(`agent:${agentId}`)
      })

      socket.on('unsubscribe_execution', (executionId: string) => {
        socket.leave(`execution:${executionId}`)
      })

      socket.on('disconnect', () => {
        console.log(`User ${socket.data.userId} disconnected`)
        this.removeUserSocket(socket.data.userId, socket.id)
      })

      // Send initial connection data
      this.sendInitialData(socket)
    })
  }

  private async handleAgentSubscription(socket: any, agentId: string) {
    try {
      // Verify user has access to this agent
      const agent = await prisma.agent.findFirst({
        where: {
          id: agentId,
          userId: socket.data.userId
        }
      })

      if (!agent) {
        socket.emit('error', { message: 'Agent not found or access denied' })
        return
      }

      socket.join(`agent:${agentId}`)
      
      // Send current agent status
      const currentExecution = await prisma.execution.findFirst({
        where: {
          agentId,
          status: { in: ['PENDING', 'RUNNING'] }
        },
        orderBy: { startedAt: 'desc' }
      })

      socket.emit('agent_status', {
        agentId,
        status: agent.status,
        currentExecution
      })

    } catch (error) {
      socket.emit('error', { message: 'Failed to subscribe to agent updates' })
    }
  }

  private async handleExecutionSubscription(socket: any, executionId: string) {
    try {
      // Verify user has access to this execution
      const execution = await prisma.execution.findFirst({
        where: {
          id: executionId,
          userId: socket.data.userId
        }
      })

      if (!execution) {
        socket.emit('error', { message: 'Execution not found or access denied' })
        return
      }

      socket.join(`execution:${executionId}`)

      // Send current execution status
      socket.emit('execution_status', execution)

      // Send recent logs
      const recentLogs = await prisma.executionLog.findMany({
        where: { executionId },
        orderBy: { timestamp: 'desc' },
        take: 50
      })

      socket.emit('execution_logs', {
        executionId,
        logs: recentLogs.reverse()
      })

    } catch (error) {
      socket.emit('error', { message: 'Failed to subscribe to execution updates' })
    }
  }

  private async sendInitialData(socket: any) {
    try {
      // Send user's active agents
      const activeAgents = await prisma.agent.findMany({
        where: {
          userId: socket.data.userId,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          status: true,
          framework: true
        }
      })

      // Send running executions
      const runningExecutions = await prisma.execution.findMany({
        where: {
          userId: socket.data.userId,
          status: { in: ['PENDING', 'RUNNING'] }
        },
        include: {
          agent: {
            select: { name: true, framework: true }
          }
        }
      })

      socket.emit('initial_data', {
        agents: activeAgents,
        runningExecutions
      })

    } catch (error) {
      console.error('Error sending initial data:', error)
    }
  }

  private setupExecutionEngineListeners() {
    // Listen to execution engine events and broadcast to connected clients
    executionEngine.on('started', (data) => {
      this.broadcastToExecution(data.executionId, 'execution_started', data)
    })

    executionEngine.on('log', (data) => {
      this.broadcastToExecution(data.executionId, 'execution_log', data)
    })

    executionEngine.on('progress', (data) => {
      this.broadcastToExecution(data.executionId, 'execution_progress', data)
    })

    executionEngine.on('statusChanged', (data) => {
      this.broadcastToExecution(data.executionId, 'execution_status_changed', data)
    })

    executionEngine.on('completed', (data) => {
      this.broadcastToExecution(data.executionId, 'execution_completed', data)
      this.updateAgentStatus(data.executionId, 'IDLE')
    })

    executionEngine.on('failed', (data) => {
      this.broadcastToExecution(data.executionId, 'execution_failed', data)
      this.updateAgentStatus(data.executionId, 'ERROR')
    })

    executionEngine.on('cancelled', (data) => {
      this.broadcastToExecution(data.executionId, 'execution_cancelled', data)
      this.updateAgentStatus(data.executionId, 'IDLE')
    })
  }

  private async updateAgentStatus(executionId: string, status: string) {
    try {
      const execution = await prisma.execution.findUnique({
        where: { id: executionId },
        include: { agent: true }
      })

      if (execution) {
        await prisma.agent.update({
          where: { id: execution.agentId },
          data: { status: status as any }
        })

        // Broadcast agent status update
        this.io.to(`agent:${execution.agentId}`).emit('agent_status_changed', {
          agentId: execution.agentId,
          status,
          timestamp: new Date()
        })
      }
    } catch (error) {
      console.error('Error updating agent status:', error)
    }
  }

  private broadcastToExecution(executionId: string, event: string, data: any) {
    this.io.to(`execution:${executionId}`).emit(event, data)
  }

  private broadcastToAgent(agentId: string, event: string, data: any) {
    this.io.to(`agent:${agentId}`).emit(event, data)
  }

  private broadcastToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data)
  }

  private addUserSocket(userId: string, socketId: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set())
    }
    this.userSockets.get(userId)!.add(socketId)
  }

  private removeUserSocket(userId: string, socketId: string) {
    const userSocketSet = this.userSockets.get(userId)
    if (userSocketSet) {
      userSocketSet.delete(socketId)
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId)
      }
    }
  }

  private async verifySessionToken(token: string) {
    // Implement your session token verification logic
    // This could involve JWT verification or database lookup
    try {
      // For now, assume token contains user session info
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
      return decoded
    } catch {
      return null
    }
  }

  // Public methods for broadcasting notifications
  public notifyUser(userId: string, notification: any) {
    this.broadcastToUser(userId, 'notification', notification)
  }

  public notifyAgentUpdate(agentId: string, update: any) {
    this.broadcastToAgent(agentId, 'agent_updated', update)
  }

  public broadcastSystemAlert(alert: any) {
    this.io.emit('system_alert', alert)
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.userSockets.keys())
  }

  public getUserConnectionCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0
  }
}

// Global WebSocket manager instance
let websocketManager: WebSocketManager | null = null

export function getWebSocketManager(): WebSocketManager | null {
  return websocketManager
}

export function initializeWebSocketManager(server: any): WebSocketManager {
  if (!websocketManager) {
    websocketManager = new WebSocketManager(server)
  }
  return websocketManager
}

// pages/api/socket.ts - Socket.io endpoint for Next.js
import { NextApiRequest, NextApiResponse } from 'next'
import { Server as NetServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { initializeWebSocketManager } from '@/lib/websocket/websocket-server'

export type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io: SocketIOServer
    }
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    console.log('Setting up Socket.IO server...')
    
    const websocketManager = initializeWebSocketManager(res.socket.server)
    res.socket.server.io = websocketManager['io']
  }

  res.end()
}

// lib/websocket/client.ts - Client-side WebSocket helper
export class WebSocketClient {
  private socket: any = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  async connect(token: string) {
    const { io } = await import('socket.io-client')
    
    this.socket = io({
      auth: { token },
      autoConnect: true
    })

    this.setupEventHandlers()
    return this.socket
  }

  private setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server')
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server')
      this.handleReconnect()
    })

    this.socket.on('connect_error', (error: any) => {
      console.error('WebSocket connection error:', error)
      this.handleReconnect()
    })
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
        this.socket.connect()
      }, this.reconnectDelay * this.reconnectAttempts)
    }
  }

  subscribeToAgent(agentId: string) {
    this.socket?.emit('subscribe_agent', agentId)
  }

  subscribeToExecution(executionId: string) {
    this.socket?.emit('subscribe_execution', executionId)
  }

  unsubscribeFromAgent(agentId: string) {
    this.socket?.emit('unsubscribe_agent', agentId)
  }

  unsubscribeFromExecution(executionId: string) {
    this.socket?.emit('unsubscribe_execution', executionId)
  }

  on(event: string, callback: Function) {
    this.socket?.on(event, callback)
  }

  off(event: string, callback?: Function) {
    this.socket?.off(event, callback)
  }

  disconnect() {
    this.socket?.disconnect()
  }
}

// hooks/useWebSocket.ts - React hook for WebSocket
import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { WebSocketClient } from '@/lib/websocket/client'

export function useWebSocket() {
  const { data: session } = useSession()
  const [isConnected, setIsConnected] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const clientRef = useRef<WebSocketClient | null>(null)

  useEffect(() => {
    if (session?.user) {
      const client = new WebSocketClient()
      clientRef.current = client

      // Create session token for WebSocket auth
      const token = Buffer.from(JSON.stringify({
        userId: session.user.id,
        sessionId: 'session-id' // Replace with actual session ID
      })).toString('base64')

      client.connect(token).then(() => {
        setIsConnected(true)

        // Setup event listeners
        client.on('connect', () => setIsConnected(true))
        client.on('disconnect', () => setIsConnected(false))
        
        client.on('notification', (notification: any) => {
          setNotifications(prev => [...prev, notification])
        })

        client.on('system_alert', (alert: any) => {
          // Handle system alerts
          console.warn('System Alert:', alert)
        })
      })

      return () => {
        client.disconnect()
        setIsConnected(false)
      }
    }
  }, [session])

  return {
    isConnected,
    notifications,
    client: clientRef.current,
    subscribeToAgent: (agentId: string) => clientRef.current?.subscribeToAgent(agentId),
    subscribeToExecution: (executionId: string) => clientRef.current?.subscribeToExecution(executionId),
    unsubscribeFromAgent: (agentId: string) => clientRef.current?.unsubscribeFromAgent(agentId),
    unsubscribeFromExecution: (executionId: string) => clientRef.current?.unsubscribeFromExecution(executionId)
  }
}