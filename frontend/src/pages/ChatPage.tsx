import { useState, useEffect, useRef, FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import AudiencePanel from '../components/AudiencePanel'
import GroupChatPage from './GroupChatPage'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  metadata?: any
  sender_id?: string | null
  sender_name?: string | null
  created_at: string
}

export default function ChatPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [conversations, setConversations] = useState<any[]>([])
  const [activeConv, setActiveConv] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [signals, setSignals] = useState<any[]>([])
  const [estimate, setEstimate] = useState<any>(null)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [participants, setParticipants] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [group, setGroup] = useState<any>(null)
  const [sidePanel, setSidePanel] = useState<'audience' | 'groupchat'>('audience')
  const [exporting, setExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [groupMembers, setGroupMembers] = useState<any[]>([])
  const [inviteNotification, setInviteNotification] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevConvId = useRef<string | undefined>(undefined)

  // Load user's group info
  useEffect(() => {
    api.auth.me().then(r => {
      if (r.group) {
        setGroup(r.group)
        api.groups.getMembers(r.group.id).then(mr => setGroupMembers(mr.members)).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  // Global socket events (invite notifications, user room)
  useEffect(() => {
    const socket = getSocket()
    socket.on('conv:invite', (payload: any) => {
      setInviteNotification(payload)
    })
    return () => { socket.off('conv:invite') }
  }, [])

  useEffect(() => {
    api.conversations.list().then(r => setConversations(r.conversations))
  }, [])

  // Load conversation + wire up socket room
  useEffect(() => {
    const socket = getSocket()

    // Leave previous conversation room
    if (prevConvId.current && prevConvId.current !== id) {
      socket.emit('leave_conversation', prevConvId.current)
    }
    prevConvId.current = id

    if (!id) return
    setLoading(true)
    setAiThinking(false)

    api.conversations.get(id).then(r => {
      setActiveConv(r.conversation)
      setMessages(r.messages)
      setSignals(r.signals.signals ?? [])
      setIsConfirmed(r.signals.is_confirmed)
      setParticipants(r.participants ?? [])
      const lastMsg = [...r.messages].reverse().find((m: Message) => m.role === 'assistant' && m.metadata?.audience_estimate)
      if (lastMsg) setEstimate(lastMsg.metadata.audience_estimate)
    }).finally(() => setLoading(false))

    // Join conversation socket room
    socket.emit('join_conversation', id)

    // Real-time message from another participant or AI reply
    socket.on('conv:message', (msg: Message) => {
      // Only add if it wasn't sent by us (ours are added optimistically)
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })

    socket.on('conv:ai_thinking', ({ thinking }: { thinking: boolean }) => {
      setAiThinking(thinking)
      if (!thinking) setSending(false)
    })

    socket.on('conv:participant_joined', (p: any) => {
      setParticipants(prev => prev.find(x => x.user_id === p.user_id) ? prev : [...prev, p])
    })

    socket.on('conv:participant_left', (p: any) => {
      setParticipants(prev => prev.filter(x => x.user_id !== p.user_id))
    })

    return () => {
      socket.off('conv:message')
      socket.off('conv:ai_thinking')
      socket.off('conv:participant_joined')
      socket.off('conv:participant_left')
    }
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, aiThinking])

  const newConversation = async () => {
    const r = await api.conversations.create()
    setConversations(prev => [r.conversation, ...prev])
    navigate(`/chat/${r.conversation.id}`)
  }

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !id || sending || aiThinking) return
    const text = input.trim()
    setInput('')
    setSending(true)
    // Optimistic add
    const tempId = 'temp_' + Date.now()
    setMessages(prev => [...prev, { id: tempId, role: 'user', content: text, sender_id: user?.id, sender_name: user?.name, created_at: new Date().toISOString() }])
    try {
      const r = await api.chat.send(id, text)
      // Replace temp with real user message (socket will bring AI reply)
      setMessages(prev => prev.map(m => m.id === tempId ? { ...r.message, role: 'user' as const, content: text, sender_id: user?.id, sender_name: user?.name } : m))
      setSignals(r.signals)
      setEstimate(r.audience_estimate)
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setSending(false)
      setAiThinking(false)
      alert(err.message)
    }
  }

  const removeSignal = async (signalId: string) => {
    if (!id) return
    const r = await api.chat.removeSignal(id, signalId)
    setSignals(r.signals)
    setEstimate(r.audience_estimate)
  }

  const confirmAudience = async () => {
    if (!id) return
    await api.conversations.confirm(id)
    setIsConfirmed(true)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status: 'completed' } : c))
  }

  const exportToGroupChat = async () => {
    if (!group || !id || !activeConv) return
    setExporting(true)
    try {
      await api.groups.exportAudience(group.id, { conversation_id: id, title: activeConv.title, signals, audience_estimate: estimate })
      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 3000)
    } catch (err: any) { alert(err.message) }
    setExporting(false)
  }

  const inviteMember = async (memberId: string) => {
    if (!id) return
    try {
      await api.conversations.invite(id, memberId)
    } catch (err: any) { alert(err.message) }
  }

  const acceptInvite = () => {
    if (!inviteNotification) return
    navigate(`/chat/${inviteNotification.conversationId}`)
    setInviteNotification(null)
  }

  const isInputLocked = sending || aiThinking || isConfirmed

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Invite notification toast */}
      {inviteNotification && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-indigo-200 rounded-xl shadow-lg p-4 max-w-sm">
          <p className="text-sm font-semibold text-gray-800">{inviteNotification.invitedBy} invited you</p>
          <p className="text-sm text-gray-500 mt-0.5">to collaborate on: <span className="font-medium">{inviteNotification.conversationTitle}</span></p>
          <div className="flex gap-2 mt-3">
            <button onClick={acceptInvite} className="flex-1 bg-indigo-600 text-white text-sm py-1.5 rounded-lg hover:bg-indigo-700">Join</button>
            <button onClick={() => setInviteNotification(null)} className="flex-1 bg-gray-100 text-gray-600 text-sm py-1.5 rounded-lg hover:bg-gray-200">Dismiss</button>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInviteModal && group && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Invite to this conversation</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {groupMembers.filter(m => m.id !== user?.id).map(m => {
                const alreadyIn = participants.some(p => p.user_id === m.id)
                return (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.email}</p>
                    </div>
                    {alreadyIn ? (
                      <span className="text-xs text-green-600 font-medium">In chat</span>
                    ) : (
                      <button onClick={() => inviteMember(m.id)} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg hover:bg-indigo-200 font-medium">Invite</button>
                    )}
                  </div>
                )
              })}
              {groupMembers.filter(m => m.id !== user?.id).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No other members in your group yet.</p>
              )}
            </div>
            <button onClick={() => setShowInviteModal(false)} className="mt-4 w-full bg-gray-100 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-200">Close</button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <span className="font-bold text-indigo-700 text-sm">AudienceBuilder</span>
          {user?.role === 'admin' && <Link to="/admin" className="text-xs text-indigo-500 hover:underline">Admin</Link>}
        </div>
        <div className="p-3">
          <button onClick={newConversation} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">+ New Audience</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map(c => (
            <Link key={c.id} to={`/chat/${c.id}`} onClick={() => setSidePanel('audience')} className={`block px-4 py-3 border-b hover:bg-gray-50 transition-colors ${c.id === id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}>
              <p className="text-sm font-medium text-gray-800 truncate">{c.title}</p>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${c.status === 'completed' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                {c.status} · {c.message_count ?? 0} msgs
              </p>
            </Link>
          ))}
        </div>
        {group && (
          <div className="border-t">
            <button
              onClick={() => { setSidePanel('groupchat'); navigate('/chat') }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${sidePanel === 'groupchat' && !id ? 'bg-indigo-50 border-l-4 border-l-indigo-500 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-base flex-shrink-0">
                {group.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-semibold truncate">{group.name}</p>
                <p className="text-xs text-gray-400">Group chat</p>
              </div>
            </button>
          </div>
        )}
        <div className="p-4 border-t">
          <p className="text-xs text-gray-500 truncate">{user?.name} ({user?.role})</p>
          <button onClick={logout} className="text-xs text-red-500 hover:underline mt-1">Sign out</button>
        </div>
      </aside>

      {/* Chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {!id ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <p className="text-lg font-medium">Select or create an audience</p>
            <button onClick={newConversation} className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 text-sm">Start building</button>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b bg-white flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-800 truncate">{activeConv?.title ?? 'Audience'}</h2>
                {/* Active participants */}
                {participants.length > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {participants.slice(0, 4).map(p => (
                      <div key={p.user_id} title={p.name} className="w-5 h-5 rounded-full bg-indigo-200 flex items-center justify-center text-xs font-semibold text-indigo-700">
                        {p.name?.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    <span className="text-xs text-gray-400 ml-1">{participants.length} collaborating</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isConfirmed && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">Confirmed</span>}
                {group && !isConfirmed && (
                  <button onClick={() => setShowInviteModal(true)} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-200 font-medium whitespace-nowrap">
                    + Invite
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 mt-16">
                  <p className="text-lg font-medium">Describe your target audience</p>
                  <p className="text-sm mt-1">e.g. "Young professionals in Mumbai who shop online frequently"</p>
                </div>
              )}
              {messages.map(m => {
                const isMe = m.sender_id === user?.id || (m.role === 'user' && !m.sender_id)
                const senderLabel = m.role === 'user' ? (isMe ? null : m.sender_name ?? 'Unknown') : null
                return (
                  <div key={m.id} className={`flex flex-col gap-0.5 ${m.role === 'user' ? (isMe ? 'items-end' : 'items-start') : 'items-start'}`}>
                    {senderLabel && <span className="text-xs text-gray-400 px-1">{senderLabel}</span>}
                    <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${m.role === 'user' ? (isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-violet-100 text-violet-900 rounded-tl-sm') : 'bg-white border text-gray-800 rounded-tl-sm shadow-sm'}`}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                )
              })}

              {/* AI thinking indicator */}
              {aiThinking && (
                <div className="flex justify-start">
                  <div className="bg-white border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1 items-center">
                      {[0, 1, 2].map(i => <span key={i} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                      <span className="text-xs text-gray-400 ml-2">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {!isConfirmed && (
              <form onSubmit={sendMessage} className="p-4 border-t bg-white flex gap-3">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={aiThinking ? 'AI is thinking...' : 'Describe your audience...'}
                  className={`flex-1 border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${aiThinking ? 'bg-gray-50 text-gray-400' : ''}`}
                  disabled={isInputLocked}
                />
                <button type="submit" disabled={isInputLocked || !input.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors">
                  Send
                </button>
              </form>
            )}
          </>
        )}
      </main>

      {/* Right panel — always visible when user has a group or a conversation is open */}
      {(id || group) && (
        <aside className="w-80 bg-white border-l flex flex-col">
          <div className="flex border-b">
            <button onClick={() => setSidePanel('audience')} className={`flex-1 py-3 text-sm font-medium transition-colors ${sidePanel === 'audience' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Audience</button>
            {group && <button onClick={() => setSidePanel('groupchat')} className={`flex-1 py-3 text-sm font-medium transition-colors ${sidePanel === 'groupchat' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Group Chat</button>}
          </div>

          {sidePanel === 'audience' ? (
            id ? (
              <div className="flex flex-col flex-1 overflow-hidden">
                <AudiencePanel signals={signals} estimate={estimate} isConfirmed={isConfirmed} onRemoveSignal={removeSignal} onConfirm={confirmAudience} />
                {isConfirmed && group && signals.length > 0 && (
                  <div className="p-4 border-t">
                    <button onClick={exportToGroupChat} disabled={exporting || exportSuccess} className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${exportSuccess ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                      {exportSuccess ? 'Shared to Group!' : exporting ? 'Sharing...' : 'Share to Group Chat'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">🎯</div>
                <div>
                  <p className="text-sm font-medium text-gray-500">No audience selected</p>
                  <p className="text-xs mt-1">Select a conversation to see its signals and reach estimate</p>
                </div>
              </div>
            )
          ) : (
            group && <GroupChatPage groupId={group.id} groupName={group.name} />
          )}
        </aside>
      )}
    </div>
  )
}
