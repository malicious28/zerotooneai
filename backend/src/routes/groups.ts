import { Router, Request, Response } from 'express'
import { randomBytes } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/database'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { Group, GroupMessage } from '../types'
import { emitGroupMessage, emitGroupAudienceExport } from '../socket'

const router = Router()

function generateInviteCode(): string {
  return randomBytes(8).toString('base64url').slice(0, 12)
}

// ── Admin: create a group ─────────────────────────────────────────────────────

router.post('/', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const { name } = req.body
  if (!name?.trim()) { res.status(400).json({ error: 'Group name required' }); return }

  const db = getDb()
  const id = uuidv4()
  const invite_code = generateInviteCode()
  db.prepare('INSERT INTO groups (id, name, admin_id, invite_code) VALUES (?,?,?,?)').run(id, name.trim(), req.user!.id, invite_code)

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group
  res.status(201).json({ group, invite_code })
})

// ── Admin: list own groups ────────────────────────────────────────────────────

router.get('/', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const groups = db.prepare(`
    SELECT g.*, u.name as admin_name,
      (SELECT COUNT(*) FROM users WHERE group_id = g.id) as member_count
    FROM groups g JOIN users u ON g.admin_id = u.id
    ORDER BY g.created_at DESC
  `).all() as Group[]
  res.json({ groups })
})

// ── Get group by invite code (public — used on join page) ─────────────────────

router.get('/invite/:code', (req: Request, res: Response) => {
  const db = getDb()
  const group = db.prepare(`
    SELECT g.id, g.name, g.invite_code, u.name as admin_name,
      (SELECT COUNT(*) FROM users WHERE group_id = g.id) as member_count
    FROM groups g JOIN users u ON g.admin_id = u.id
    WHERE g.invite_code = ?
  `).get(req.params['code']) as Group | undefined

  if (!group) { res.status(404).json({ error: 'Invalid invite link' }); return }
  res.json({ group })
})

// ── Regenerate invite code ────────────────────────────────────────────────────

router.post('/:id/regenerate-invite', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const db = getDb()
  const group = db.prepare('SELECT * FROM groups WHERE id = ? AND admin_id = ?').get(req.params['id'], req.user!.id) as Group | undefined
  if (!group) { res.status(404).json({ error: 'Group not found' }); return }

  const invite_code = generateInviteCode()
  db.prepare('UPDATE groups SET invite_code = ? WHERE id = ?').run(invite_code, req.params['id'])
  res.json({ invite_code })
})

// ── Get group members ─────────────────────────────────────────────────────────

router.get('/:id/members', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params['id']) as Group | undefined
  if (!group) { res.status(404).json({ error: 'Group not found' }); return }

  // Only admin of the group or members can see members
  const isMember = req.user!.group_id === req.params['id']
  const isGroupAdmin = group.admin_id === req.user!.id
  if (!isMember && !isGroupAdmin) { res.status(403).json({ error: 'Forbidden' }); return }

  const members = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE group_id = ?').all(req.params['id'])
  res.json({ members })
})

// ── Group chat: get messages ──────────────────────────────────────────────────

router.get('/:id/messages', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params['id']) as Group | undefined
  if (!group) { res.status(404).json({ error: 'Group not found' }); return }

  const isMember = req.user!.group_id === req.params['id']
  const isGroupAdmin = group.admin_id === req.user!.id
  if (!isMember && !isGroupAdmin) { res.status(403).json({ error: 'Forbidden' }); return }

  const since = req.query['since'] as string | undefined
  const messages = since
    ? db.prepare(`
        SELECT gm.*, u.name as user_name FROM group_messages gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ? AND gm.created_at > ?
        ORDER BY gm.created_at ASC LIMIT 100
      `).all(req.params['id'], since)
    : db.prepare(`
        SELECT gm.*, u.name as user_name FROM group_messages gm
        JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ?
        ORDER BY gm.created_at ASC LIMIT 200
      `).all(req.params['id'])

  const parsed = (messages as any[]).map(m => ({
    ...m,
    metadata: m.metadata ? JSON.parse(m.metadata) : null,
  }))
  res.json({ messages: parsed })
})

// ── Group chat: send message ──────────────────────────────────────────────────

router.post('/:id/messages', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params['id']) as Group | undefined
  if (!group) { res.status(404).json({ error: 'Group not found' }); return }

  const isMember = req.user!.group_id === req.params['id']
  const isGroupAdmin = group.admin_id === req.user!.id
  if (!isMember && !isGroupAdmin) { res.status(403).json({ error: 'Forbidden' }); return }

  const { content } = req.body
  if (!content?.trim()) { res.status(400).json({ error: 'content required' }); return }

  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO group_messages (id, group_id, user_id, content, type, created_at) VALUES (?,?,?,?,?,?)')
    .run(id, req.params['id'], req.user!.id, content.trim(), 'text', now)

  const msg = db.prepare(`
    SELECT gm.*, u.name as user_name FROM group_messages gm
    JOIN users u ON gm.user_id = u.id WHERE gm.id = ?
  `).get(id) as GroupMessage
  const payload = { ...msg, metadata: null }
  emitGroupMessage(req.params['id'], payload)
  res.status(201).json({ message: payload })
})

// ── Admin: delete a group ─────────────────────────────────────────────────────

router.delete('/:id', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const db = getDb()
  const group = db.prepare('SELECT * FROM groups WHERE id = ? AND admin_id = ?').get(req.params['id'], req.user!.id) as Group | undefined
  if (!group) { res.status(404).json({ error: 'Group not found' }); return }

  db.prepare('DELETE FROM group_messages WHERE group_id = ?').run(req.params['id'])
  db.prepare('UPDATE users SET group_id = NULL WHERE group_id = ?').run(req.params['id'])
  db.prepare('DELETE FROM groups WHERE id = ?').run(req.params['id'])
  res.json({ ok: true })
})

// ── Export audience to group chat ─────────────────────────────────────────────

router.post('/:id/export-audience', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params['id']) as Group | undefined
  if (!group) { res.status(404).json({ error: 'Group not found' }); return }

  const isMember = req.user!.group_id === req.params['id']
  const isGroupAdmin = group.admin_id === req.user!.id
  if (!isMember && !isGroupAdmin) { res.status(403).json({ error: 'Forbidden' }); return }

  const { conversation_id, title, signals, audience_estimate } = req.body
  if (!conversation_id || !signals) { res.status(400).json({ error: 'conversation_id and signals required' }); return }

  const id = uuidv4()
  const now = new Date().toISOString()
  const metadata = { conversation_id, title, signals, audience_estimate }
  const content = `Audience exported: ${title}`

  db.prepare('INSERT INTO group_messages (id, group_id, user_id, content, type, metadata, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, req.params['id'], req.user!.id, content, 'audience_export', JSON.stringify(metadata), now)

  const msg = db.prepare(`
    SELECT gm.*, u.name as user_name FROM group_messages gm
    JOIN users u ON gm.user_id = u.id WHERE gm.id = ?
  `).get(id) as any
  const payload = { ...msg, metadata }
  emitGroupAudienceExport(req.params['id'], payload)
  res.status(201).json({ message: payload })
})

export default router
