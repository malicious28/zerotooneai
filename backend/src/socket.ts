import { Server as HttpServer } from 'http'
import { Server as SocketServer, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { config } from './config'
import { User } from './types'

let io: SocketServer

export function initSocket(httpServer: HttpServer): SocketServer {
  const frontendUrl = config.frontendUrl
  const socketCorsOrigin = frontendUrl
    ? frontendUrl.startsWith('http') ? frontendUrl : `https://${frontendUrl}`
    : '*'

  io = new SocketServer(httpServer, {
    cors: {
      origin: socketCorsOrigin,
      methods: ['GET', 'POST'],
    },
  })

  // ── JWT auth middleware ───────────────────────────────────────────────────────
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

    // ── Join the user's personal room immediately so invite notifications work ──
    socket.join(`user:${user.id}`)

    // ── Group room ────────────────────────────────────────────────────────────
    socket.on('join_group', (groupId: string) => {
      socket.join(`group:${groupId}`)
    })

    // ── Conversation room ─────────────────────────────────────────────────────
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

    // ── Group typing indicator ────────────────────────────────────────────────
    socket.on('group:typing', ({ groupId, isTyping }: { groupId: string; isTyping: boolean }) => {
      socket.to(`group:${groupId}`).emit('group:user_typing', {
        user_id: user.id,
        name: user.name,
        isTyping,
      })
    })

    socket.on('disconnect', () => {})
  })

  return io
}

export function getIo(): SocketServer {
  if (!io) throw new Error('Socket not initialized')
  return io
}

// ── Emit helpers called by route handlers ─────────────────────────────────────

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

/** Broadcast updated signals + estimate to all participants in a conversation */
export function emitConvSignalsUpdated(conversationId: string, signals: any[], estimate: any) {
  getIo().to(`conversation:${conversationId}`).emit('conv:signals_updated', { signals, audience_estimate: estimate })
}

/** Notify a specific user of a conversation invite */
export function emitConvInvite(
  userId: string,
  payload: { conversationId: string; conversationTitle: string; invitedBy: string },
) {
  getIo().to(`user:${userId}`).emit('conv:invite', payload)
}
