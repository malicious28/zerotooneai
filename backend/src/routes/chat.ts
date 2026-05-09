import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import OpenAI from 'openai'
import { getDb } from '../db/database'
import { config } from '../config'
import { requireAuth } from '../middleware/auth'
import { getAllSignals, searchSignals, findSignalById } from '../data/loader'
import { semanticSearch, isEmbeddingReady } from '../data/embeddings'
import { emitConvMessage, emitConvAiThinking, emitConvInvite } from '../socket'
import { AudienceSignal, AudienceEstimate, MessageMetadata, Conversation, ConversationParticipant } from '../types'

const router = Router()
router.use(requireAuth)

const client = new OpenAI({ apiKey: config.openaiApiKey })

// Pre-load taxonomy at startup
getAllSignals()

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(relevantSignals: AudienceSignal[], rejectedIds: string[]): string {
  const rejectedNames = rejectedIds
    .map(id => findSignalById(id)?.name)
    .filter(Boolean)

  const rejectionNote = rejectedNames.length > 0
    ? `\n\n## Previously rejected signals (DO NOT suggest these again)\nThe planner removed these — do not recommend them: ${rejectedNames.join(', ')}`
    : ''

  return `You are an expert audience planning assistant for a digital advertising platform. Your goal is to help media planners build precise, well-reasoned audience segments.

## Conversation stages

**Stage 1 — Understand** (first 1-2 turns if the request is vague)
Before recommending signals, understand:
- Campaign goal: awareness, consideration, or performance/conversion?
- Target persona: age, gender, income level, lifestyle?
- Geography: national, specific cities, urban vs rural?
- Product/service category?

Ask at most 2 focused questions. If the planner gives enough detail, skip straight to Stage 2.

**Stage 2 — Recommend**
Call \`suggest_audience_signals\` with 3-6 signals. Always explain WHY each one fits.

**Stage 3 — Refine**
After recommending, invite refinement: "Want me to broaden with X?" or "Should we narrow to a specific city?"
When the planner asks to add/remove signals or adjust, call \`suggest_audience_signals\` again with the updated FULL list.

**Stage 4 — Confirm**
When the planner is satisfied, summarize the audience and tell them to click "Confirm Audience".

## Signal selection rules
- Combine signals across types (location + demographic + interest) for precision
- Warn if combined reach would drop below 5% — suggest broadening
- Never re-suggest signals the planner already removed
- Use transaction signals (credit card, buying behaviors) as income proxies${rejectionNote}

## Few-shot examples

**Example 1**
Planner: "I want to reach young mothers who shop for baby products online"
→ Good signals: hh_with_kids, cg_age_25_34, cg_gender_female, txn_shopping_retail_groceries_essentials_baby, cg_credit_card_user

**Example 2**
Planner: "Premium car buyers in metros"
→ Good signals: loc_new_car_dealers, cg_age_35_44, cg_age_45_54, credit_card_premium, txn_automotive_cars_buying_selling_cars

**Example 3**
Planner: "Fitness enthusiasts aged 25-40 with premium habits"
→ Good signals: txn_health_fitness_exercise, cg_age_25_34, cg_age_35_44, credit_card_premium, loc_fitness_and_recreational_sports_centers

## Available signals (most relevant to the current conversation)
${relevantSignals.map(s => `[${s.id}] ${s.name} (${s.type}) — ${s.description} | reach: ${s.reach_pct}%`).join('\n')}`
}

// ── Tool definition ───────────────────────────────────────────────────────────

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'suggest_audience_signals',
      description: 'Suggest or update audience targeting signals. Send the COMPLETE current list every time — not just additions.',
      parameters: {
        type: 'object',
        properties: {
          signals: {
            type: 'array',
            description: 'Full set of recommended signals',
            items: {
              type: 'object',
              properties: {
                signal_id: { type: 'string', description: 'Exact signal ID from the taxonomy' },
                reason: { type: 'string', description: 'One sentence: why this signal fits the campaign' },
              },
              required: ['signal_id', 'reason'],
            },
          },
          summary: {
            type: 'string',
            description: 'One sentence describing what this combined audience represents',
          },
        },
        required: ['signals', 'summary'],
      },
    },
  },
]

// ── Reach estimation ──────────────────────────────────────────────────────────

const ADDRESSABLE_UNIVERSE = 500_000_000

function estimateReach(signals: AudienceSignal[]): AudienceEstimate {
  if (signals.length === 0) {
    return { total_reach: 0, reach_percentage: 0, confidence: 'low', breakdown: [] }
  }

  const byType = signals.reduce<Record<string, AudienceSignal[]>>((acc, s) => {
    acc[s.type] = acc[s.type] ?? []
    acc[s.type]!.push(s)
    return acc
  }, {})

  // Within type: OR (additive, capped at 90% of universe)
  const typeReaches = Object.values(byType).map(group =>
    Math.min(group.reduce((sum, s) => sum + s.reach_pct / 100, 0), 0.9)
  )

  // Across types: AND (multiplicative) with 1.4x positive correlation boost
  let combined = typeReaches[0]!
  for (let i = 1; i < typeReaches.length; i++) {
    combined = Math.min(combined * typeReaches[i]! * 1.4, Math.min(combined, typeReaches[i]!))
  }

  const pct = Math.round(Math.min(combined * 100, 90) * 10) / 10
  return {
    total_reach: Math.round(ADDRESSABLE_UNIVERSE * pct / 100),
    reach_percentage: pct,
    confidence: signals.length >= 4 ? 'high' : signals.length >= 2 ? 'medium' : 'low',
    breakdown: signals.map(s => ({
      signal_id: s.id,
      signal_name: s.name,
      individual_reach: Math.round(ADDRESSABLE_UNIVERSE * s.reach_pct / 100),
    })),
  }
}

// ── Reject memory helpers ─────────────────────────────────────────────────────

// Store rejected signal IDs per conversation in the DB metadata column on the conversation row.
// We piggyback on a JSON column rather than a new table for simplicity.

function getRejectedIds(conversationId: string): string[] {
  const db = getDb()
  const row = db.prepare('SELECT rejected_signals FROM conversations WHERE id = ?').get(conversationId) as any
  if (!row?.rejected_signals) return []
  try { return JSON.parse(row.rejected_signals) } catch { return [] }
}

function addRejectedId(conversationId: string, signalId: string) {
  const db = getDb()
  const current = getRejectedIds(conversationId)
  if (!current.includes(signalId)) {
    const updated = [...current, signalId]
    db.prepare('UPDATE conversations SET rejected_signals = ? WHERE id = ?').run(JSON.stringify(updated), conversationId)
  }
}

// ── Chat endpoint ─────────────────────────────────────────────────────────────

type OAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam

router.post('/:conversationId/message', async (req: Request, res: Response) => {
  const { conversationId } = req.params
  const { content } = req.body
  if (!content?.trim()) { res.status(400).json({ error: 'content required' }); return }

  const db = getDb()
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId) as Conversation | undefined
  if (!conv) { res.status(404).json({ error: 'Conversation not found' }); return }
  if (req.user!.role !== 'admin' && conv.user_id !== req.user!.id) {
    res.status(403).json({ error: 'Forbidden' }); return
  }

  const now = new Date().toISOString()

  // Ensure sender is a participant
  db.prepare('INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?,?)').run(conversationId, req.user!.id)

  // Persist user message with sender info
  const userMsgId = uuidv4()
  db.prepare('INSERT INTO messages (id, conversation_id, role, content, sender_id, sender_name, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(userMsgId, conversationId, 'user', content, req.user!.id, req.user!.name, now)

  // Broadcast user message to all conversation participants
  emitConvMessage(conversationId, { id: userMsgId, conversation_id: conversationId, role: 'user', content, sender_id: req.user!.id, sender_name: req.user!.name, metadata: null, created_at: now })

  // Signal AI is thinking
  emitConvAiThinking(conversationId, true)

  // Build conversation history
  const history = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(conversationId) as Array<{ role: string; content: string }>

  // Load current signals and rejected signal IDs
  const sigRow = db.prepare('SELECT signals FROM conversation_signals WHERE conversation_id = ?').get(conversationId) as any
  let currentSignals: AudienceSignal[] = sigRow ? JSON.parse(sigRow.signals) : []
  const rejectedIds = getRejectedIds(conversationId)

  // Build context query from recent messages for signal retrieval
  const recentText = history.slice(-4).map(m => m.content).join(' ')
  const contextQuery = `${content} ${recentText}`

  // Retrieve relevant signals — semantic if embeddings ready, keyword fallback
  const relevantSignals = isEmbeddingReady()
    ? await semanticSearch(contextQuery, 35)
    : searchSignals(contextQuery, 35)

  // Always include currently selected signals in the context
  for (const s of currentSignals) {
    if (!relevantSignals.find(r => r.id === s.id)) relevantSignals.push(s)
  }

  const oaiMessages: OAIMessage[] = [
    { role: 'system', content: buildSystemPrompt(relevantSignals, rejectedIds) },
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]

  // ── Agentic loop ──────────────────────────────────────────────────────────
  let finalText = ''
  let updatedSignals = currentSignals
  const MAX_TURNS = 3

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      tools: TOOLS,
      tool_choice: 'auto',
      messages: oaiMessages,
    })

    const choice = response.choices[0]!
    oaiMessages.push(choice.message as OAIMessage)

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.function.name === 'suggest_audience_signals') {
          const args = JSON.parse(toolCall.function.arguments) as {
            signals: Array<{ signal_id: string; reason: string }>
            summary: string
          }

          // Resolve IDs — filter out any rejected or unknown signals
          const resolved = args.signals
            .filter(s => !rejectedIds.includes(s.signal_id))
            .map(s => findSignalById(s.signal_id))
            .filter((s): s is AudienceSignal => s !== undefined)

          updatedSignals = resolved

          const updatedNow = new Date().toISOString()
          db.prepare('UPDATE conversation_signals SET signals = ?, updated_at = ? WHERE conversation_id = ?')
            .run(JSON.stringify(updatedSignals), updatedNow, conversationId)

          const estimate = estimateReach(updatedSignals)
          oaiMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              ok: true,
              resolved_count: updatedSignals.length,
              signals: updatedSignals.map(s => ({ id: s.id, name: s.name, reach_pct: s.reach_pct })),
              combined_reach_pct: estimate.reach_percentage,
              summary: args.summary,
            }),
          })
        }
      }
      continue
    }

    finalText = choice.message.content ?? ''
    break
  }

  const estimate = estimateReach(updatedSignals)
  const metadata: MessageMetadata = {
    signals: updatedSignals.length > 0 ? updatedSignals : undefined,
    audience_estimate: updatedSignals.length > 0 ? estimate : undefined,
  }

  const assistantMsgId = uuidv4()
  db.prepare('INSERT INTO messages (id, conversation_id, role, content, metadata, created_at) VALUES (?,?,?,?,?,?)')
    .run(assistantMsgId, conversationId, 'assistant', finalText, JSON.stringify(metadata), now)

  const isFirstTurn = history.length === 1
  if (isFirstTurn) {
    const title = content.length > 50 ? content.slice(0, 50) + '…' : content
    db.prepare('UPDATE conversations SET updated_at = ?, title = ? WHERE id = ?').run(now, title, conversationId)
  } else {
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversationId)
  }

  const assistantMsg = { id: assistantMsgId, conversation_id: conversationId, role: 'assistant', content: finalText, sender_id: null, sender_name: null, metadata, created_at: now }

  // Stop thinking indicator and broadcast AI reply to all participants
  emitConvAiThinking(conversationId, false)
  emitConvMessage(conversationId, assistantMsg)

  res.json({
    message: assistantMsg,
    signals: updatedSignals,
    audience_estimate: estimate,
  })
})

// ── Get conversation participants ─────────────────────────────────────────────

router.get('/:conversationId/participants', (req: Request, res: Response) => {
  const db = getDb()
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params['conversationId']) as Conversation | undefined
  if (!conv) { res.status(404).json({ error: 'Not found' }); return }
  if (req.user!.role !== 'admin' && conv.user_id !== req.user!.id) {
    // Also allow participants
    const isParticipant = db.prepare('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?').get(req.params['conversationId'], req.user!.id)
    if (!isParticipant) { res.status(403).json({ error: 'Forbidden' }); return }
  }
  const participants = db.prepare(`
    SELECT u.id as user_id, u.name, u.email, cp.joined_at
    FROM conversation_participants cp JOIN users u ON cp.user_id = u.id
    WHERE cp.conversation_id = ? ORDER BY cp.joined_at ASC
  `).all(req.params['conversationId']) as ConversationParticipant[]
  res.json({ participants })
})

// ── Invite a group member to a conversation ───────────────────────────────────

router.post('/:conversationId/invite', (req: Request, res: Response) => {
  const db = getDb()
  const { userId } = req.body
  if (!userId) { res.status(400).json({ error: 'userId required' }); return }

  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params['conversationId']) as Conversation | undefined
  if (!conv) { res.status(404).json({ error: 'Not found' }); return }
  if (conv.user_id !== req.user!.id && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Only the conversation owner can invite' }); return
  }

  // Add as participant immediately — they join the socket room when they open the convo
  db.prepare('INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?,?)').run(req.params['conversationId'], userId)

  // Send real-time invite notification to target user
  emitConvInvite(userId, {
    conversationId: req.params['conversationId'],
    conversationTitle: conv.title,
    invitedBy: req.user!.name,
  })

  res.json({ ok: true })
})

// ── Remove a signal (adds to reject memory) ───────────────────────────────────

router.delete('/:conversationId/signals/:signalId', (req: Request, res: Response) => {
  const { conversationId, signalId } = req.params
  const db = getDb()

  const row = db.prepare('SELECT signals FROM conversation_signals WHERE conversation_id = ?').get(conversationId) as any
  if (!row) { res.status(404).json({ error: 'Not found' }); return }

  const signals: AudienceSignal[] = JSON.parse(row.signals).filter((s: AudienceSignal) => s.id !== signalId)
  db.prepare('UPDATE conversation_signals SET signals = ?, updated_at = ? WHERE conversation_id = ?')
    .run(JSON.stringify(signals), new Date().toISOString(), conversationId)

  // Remember this rejection so AI won't suggest it again
  addRejectedId(conversationId, signalId)

  res.json({ signals, audience_estimate: estimateReach(signals) })
})

export default router
