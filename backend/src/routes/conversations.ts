import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/database'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { Conversation, ConversationSignals, AudienceSignal, Message } from '../types'

const router = Router()
router.use(requireAuth)

// List conversations (admin sees all, planner sees own)
router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  let rows: Conversation[]
  if (req.user!.role === 'admin') {
    rows = db.prepare(`
      SELECT c.*, u.name as user_name, u.email as user_email,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
      FROM conversations c JOIN users u ON c.user_id = u.id
      ORDER BY c.updated_at DESC
    `).all() as Conversation[]
  } else {
    rows = db.prepare(`
      SELECT DISTINCT c.*,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
      FROM conversations c
      LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id
      WHERE c.user_id = ? OR cp.user_id = ?
      ORDER BY c.updated_at DESC
    `).all(req.user!.id, req.user!.id) as Conversation[]
  }
  res.json({ conversations: rows })
})

// Create conversation
router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?,?,?,?,?)').run(id, req.user!.id, 'New Audience', now, now)
  db.prepare('INSERT INTO conversation_signals (conversation_id, signals) VALUES (?,?)').run(id, '[]')
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation
  res.status(201).json({ conversation: conv })
})

// Get single conversation with messages
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params['id']) as Conversation | undefined
  if (!conv) { res.status(404).json({ error: 'Not found' }); return }

  // Allow: owner, admin, or invited participant
  const isParticipant = db.prepare('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?').get(req.params['id'], req.user!.id)
  if (req.user!.role !== 'admin' && conv.user_id !== req.user!.id && !isParticipant) {
    res.status(403).json({ error: 'Forbidden' }); return
  }

  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(req.params['id']) as Message[]
  const parsedMessages = messages.map(m => ({ ...m, metadata: m.metadata ? JSON.parse(m.metadata as any) : null }))
  const sigRow = db.prepare('SELECT * FROM conversation_signals WHERE conversation_id = ?').get(req.params['id']) as any
  const signals: ConversationSignals = sigRow ? { conversation_id: req.params['id'], signals: JSON.parse(sigRow.signals), is_confirmed: !!sigRow.is_confirmed, updated_at: sigRow.updated_at } : { conversation_id: req.params['id'], signals: [], is_confirmed: false, updated_at: conv.updated_at }
  const participants = db.prepare(`SELECT u.id as user_id, u.name, u.email, cp.joined_at FROM conversation_participants cp JOIN users u ON cp.user_id = u.id WHERE cp.conversation_id = ?`).all(req.params['id'])
  res.json({ conversation: conv, messages: parsedMessages, signals, participants })
})

// Update title
router.patch('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params['id']) as Conversation | undefined
  if (!conv) { res.status(404).json({ error: 'Not found' }); return }
  if (req.user!.role !== 'admin' && conv.user_id !== req.user!.id) {
    res.status(403).json({ error: 'Forbidden' }); return
  }
  const { title, status } = req.body
  const now = new Date().toISOString()
  if (title) db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?').run(title, now, req.params['id'])
  if (status) db.prepare('UPDATE conversations SET status = ?, updated_at = ? WHERE id = ?').run(status, now, req.params['id'])
  res.json({ ok: true })
})

// Confirm signals
router.post('/:id/confirm', (req: Request, res: Response) => {
  const db = getDb()
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params['id']) as Conversation | undefined
  if (!conv) { res.status(404).json({ error: 'Not found' }); return }
  if (req.user!.role !== 'admin' && conv.user_id !== req.user!.id) {
    res.status(403).json({ error: 'Forbidden' }); return
  }
  const now = new Date().toISOString()
  db.prepare('UPDATE conversation_signals SET is_confirmed = 1, updated_at = ? WHERE conversation_id = ?').run(now, req.params['id'])
  db.prepare('UPDATE conversations SET status = ?, updated_at = ? WHERE id = ?').run('completed', now, req.params['id'])
  res.json({ ok: true })
})

// Delete conversation (owner or admin)
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params['id']) as Conversation | undefined
  if (!conv) { res.status(404).json({ error: 'Not found' }); return }
  if (req.user!.role !== 'admin' && conv.user_id !== req.user!.id) {
    res.status(403).json({ error: 'Forbidden' }); return
  }
  db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(req.params['id'])
  db.prepare('DELETE FROM conversation_signals WHERE conversation_id = ?').run(req.params['id'])
  db.prepare('DELETE FROM conversation_participants WHERE conversation_id = ?').run(req.params['id'])
  db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params['id'])
  res.json({ ok: true })
})

// Admin: list all confirmed audiences
router.get('/admin/confirmed', requireAdmin, (req: Request, res: Response) => {
  const db = getDb()
  const rows = db.prepare(`
    SELECT c.*, u.name as user_name, u.email as user_email, cs.signals, cs.updated_at as confirmed_at
    FROM conversations c
    JOIN users u ON c.user_id = u.id
    JOIN conversation_signals cs ON cs.conversation_id = c.id
    WHERE c.status = 'completed' AND cs.is_confirmed = 1
    ORDER BY cs.updated_at DESC
  `).all() as any[]
  const result = rows.map(r => ({ ...r, signals: JSON.parse(r.signals) }))
  res.json({ audiences: result })
})

export default router
