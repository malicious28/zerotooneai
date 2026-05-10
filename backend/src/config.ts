import dotenv from 'dotenv'
import path from 'path'

dotenv.config()

function require_env(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  jwtSecret: require_env('JWT_SECRET'),
  openaiApiKey: require_env('OPENAI_API_KEY'),
  databasePath: path.resolve(process.env['DATABASE_PATH'] ?? './data/sightline.db'),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  frontendUrl: process.env['FRONTEND_URL'] ?? '',
  jwtExpiresIn: '7d',
} as const
