import fs from 'fs'
import path from 'path'
import OpenAI from 'openai'
import { config } from '../config'
import { AudienceSignal } from '../types'
import { getAllSignals } from './loader'

const client = new OpenAI({ apiKey: config.openaiApiKey })
const CACHE_PATH = path.join(__dirname, 'embeddings_cache.json')
const EMBED_MODEL = 'text-embedding-3-small'

interface EmbeddingCache {
  version: number
  signalCount: number
  entries: Array<{ id: string; embedding: number[] }>
}

let cache: Map<string, number[]> | null = null

function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!
  return s
}

function norm(a: number[]): number {
  return Math.sqrt(a.reduce((s, x) => s + x * x, 0))
}

function cosineSimilarity(a: number[], b: number[]): number {
  const denom = norm(a) * norm(b)
  return denom === 0 ? 0 : dot(a, b) / denom
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await client.embeddings.create({ model: EMBED_MODEL, input: texts })
  return response.data.map(d => d.embedding)
}

export async function buildEmbeddingCache(): Promise<void> {
  const all = getAllSignals()

  if (fs.existsSync(CACHE_PATH)) {
    const existing: EmbeddingCache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'))
    if (existing.signalCount === all.length) {
      console.log(`[embeddings] Cache hit — ${existing.signalCount} signals already embedded`)
      cache = new Map(existing.entries.map(e => [e.id, e.embedding]))
      return
    }
  }

  console.log(`[embeddings] Building embeddings for ${all.length} signals...`)
  cache = new Map()
  const BATCH = 100

  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH)
    const texts = batch.map(s => `${s.name}. ${s.description}. ${s.taxonomy_path}`)
    const embeddings = await embedBatch(texts)
    batch.forEach((s, j) => cache!.set(s.id, embeddings[j]!))
    process.stdout.write(`\r[embeddings] ${Math.min(i + BATCH, all.length)}/${all.length}`)
  }

  const saved: EmbeddingCache = {
    version: 1,
    signalCount: all.length,
    entries: Array.from(cache.entries()).map(([id, embedding]) => ({ id, embedding })),
  }
  fs.writeFileSync(CACHE_PATH, JSON.stringify(saved))
  console.log(`\n[embeddings] Done — saved to cache`)
}

export async function semanticSearch(query: string, topN = 30): Promise<AudienceSignal[]> {
  const all = getAllSignals()

  if (!cache) {
    // Fall back to keyword search if embeddings not ready
    const { searchSignals } = await import('./loader')
    return searchSignals(query, topN)
  }

  const [queryEmbedding] = await embedBatch([query])
  if (!queryEmbedding) return all.slice(0, topN)

  const scored = all
    .map(s => {
      const emb = cache!.get(s.id)
      const score = emb ? cosineSimilarity(queryEmbedding, emb) : 0
      return { signal: s, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)

  return scored.map(x => x.signal)
}

export function isEmbeddingReady(): boolean {
  return cache !== null
}
