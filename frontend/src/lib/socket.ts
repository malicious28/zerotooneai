import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('token')
    socket = io(import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001', {
      auth: { token },
      autoConnect: true,
      reconnectionAttempts: 5,
    })
  }
  return socket
}

export function resetSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
