import { useState, useEffect, useRef, FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import { useNavigate } from 'react-router-dom'

const TYPE_STYLES: Record<string, string> = {
  location:    'bg-emerald-50 text-emerald-700',
  demographic: 'bg-blue-50 text-blue-700',
  transaction: 'bg-yellow-100 text-yellow-800',
  interest:    'bg-yellow-200 text-yellow-800',
  behavior:    'bg-pink-50 text-pink-700',
}

function formatReach(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000)    return `${(n / 100_000).toFixed(1)}L`
  return n.toLocaleString()
}

function AudienceExportCard({ metadata, onOpen }: { metadata: any; onOpen?: () => void }) {
  return (
    <div className="bg-yellow-100/60 border border-yellow-200 rounded-2xl p-4 max-w-xs">
      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Audience Shared</p>
      <p className="font-semibold text-gray-800 text-sm">{metadata.title}</p>
      {metadata.audience_estimate && (
        <p className="text-amber-700 text-sm font-medium mt-1">
          {formatReach(metadata.audience_estimate.total_reach)} reach · {metadata.audience_estimate.reach_percentage}%
        </p>
      )}
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {(metadata.signals ?? []).slice(0, 4).map((s: any) => (
          <span key={s.id} className={`text-xs px-2 py-0.5 rounded-full ${TYPE_STYLES[s.type] ?? 'bg-gray-100 text-gray-600'}`}>
            {s.name}
          </span>
        ))}
        {(metadata.signals ?? []).length > 4 && (
          <span className="text-xs text-gray-400">+{metadata.signals.length - 4} more</span>
        )}
      </div>
      {onOpen && (
        <button onClick={onOpen} className="mt-3 text-xs text-amber-700 font-medium hover:text-amber-900 transition-colors">
          Open conversation →
        </button>
      )}
    </div>
  )
}

interface Props {
  groupId: string
  groupName: string
  inviteCode?: string
  onConversationOpen?: (conversationId: string) => void
}

export default function GroupChatPage({ groupId, groupName, inviteCode, onConversationOpen }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map())
  const [copiedInvite, setCopiedInvite] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.groups.getMessages(groupId).then(r => setMessages(r.messages)).catch(() => {})
    api.groups.getMembers(groupId).then(r => setMembers(r.members)).catch(() => {})

    const socket = getSocket()
    socket.emit('join_group', groupId)

    const onGroupMessage = (msg: any) => {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
    }
    const onGroupAudienceExport = (msg: any) => {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
    }
    const onGroupTyping = ({ user_id, name, isTyping }: any) => {
      setTypingUsers(prev => {
        const next = new Map(prev)
        if (isTyping) next.set(user_id, name)
        else next.delete(user_id)
        return next
      })
    }

    socket.on('group:message', onGroupMessage)
    socket.on('group:audience_export', onGroupAudienceExport)
    socket.on('group:user_typing', onGroupTyping)

    return () => {
      socket.off('group:message', onGroupMessage)
      socket.off('group:audience_export', onGroupAudienceExport)
      socket.off('group:user_typing', onGroupTyping)
    }
  }, [groupId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    getSocket().emit('group:typing', { groupId, isTyping: false })
    try { await api.groups.sendMessage(groupId, text) } catch {}
    setSending(false)
  }

  const handleTyping = (val: string) => {
    setInput(val)
    const socket = getSocket()
    socket.emit('group:typing', { groupId, isTyping: true })
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      socket.emit('group:typing', { groupId, isTyping: false })
    }, 2000)
  }

  const copyInviteLink = () => {
    if (!inviteCode) return
    navigator.clipboard.writeText(`${window.location.origin}/join/${inviteCode}`)
    setCopiedInvite(true)
    setTimeout(() => setCopiedInvite(false), 2000)
  }

  const handleOpenConversation = (conversationId: string) => {
    if (onConversationOpen) {
      onConversationOpen(conversationId)
    } else {
      navigate(`/chat/${conversationId}`)
    }
  }

  const typingNames = Array.from(typingUsers.entries())
    .filter(([id]) => id !== user?.id)
    .map(([, name]) => name)

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">{groupName}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{members.length} members · live</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Member avatars */}
          <div className="flex -space-x-1.5">
            {members.slice(0, 4).map(m => (
              <div
                key={m.id}
                title={m.name}
                className="w-6 h-6 rounded-full bg-yellow-200 border-2 border-white flex items-center justify-center text-xs font-semibold text-yellow-800"
              >
                {m.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {members.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs text-gray-500">
                +{members.length - 4}
              </div>
            )}
          </div>
          {/* Invite button */}
          {inviteCode && (
            <button
              onClick={copyInviteLink}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors flex-shrink-0 ${
                copiedInvite
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-200'
              }`}
            >
              {copiedInvite ? 'Copied!' : '+ Invite'}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/40">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-12">No messages yet. Start the conversation!</p>
        )}
        {messages.map(m => {
          const isMe = m.user_id === user?.id
          if (m.type === 'audience_export') {
            return (
              <div key={m.id} className="flex flex-col items-center gap-2 py-2">
                <span className="text-xs text-gray-400">{m.user_name} shared an audience</span>
                <AudienceExportCard
                  metadata={m.metadata}
                  onOpen={m.metadata?.conversation_id ? () => handleOpenConversation(m.metadata.conversation_id) : undefined}
                />
              </div>
            )
          }
          return (
            <div key={m.id} className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
              {!isMe && <span className="text-xs text-gray-400 px-1">{m.user_name}</span>}
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isMe
                    ? 'text-white rounded-tr-sm'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
                }`}
                style={isMe ? { background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)' } : undefined}
              >
                {m.content}
              </div>
            </div>
          )
        })}

        {typingNames.length > 0 && (
          <div className="flex items-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
              <span className="text-xs text-gray-400 ml-2">{typingNames.join(', ')} typing...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-gray-100 bg-white flex-shrink-0">
        <form
          onSubmit={sendMessage}
          className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
          style={{
            background: 'linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(135deg, rgba(253,224,71,0.5), rgba(229,231,235,0.6)) border-box',
            border: '1px solid transparent',
          }}
        >
          <input
            value={input}
            onChange={e => handleTyping(e.target.value)}
            placeholder="Message the group..."
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="w-7 h-7 flex items-center justify-center text-white rounded-lg transition-all disabled:opacity-40 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
