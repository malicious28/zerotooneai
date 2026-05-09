import http from 'http'
import express from 'express'
import cors from 'cors'
import { config } from './config'
import { getDb } from './db/database'
import { getAllSignals } from './data/loader'
import { buildEmbeddingCache } from './data/embeddings'
import { initSocket } from './socket'
import authRoutes from './routes/auth'
import conversationRoutes from './routes/conversations'
import chatRoutes from './routes/chat'
import groupRoutes from './routes/groups'

const app = express()
const httpServer = http.createServer(app)

app.use(cors())
app.use(express.json())

// Init DB, taxonomy and socket
getDb()
getAllSignals()
initSocket(httpServer)

// Build embedding cache in background — keyword search used as fallback until ready
buildEmbeddingCache().catch(err => console.warn('[embeddings] Failed to build cache:', err.message))

app.use('/api/auth', authRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/groups', groupRoutes)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

httpServer.listen(config.port, () => {
  console.log(`Server running on port ${config.port} [${config.nodeEnv}]`)
})
