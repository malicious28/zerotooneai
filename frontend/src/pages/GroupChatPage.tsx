import { useState, useEffect, useRef, FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import { useNavigate } from 'react-router-dom'

const TYPE_COLORS: Record<string, string> = {
  location: 'bg-green-100 text-green-700',
  demographic: 'bg-blue-100 text-blue-700',
  transaction: 'bg-orange-100 text-orange-700',
  interest: 'bg-purple-100 text-purple-700',
  behavior: 'bg-pink-100 text-pink-700',
}

function formatReach(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`
  return n.toLocaleString()
}

function AudienceExportCard({ metadata, onOpen }: { metadata: any; onOpen?: () => void }) {
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 max-w-sm">
      <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">Audience Shared</p>
      <p className="font-semibold text-gray-800 text-sm">{metadata.title}</p>
      {metadata.audience_estimate && (
        <p className="text-indigo-600 text-sm font-medium mt-1">
          {formatReach(metadata.audience_estimate.total_reach)} reach · {metadata.audience_estimate.reach_percentage}%
        </p>
      )}
      <div className="flex flex-wrap gap-1 mt-2">
        {(metadata.signals ?? []).slice(0, 5).map((s: any) => (
          <span key={s.id} className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[s.type] ?? 'bg-gray-100 text-gray-600'}`}>{s.name}</span>
        ))}
        {(metadata.signals ?? []).length > 5 && (
          <span className="text-xs text-gray-400">+{metadata.signals.length - 5} more</span>
        )}
      </div>
      {onOpen && (
        <button onClick={onOpen} className="mt-2 text-xs text-indigo-600 hover:underline">Open conversation →</button>
      )}
    </div>
  )
}

interface Props {
  groupId: string
  groupName: string
}

export default function GroupChatPage({ groupId, groupName }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map())
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Load initial messages and members
    api.groups.getMessages(groupId).then(r => {
      setMessages(r.messages)
    }).catch(() => {})
    api.groups.getMembers(groupId).then(r => setMembers(r.members)).catch(() => {})

    // Socket setup
    const socket = getSocket()
    socket.emit('join_group', groupId)

    socket.on('group:message', (msg: any) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })

    socket.on('group:audience_export', (msg: any) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })

    socket.on('group:user_typing', ({ user_id, name, isTyping }: any) => {
      setTypingUsers(prev => {
        const next = new Map(prev)
        if (isTyping) next.set(user_id, name)
        else next.delete(user_id)
        return next
      })
    })

    return () => {
      socket.off('group:message')
      socket.off('group:audience_export')
      socket.off('group:user_typing')
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
    // Stop typing indicator
    getSocket().emit('group:typing', { groupId, isTyping: false })
    try {
      await api.groups.sendMessage(groupId, text)
      // Message will arrive via socket
    } catch {}
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

  const typingNames = Array.from(typingUsers.entries())
    .filter(([id]) => id !== user?.id)
    .map(([, name]) => name)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800 text-sm">{groupName}</h2>
          <p className="text-xs text-gray-400">{members.length} members · live</p>
        </div>
        <div className="flex items-center gap-1">
          {members.slice(0, 4).map(m => (
            <div key={m.id} title={m.name} className="w-7 h-7 rounded-full bg-indigo-200 flex items-center justify-center text-xs font-semibold text-indigo-700">
              {m.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {members.length > 4 && <span className="text-xs text-gray-400 ml-1">+{members.length - 4}</span>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-12">No messages yet. Start the conversation!</p>
        )}
        {messages.map(m => {
          const isMe = m.user_id === user?.id
          if (m.type === 'audience_export') {
            return (
              <div key={m.id} className="flex flex-col items-center gap-1">
                <span className="text-xs text-gray-400">{m.user_name} shared an audience</span>
                <AudienceExportCard
                  metadata={m.metadata}
                  onOpen={m.metadata?.conversation_id ? () => navigate(`/chat/${m.metadata.conversation_id}`) : undefined}
                />
              </div>
            )
          }
          return (
            <div key={m.id} className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
              <span className="text-xs text-gray-400 px-1">{m.user_name}</span>
              <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border text-gray-800 rounded-tl-sm shadow-sm'}`}>
                {m.content}
              </div>
            </div>
          )
        })}

        {/* Typing indicator */}
        {typingNames.length > 0 && (
          <div className="flex items-start gap-2">
            <div className="bg-white border rounded-2xl rounded-tl-sm px-4 py-2 shadow-sm">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                <span className="text-xs text-gray-400 ml-2">{typingNames.join(', ')} typing...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-3 border-t bg-white flex gap-2">
        <input
          value={input}
          onChange={e => handleTyping(e.target.value)}
          placeholder="Message the group..."
          className="flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          Send
        </button>
      </form>
    </div>
  )
}
