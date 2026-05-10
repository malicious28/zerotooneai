import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/database'
import { config } from '../config'
import { requireAuth } from '../middleware/auth'
import { DbUser, User, Group } from '../types'

const router = Router()

function makeToken(user: User): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: config.jwtExpiresIn })
}

function rowToUser(row: DbUser): User {
  return { id: row.id, email: row.email, name: row.name, role: row.role, group_id: row.group_id, created_at: row.created_at }
}

// ── Standard register ─────────────────────────────────────────────────────────

router.post('/register', (req: Request, res: Response) => {
  const { email, name, password } = req.body
  if (!email || !name || !password) { res.status(400).json({ error: 'email, name and password required' }); return }

  const db = getDb()
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    res.status(409).json({ error: 'Email already registered' }); return
  }

  const id = uuidv4()
  const password_hash = bcrypt.hashSync(password, 10)
  db.prepare('INSERT INTO users (id, email, name, role, password_hash) VALUES (?,?,?,?,?)').run(id, email, name, 'planner', password_hash)
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser
  const user = rowToUser(row)
  res.status(201).json({ token: makeToken(user), user })
})

// ── Register via invite link ──────────────────────────────────────────────────

router.post('/register/invite/:code', (req: Request, res: Response) => {
  const { email, name, password } = req.body
  if (!email || !name || !password) { res.status(400).json({ error: 'email, name and password required' }); return }

  const db = getDb()
  const group = db.prepare('SELECT * FROM groups WHERE invite_code = ?').get(req.params['code']) as Group | undefined
  if (!group) { res.status(404).json({ error: 'Invalid invite link' }); return }

  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    res.status(409).json({ error: 'Email already registered' }); return
  }

  const id = uuidv4()
  const password_hash = bcrypt.hashSync(password, 10)
  db.prepare('INSERT INTO users (id, email, name, role, password_hash, group_id) VALUES (?,?,?,?,?,?)').run(id, email, name, 'planner', password_hash, group.id)
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser
  const user = rowToUser(row)
  res.status(201).json({ token: makeToken(user), user, group })
})

// ── Login ─────────────────────────────────────────────────────────────────────

router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) { res.status(400).json({ error: 'email and password required' }); return }

  const db = getDb()
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as DbUser | undefined
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' }); return
  }

  const user = rowToUser(row)
  res.json({ token: makeToken(user), user })
})

// ── List all users (for conversation invite) ──────────────────────────────────

router.get('/users', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  const rows = db.prepare('SELECT id, name, email, role FROM users WHERE id != ? ORDER BY name ASC').all(req.user!.id) as any[]
  res.json({ users: rows })
})

// ── Me ────────────────────────────────────────────────────────────────────────

router.get('/me', requireAuth, (req: Request, res: Response) => {
  const db = getDb()
  // Re-fetch to get latest group_id in case it changed
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as DbUser | undefined
  if (!row) { res.status(404).json({ error: 'User not found' }); return }
  const user = rowToUser(row)

  // If planner, include group info
  let group: Group | null = null
  if (user.group_id) {
    group = db.prepare('SELECT g.*, u.name as admin_name FROM groups g JOIN users u ON g.admin_id = u.id WHERE g.id = ?').get(user.group_id) as Group
  }

  res.json({ user, group })
})

export default router
