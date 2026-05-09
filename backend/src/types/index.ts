export type UserRole = 'admin' | 'planner'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  group_id: string | null
  created_at: string
}

export interface DbUser extends User {
  password_hash: string
}

export type SignalType = 'location' | 'transaction' | 'demographic' | 'interest' | 'behavior'

export interface AudienceSignal {
  id: string
  type: SignalType
  name: string
  description: string
  reach_pct: number
  taxonomy_id: string
  taxonomy_path: string
}

export interface AudienceEstimate {
  total_reach: number
  reach_percentage: number
  confidence: 'high' | 'medium' | 'low'
  breakdown: Array<{
    signal_id: string
    signal_name: string
    individual_reach: number
  }>
}

export interface MessageMetadata {
  signals?: AudienceSignal[]
  audience_estimate?: AudienceEstimate
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  metadata: MessageMetadata | null
  sender_id: string | null
  sender_name: string | null
  created_at: string
}

export interface ConversationParticipant {
  user_id: string
  name: string
  email: string
  joined_at: string
}

export interface Conversation {
  id: string
  user_id: string
  title: string
  status: 'active' | 'completed'
  rejected_signals?: string
  created_at: string
  updated_at: string
  message_count?: number
  user_name?: string
  user_email?: string
}

export interface ConversationSignals {
  conversation_id: string
  signals: AudienceSignal[]
  is_confirmed: boolean
  updated_at: string
}

export interface Group {
  id: string
  name: string
  admin_id: string
  invite_code: string
  created_at: string
  member_count?: number
  admin_name?: string
}

export type GroupMessageType = 'text' | 'audience_export'

export interface GroupMessage {
  id: string
  group_id: string
  user_id: string
  user_name: string
  content: string
  type: GroupMessageType
  metadata: any | null
  created_at: string
}

// Extend Express Request to carry authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: User
    }
  }
}
