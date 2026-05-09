import { Server as HttpServer } from 'http'
import { Server as SocketServer, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { config } from './config'
import { User } from './types'

let io: SocketServer

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  })

  // Auth middleware — verify JWT on every connection
  io.use((socket, next) => {
    const token = socket.handshake.auth['token'] as string | undefined
    if (!token) { next(new Error('No token')); return }
    try {
      const user = jwt.verify(token, config.jwtSecret) as User
      ;(socket as any).user = user
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as User

    // Join a group room to receive real-time group chat messages
    socket.on('join_group', (groupId: string) => {
      socket.join(`group:${groupId}`)
    })

    // Join a conversation room for collaborative AI chat
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`)
      socket.to(`conversation:${conversationId}`).emit('conv:participant_joined', {
        user_id: user.id,
        name: user.name,
      })
    })

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`)
      socket.to(`conversation:${conversationId}`).emit('conv:participant_left', {
        user_id: user.id,
        name: user.name,
      })
    })

    // Typing indicator for group chat
    socket.on('group:typing', ({ groupId, isTyping }: { groupId: string; isTyping: boolean }) => {
      socket.to(`group:${groupId}`).emit('group:user_typing', { user_id: user.id, name: user.name, isTyping })
    })

    socket.on('disconnect', () => {})
  })

  return io
}

export function getIo(): SocketServer {
  if (!io) throw new Error('Socket not initialized')
  return io
}

// Helpers called by route handlers
export function emitGroupMessage(groupId: string, message: any) {
  getIo().to(`group:${groupId}`).emit('group:message', message)
}

export function emitGroupAudienceExport(groupId: string, message: any) {
  getIo().to(`group:${groupId}`).emit('group:audience_export', message)
}

export function emitConvMessage(conversationId: string, message: any) {
  getIo().to(`conversation:${conversationId}`).emit('conv:message', message)
}

export function emitConvAiThinking(conversationId: string, thinking: boolean) {
  getIo().to(`conversation:${conversationId}`).emit('conv:ai_thinking', { thinking })
}

export function emitConvInvite(userId: string, payload: { conversationId: string; conversationTitle: string; invitedBy: string }) {
  getIo().to(`user:${userId}`).emit('conv:invite', payload)
}

export function joinUserRoom(socket: Socket, userId: string) {
  socket.join(`user:${userId}`)
}
