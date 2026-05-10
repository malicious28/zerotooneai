import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { config } from '../config'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(config.databasePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    // On first run with a fresh persistent disk, seed from the committed db snapshot
    if (!fs.existsSync(config.databasePath)) {
      const seedPath = path.resolve(__dirname, '../../data/audience_builder.db')
      if (fs.existsSync(seedPath) && seedPath !== config.databasePath) {
        fs.copyFileSync(seedPath, config.databasePath)
        console.log('[db] Seeded persistent database from committed snapshot')
      }
    }

    db = new Database(config.databasePath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      invite_code TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'planner')),
      password_hash TEXT NOT NULL,
      group_id TEXT REFERENCES groups(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL DEFAULT 'New Audience',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed')),
      rejected_signals TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      metadata TEXT,
      sender_id TEXT,
      sender_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversation_signals (
      conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
      signals TEXT NOT NULL DEFAULT '[]',
      is_confirmed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (conversation_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS group_messages (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'audience_export')),
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_groups (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, group_id)
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id);
    CREATE INDEX IF NOT EXISTS idx_users_group ON users(group_id);
    CREATE INDEX IF NOT EXISTS idx_conv_participants ON conversation_participants(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_user_groups_user ON user_groups(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_groups_group ON user_groups(group_id);
  `)

  // Migrations for existing databases (safe to run repeatedly)
  const migrations = [
    'ALTER TABLE messages ADD COLUMN sender_id TEXT',
    'ALTER TABLE messages ADD COLUMN sender_name TEXT',
    'ALTER TABLE conversations ADD COLUMN rejected_signals TEXT NOT NULL DEFAULT "[]"',
    'ALTER TABLE users ADD COLUMN group_id TEXT',
  ]
  for (const sql of migrations) {
    try { db.exec(sql) } catch { /* column already exists */ }
  }

  // Migrate legacy single group_id memberships into user_groups
  try {
    db.exec(`INSERT OR IGNORE INTO user_groups (user_id, group_id) SELECT id, group_id FROM users WHERE group_id IS NOT NULL`)
  } catch {}
  // Ensure group admins are also members of their own groups
  try {
    db.exec(`INSERT OR IGNORE INTO user_groups (user_id, group_id) SELECT admin_id, id FROM groups`)
  } catch {}
}
