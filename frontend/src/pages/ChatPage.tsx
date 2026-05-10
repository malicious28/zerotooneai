import { useState, useEffect, useRef, FormEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
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

function groupConversationsByTime(convs: any[]) {
  const now = Date.now()
  const DAY = 86_400_000
  const buckets: { label: string; items: any[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 Days', items: [] },
    { label: 'Older', items: [] },
  ]
  for (const c of convs) {
    const age = now - new Date(c.created_at ?? Date.now()).getTime()
    if (age < DAY)        buckets[0].items.push(c)
    else if (age < 2*DAY) buckets[1].items.push(c)
    else if (age < 7*DAY) buckets[2].items.push(c)
    else                  buckets[3].items.push(c)
  }
  return buckets.filter(b => b.items.length > 0)
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

const IcTrash = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)

const IcPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IcSend = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

const IcHome = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)

const IcGroupChat = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
const IcAdmin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)
const IcDots = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>
  </svg>
)

export default function ChatPage() {
  const { id: urlId } = useParams<{ id?: string }>()
  const { user, logout } = useAuth()

  const [activeConvId, setActiveConvId]         = useState<string | undefined>(urlId)
  const [conversations, setConversations]        = useState<any[]>([])
  const [activeConv, setActiveConv]              = useState<any>(null)
  const [messages, setMessages]                  = useState<Message[]>([])
  const [signals, setSignals]                    = useState<any[]>([])
  const [estimate, setEstimate]                  = useState<any>(null)
  const [isConfirmed, setIsConfirmed]            = useState(false)
  const [participants, setParticipants]          = useState<any[]>([])
  const [input, setInput]                        = useState('')
  const [sending, setSending]                    = useState(false)
  const [aiThinking, setAiThinking]             = useState(false)
  const [loading, setLoading]                    = useState(false)
  const [group, setGroup]                        = useState<any>(null)
  const [sidePanel, setSidePanel]               = useState<'audience' | 'groupchat'>('audience')
  const [exporting, setExporting]               = useState(false)
  const [exportSuccess, setExportSuccess]        = useState(false)
  const [showInviteModal, setShowInviteModal]   = useState(false)
  const [groupMembers, setGroupMembers]          = useState<any[]>([])
  const [inviteUsers, setInviteUsers]            = useState<any[]>([])
  const [inviteUsersLoading, setInviteUsersLoading] = useState(false)
  const [inviteNotification, setInviteNotification] = useState<any>(null)
  const [groups, setGroups]                         = useState<any[]>([])
  const [groupUnread, setGroupUnread]               = useState<Set<string>>(new Set())
  const [showJoinGroup, setShowJoinGroup]           = useState(false)
  const [joinCodeInput, setJoinCodeInput]           = useState('')
  const [joinGroupError, setJoinGroupError]         = useState('')
  const [joinGroupLoading, setJoinGroupLoading]     = useState(false)
  const bottomRef       = useRef<HTMLDivElement>(null)
  const prevConvId      = useRef<string | undefined>(undefined)
  const pendingFirstMessage = useRef<string | undefined>(undefined)
  const doSendRef = useRef<(convId: string, text: string) => Promise<void>>(async () => {})
  const sidePanelRef    = useRef(sidePanel)
  const activeGroupIdRef = useRef<string | undefined>(undefined)

  const firstName = user?.name?.split(' ')[0] ?? 'there'

  // Bootstrap: load all groups the user belongs to (works for all roles)
  useEffect(() => {
    api.auth.me().then(r => {
      if (r.groups?.length > 0) {
        setGroups(r.groups)
        setGroup(r.groups[0])
      }
    }).catch(() => {})
  }, [])

  // Refresh groupMembers whenever active group changes
  useEffect(() => {
    if (!group) return
    api.groups.getMembers(group.id).then(mr => setGroupMembers(mr.members)).catch(() => {})
  }, [group?.id])

  // Keep refs in sync so socket callbacks don't close over stale values
  useEffect(() => { sidePanelRef.current = sidePanel }, [sidePanel])
  useEffect(() => { activeGroupIdRef.current = group?.id }, [group])

  // Invite socket
  useEffect(() => {
    const socket = getSocket()
    socket.on('conv:invite', (p: any) => setInviteNotification(p))
    return () => { socket.off('conv:invite') }
  }, [])

  // Group unread badge — join ALL group rooms and mark unread per group
  useEffect(() => {
    const allIds = groups.length > 0 ? groups.map((g: any) => g.id) : group ? [group.id] : []
    if (allIds.length === 0) return
    const socket = getSocket()
    allIds.forEach(id => socket.emit('join_group', id))
    const markUnread = (msg: any) => {
      const isViewing = sidePanelRef.current === 'groupchat' && activeGroupIdRef.current === msg.group_id
      if (!isViewing) setGroupUnread(prev => new Set([...prev, msg.group_id]))
    }
    socket.on('group:message', markUnread)
    socket.on('group:audience_export', markUnread)
    return () => {
      socket.off('group:message', markUnread)
      socket.off('group:audience_export', markUnread)
    }
  }, [groups, group])

  // Conversation list
  useEffect(() => {
    api.conversations.list().then(r => setConversations(r.conversations))
  }, [])

  // Load active conversation
  useEffect(() => {
    const socket = getSocket()
    if (prevConvId.current && prevConvId.current !== activeConvId) {
      socket.emit('leave_conversation', prevConvId.current)
    }
    prevConvId.current = activeConvId
    if (!activeConvId) return

    setLoading(true)
    setAiThinking(false)
    setInput('')

    api.conversations.get(activeConvId).then(r => {
      setActiveConv(r.conversation)
      setMessages(r.messages)
      setSignals(r.signals.signals ?? [])
      setIsConfirmed(r.signals.is_confirmed)
      setParticipants(r.participants ?? [])
      const lastMsg = [...r.messages].reverse().find((m: Message) => m.role === 'assistant' && m.metadata?.audience_estimate)
      if (lastMsg) setEstimate(lastMsg.metadata.audience_estimate)
    }).then(() => {
      const firstMsg = pendingFirstMessage.current
      if (firstMsg && activeConvId) {
        pendingFirstMessage.current = undefined
        doSendRef.current(activeConvId, firstMsg)
      }
    }).finally(() => setLoading(false))

    socket.emit('join_conversation', activeConvId)

    const onConvMessage = (msg: Message) => {
      setMessages(prev => {
        // Own user message arriving via socket: replace the optimistic temp instead of duplicating
        if (msg.role === 'user' && msg.sender_id) {
          const tempIdx = prev.findIndex(m => m.id.startsWith('temp_') && m.sender_id === msg.sender_id)
          if (tempIdx !== -1) {
            const next = [...prev]
            next[tempIdx] = msg
            return next
          }
        }
        return prev.find(m => m.id === msg.id) ? prev : [...prev, msg]
      })
    }
    const onAiThinking = ({ thinking }: { thinking: boolean }) => {
      setAiThinking(thinking)
      if (!thinking) setSending(false)
    }
    const onParticipantJoined = (p: any) => {
      setParticipants(prev => prev.find(x => x.user_id === p.user_id) ? prev : [...prev, p])
    }
    const onParticipantLeft = (p: any) => {
      setParticipants(prev => prev.filter(x => x.user_id !== p.user_id))
    }
    const onSignalsUpdated = ({ signals: s, audience_estimate: e }: { signals: any[]; audience_estimate: any }) => {
      setSignals(s)
      setEstimate(e)
    }

    socket.on('conv:message', onConvMessage)
    socket.on('conv:ai_thinking', onAiThinking)
    socket.on('conv:participant_joined', onParticipantJoined)
    socket.on('conv:participant_left', onParticipantLeft)
    socket.on('conv:signals_updated', onSignalsUpdated)

    return () => {
      socket.off('conv:message', onConvMessage)
      socket.off('conv:ai_thinking', onAiThinking)
      socket.off('conv:participant_joined', onParticipantJoined)
      socket.off('conv:participant_left', onParticipantLeft)
      socket.off('conv:signals_updated', onSignalsUpdated)
    }
  }, [activeConvId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, aiThinking])

  doSendRef.current = async (convId: string, text: string) => {
    if (!text.trim() || sending || aiThinking) return
    setSending(true)
    const tempId = 'temp_' + Date.now()
    setMessages(prev => [...prev, { id: tempId, role: 'user' as const, content: text, sender_id: user?.id, sender_name: user?.name, created_at: new Date().toISOString() }])
    try {
      const r = await api.chat.send(convId, text)
      // r.message is the ASSISTANT response — the real user message arrives via socket.
      // Remove the temp (no-op if socket already replaced it) and add the assistant if not yet there.
      setMessages(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempId)
        return withoutTemp.find(m => m.id === r.message.id) ? withoutTemp : [...withoutTemp, r.message]
      })
      setSignals(r.signals)
      setEstimate(r.audience_estimate)
      if (r.conversation_title) {
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: r.conversation_title } : c))
      }
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setSending(false)
      setAiThinking(false)
      alert(err.message)
    }
  }

  const openConversation = (convId: string) => {
    setSidePanel('audience')
    setActiveConvId(convId)
  }

  const goHome = () => {
    setSidePanel('audience')
    setActiveConvId(undefined)
    setActiveConv(null)
    setMessages([])
    setSignals([])
    setEstimate(null)
    setIsConfirmed(false)
  }

  const newConversation = async (firstMessage?: string) => {
    const r = await api.conversations.create()
    setConversations(prev => [r.conversation, ...prev])
    if (firstMessage?.trim()) pendingFirstMessage.current = firstMessage.trim()
    setActiveConvId(r.conversation.id)
    setSidePanel('audience')
  }

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    if (!activeConvId) {
      await newConversation(text)
    } else {
      await doSendRef.current(activeConvId, text)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleFormSubmit(e as any)
    }
  }

  const removeSignal = async (signalId: string) => {
    if (!activeConvId) return
    const r = await api.chat.removeSignal(activeConvId, signalId)
    setSignals(r.signals); setEstimate(r.audience_estimate)
  }

  const confirmAudience = async () => {
    if (!activeConvId) return
    await api.conversations.confirm(activeConvId)
    setIsConfirmed(true)
    setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, status: 'completed' } : c))
  }

  const exportToGroupChat = async () => {
    if (!group || !activeConvId || !activeConv) return
    setExporting(true)
    try {
      await api.groups.exportAudience(group.id, { conversation_id: activeConvId, title: activeConv.title, signals, audience_estimate: estimate })
      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 3000)
    } catch (err: any) { alert(err.message) }
    setExporting(false)
  }

  const openInviteModal = async () => {
    setShowInviteModal(true)
    setInviteUsersLoading(true)
    try {
      const r = await api.auth.listUsers()
      setInviteUsers(r.users)
    } catch { setInviteUsers([]) }
    setInviteUsersLoading(false)
  }

  const inviteMember = async (memberId: string) => {
    if (!activeConvId) return
    try { await api.conversations.invite(activeConvId, memberId) }
    catch (err: any) { alert(err.message) }
  }

  const deleteConversation = async (convId: string) => {
    if (!window.confirm('Delete this audience? All messages and targeting signals will be permanently removed.')) return
    try {
      await api.conversations.delete(convId)
      setConversations(prev => prev.filter(c => c.id !== convId))
      if (activeConvId === convId) goHome()
    } catch (err: any) { alert(err.message) }
  }

  const handleJoinGroup = async () => {
    const raw = joinCodeInput.trim()
    if (!raw) return
    const match = raw.match(/\/join\/([A-Za-z0-9_-]+)/)
    const code = match ? match[1] : raw
    setJoinGroupLoading(true)
    setJoinGroupError('')
    try {
      const r = await api.groups.joinByCode(code)
      localStorage.setItem('token', r.token)
      setGroups(prev => prev.find(g => g.id === r.group.id) ? prev : [...prev, r.group])
      setGroup(r.group)
      setShowJoinGroup(false)
      setJoinCodeInput('')
      setSidePanel('groupchat')
    } catch (err: any) { setJoinGroupError(err.message) }
    setJoinGroupLoading(false)
  }

  const isInputLocked = sending || aiThinking || isConfirmed
  const convGroups    = groupConversationsByTime(conversations)

  const navCls = (active: boolean) =>
    `w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
      active
        ? 'bg-yellow-100 text-gray-800 font-medium border border-yellow-200/60'
        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
    }`

  return (
    <div className="flex h-screen bg-white overflow-hidden">

      {/* ══ Toast: invite notification ══════════════════════════════════════ */}
      {inviteNotification && (
        <div
          className="fixed top-4 right-4 z-50 rounded-2xl shadow-xl p-4 max-w-sm"
          style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', border: '1px solid rgba(253,224,71,0.35)' }}
        >
          <p className="text-sm font-semibold text-gray-800">{inviteNotification.invitedBy} invited you to collaborate</p>
          <p className="text-sm text-gray-400 mt-0.5">
            Audience: <span className="font-medium text-gray-600">{inviteNotification.conversationTitle}</span>
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => { openConversation(inviteNotification.conversationId); setInviteNotification(null) }}
              className="flex-1 text-white text-sm py-1.5 rounded-lg transition-colors"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >Join</button>
            <button onClick={() => setInviteNotification(null)} className="flex-1 bg-gray-100 text-gray-600 text-sm py-1.5 rounded-lg hover:bg-gray-200 transition-colors">Dismiss</button>
          </div>
        </div>
      )}

      {/* ══ Modal: invite to AI conversation ═══════════════════════════════ */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl border border-yellow-200 p-6 w-full max-w-sm">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900">Invite to this conversation</h3>
              <p className="text-xs text-gray-400 mt-1">They'll join this audience-building session and can contribute to refining the targeting signals.</p>
            </div>
            <div className="space-y-0.5 max-h-64 overflow-y-auto">
              {inviteUsersLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  Loading...
                </div>
              ) : inviteUsers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No other users registered yet.</p>
              ) : (
                inviteUsers.map(u => {
                  const alreadyIn = participants.some(p => p.user_id === u.id)
                  return (
                    <div key={u.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)' }}>
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                      {alreadyIn
                        ? <span className="text-xs text-amber-600 font-medium bg-yellow-100 px-2 py-1 rounded-lg">In chat</span>
                        : <button onClick={() => inviteMember(u.id)} className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg hover:bg-yellow-200 font-medium transition-colors border border-yellow-300/60">Invite</button>
                      }
                    </div>
                  )
                })
              )}
            </div>
            <button onClick={() => setShowInviteModal(false)} className="mt-4 w-full bg-gray-50 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-100 transition-colors border border-gray-100">Close</button>
          </div>
        </div>
      )}

      {/* ══ Sidebar ═════════════════════════════════════════════════════════ */}
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col flex-shrink-0 z-10">

        {/* Logo */}
        <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="white"/>
            </svg>
          </div>
          <span className="font-bold text-gray-900 text-sm tracking-tight">AudienceBuilder</span>
        </div>

        {/* Nav */}
        <nav className="px-3 mb-2 space-y-0.5">
          <button onClick={goHome} className={navCls(!activeConvId && sidePanel === 'audience')}>
            <IcHome /> Home
          </button>
          <button onClick={() => newConversation()} className={navCls(false)}>
            <IcPlus /> New Audience
          </button>
          {groups.map((g: any) => (
            <button
              key={g.id}
              onClick={() => { setGroup(g); setSidePanel('groupchat'); setActiveConvId(undefined); setGroupUnread(prev => { const s = new Set(prev); s.delete(g.id); return s }) }}
              className={navCls(sidePanel === 'groupchat' && !activeConvId && group?.id === g.id)}
            >
              <div className="relative flex-shrink-0">
                <IcGroupChat />
                {groupUnread.has(g.id) && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 ring-1 ring-white" />
                )}
              </div>
              <span className="truncate">{g.name}</span>
            </button>
          ))}
          {!showJoinGroup ? (
            <button
              onClick={() => setShowJoinGroup(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-400 hover:bg-gray-50 hover:text-amber-600 transition-colors"
            >
              <IcPlus />
              <span>Join a group</span>
            </button>
          ) : (
            <div className="px-1 py-1 space-y-1.5">
              <input
                value={joinCodeInput}
                onChange={e => { setJoinCodeInput(e.target.value); setJoinGroupError('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleJoinGroup() }}
                placeholder="Paste invite link or code"
                autoFocus
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-amber-300 text-gray-700 placeholder-gray-400 bg-white"
              />
              {joinGroupError && <p className="text-[10px] text-red-500 px-0.5">{joinGroupError}</p>}
              <div className="flex gap-1.5">
                <button
                  onClick={handleJoinGroup}
                  disabled={joinGroupLoading || !joinCodeInput.trim()}
                  className="flex-1 text-xs py-1.5 rounded-lg text-white font-medium disabled:opacity-50 transition-all"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  {joinGroupLoading ? '…' : 'Join'}
                </button>
                <button
                  onClick={() => { setShowJoinGroup(false); setJoinCodeInput(''); setJoinGroupError('') }}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {user?.role === 'admin' && (
            <Link to="/admin" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
              <IcAdmin /> Admin
            </Link>
          )}
        </nav>

        {/* Conversation history */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
          {convGroups.map(grp => (
            <div key={grp.label}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 py-1.5">{grp.label}</p>
              <div className="space-y-0.5">
                {grp.items.map(c => (
                  <div
                    key={c.id}
                    className={`group w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${
                      c.id === activeConvId
                        ? 'bg-yellow-100 text-gray-800 font-medium border border-yellow-200/50'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                    }`}
                  >
                    <button onClick={() => openConversation(c.id)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.status === 'completed' ? 'bg-green-400' : 'bg-amber-300'}`} />
                      <span className="truncate">{c.title}</span>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteConversation(c.id) }}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-0.5 text-gray-300 hover:text-red-400 transition-all"
                      title="Delete"
                    >
                      <IcTrash />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* User profile footer */}
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors group cursor-pointer">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)' }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{user?.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.email ?? user?.role}</p>
            </div>
            <button onClick={logout} title="Sign out" className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-all">
              <IcDots />
            </button>
          </div>
        </div>
      </aside>

      {/* ══ Main wrapper ════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Glassy top bar */}
        <header
          className="flex items-center justify-between px-5 py-3 flex-shrink-0 sticky top-0 z-10"
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderBottom: '1px solid rgba(0,0,0,0.05)',
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="white"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-700 tracking-tight">Audience AI</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => newConversation()}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full border border-gray-200 bg-white hover:bg-yellow-100 hover:border-yellow-300 text-gray-700 transition-all"
            >
              <IcPlus />
              New Audience
            </button>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)' }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Content row */}
        <div className="flex-1 flex overflow-hidden">

        {sidePanel === 'groupchat' ? (
          /* ══════════════════════════════════════════════════════════════════
             GROUP CHAT mode: group conversation in center, AI chat on right
             ══════════════════════════════════════════════════════════════════ */
          <>
            {/* Group Chat — CENTER */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {group ? (
                <GroupChatPage
                  groupId={group.id}
                  groupName={group.name}
                  inviteCode={group.invite_code}
                  onConversationOpen={openConversation}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(217,119,6,0.10))' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-gray-700">No group yet</p>
                    <p className="text-sm text-gray-400 mt-1">Create a group in the Admin panel to share audiences and collaborate with your planning team.</p>
                  </div>
                  {user?.role === 'admin' && (
                    <Link to="/admin" className="text-sm font-medium text-amber-600 hover:text-amber-700 underline underline-offset-2">Go to Admin → Create Group</Link>
                  )}
                </div>
              )}
            </main>

            {/* AI Chatbot — compact RIGHT panel */}
            <aside className="w-80 bg-white border-l border-gray-100 flex flex-col flex-shrink-0">
              {/* Tab switcher */}
              <div className="flex border-b border-gray-100 flex-shrink-0">
                <button
                  onClick={() => setSidePanel('audience')}
                  className="flex-1 py-3.5 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >Audience</button>
                <button className="flex-1 py-3.5 text-sm font-medium text-amber-700 border-b-2 border-amber-400">Group Chat</button>
              </div>

              {/* Compact AI chat header */}
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2 flex-shrink-0">
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="white"/></svg>
                </div>
                <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{activeConv?.title ?? 'Audience AI'}</span>
                <button
                  onClick={() => newConversation()}
                  title="New audience"
                  className="text-gray-400 hover:text-amber-600 transition-colors"
                ><IcPlus /></button>
              </div>

              {/* Messages — compact */}
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {!activeConvId ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-2">
                    <p className="text-xs font-medium text-gray-600">Audience AI</p>
                    <p className="text-xs text-gray-400 leading-relaxed">Describe your target audience and get AI-powered signals — then share the result directly to this group.</p>
                    <button
                      onClick={() => newConversation()}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-all"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                    >+ New Audience</button>
                  </div>
                ) : loading ? (
                  <div className="flex items-center justify-center h-full gap-2 text-gray-400 text-xs">
                    <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                ) : (
                  <div className="space-y-2.5 pb-2">
                    {messages.length === 0 && (
                      <p className="text-xs text-gray-400 text-center pt-4">Describe your audience…</p>
                    )}
                    {messages.map(m => {
                      const isMe = m.sender_id === user?.id || (m.role === 'user' && !m.sender_id)
                      return (
                        <div key={m.id} className={`flex flex-col gap-0.5 ${m.role === 'user' && isMe ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                              m.role === 'user'
                                ? isMe ? 'text-white rounded-tr-sm' : 'bg-yellow-100 text-yellow-900 rounded-tl-sm'
                                : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-tl-sm'
                            }`}
                            style={m.role === 'user' && isMe ? { background: 'linear-gradient(135deg, #1f2937, #111827)' } : undefined}
                          >
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          </div>
                        </div>
                      )
                    })}
                    {aiThinking && (
                      <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl w-fit">
                        {[0, 1, 2].map(i => (
                          <span key={i} className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {/* Compact AI input */}
              {!isConfirmed && (
                <div className="border-t border-gray-100 p-3 flex-shrink-0">
                  <form onSubmit={handleFormSubmit}>
                    <div
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                      style={{
                        background: 'linear-gradient(#fff, #fff) padding-box, linear-gradient(135deg, rgba(253,224,71,0.5), rgba(229,231,235,0.5)) border-box',
                        border: '1px solid transparent',
                      }}
                    >
                      <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFormSubmit(e as any) } }}
                        placeholder={aiThinking ? 'AI is working...' : activeConvId ? 'Refine your audience...' : 'Start a new audience...'}
                        className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 focus:outline-none min-w-0"
                        disabled={!!activeConvId && isInputLocked}
                      />
                      <button
                        type="submit"
                        disabled={(!!activeConvId && isInputLocked) || !input.trim()}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-white flex-shrink-0 disabled:opacity-40 transition-all"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                      ><IcSend /></button>
                    </div>
                  </form>
                  {activeConvId && (
                    <button
                      type="button"
                      onClick={openInviteModal}
                      className="mt-2 w-full text-[11px] text-gray-400 hover:text-amber-600 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                      </svg>
                      Invite to this AI conversation
                    </button>
                  )}
                </div>
              )}
            </aside>
          </>
        ) : (
          /* ══════════════════════════════════════════════════════════════════
             AUDIENCE mode: AI chatbot in center, audience signals on right
             ══════════════════════════════════════════════════════════════════ */
          <>

          {/* ══ Main chat area ══════════════════════════════════════════════ */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-white">

            {/* Ambient glow — always present */}
            <div className="absolute inset-0 pointer-events-none z-0">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[260px] bg-gradient-to-b from-yellow-200/70 to-transparent blur-3xl" />
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto relative z-10">

              {!activeConvId ? (

                /* ── Home: greeting ─────────────────────────────────────── */
                <div className="flex flex-col items-center justify-center min-h-full pb-8 px-4">
                  <h1 className="text-[1.85rem] font-semibold text-gray-900 text-center leading-tight tracking-tight">
                    {getGreeting()}, {firstName}
                  </h1>
                  <h2 className="text-[1.85rem] font-semibold text-center leading-tight mt-0.5 tracking-tight">
                    Who are you{' '}
                    <span style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                      targeting today?
                    </span>
                  </h2>
                  {group && groupMembers.length > 0 && (
                    <div className="flex items-center gap-3 mt-6 text-xs text-gray-400">
                      <div className="flex -space-x-1.5">
                        {groupMembers.slice(0, 4).map(m => (
                          <div key={m.id} className="w-5 h-5 rounded-full bg-yellow-100 border-2 border-white flex items-center justify-center text-yellow-700 font-semibold" style={{ fontSize: 8 }}>
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                      <span>{group.name} · {groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

              ) : loading ? (

                /* ── Loading ────────────────────────────────────────────── */
                <div className="flex items-center justify-center min-h-full">
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                </div>

              ) : (

                /* ── Conversation messages ──────────────────────────────── */
                <div className="max-w-2xl mx-auto w-full px-4 py-6">

                  {/* Slim conversation header */}
                  <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-gray-800 text-sm truncate">{activeConv?.title ?? 'Audience'}</h2>
                      {participants.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {participants.slice(0, 5).map(p => (
                            <div key={p.user_id} title={p.name}
                              className="w-4 h-4 rounded-full bg-yellow-200 border border-yellow-300 flex items-center justify-center text-[9px] font-bold text-yellow-800">
                              {p.name?.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          <span className="text-xs text-gray-400 ml-1">{participants.length} collaborating</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      {isConfirmed && (
                        <span className="text-xs bg-green-50 text-green-600 border border-green-100 px-3 py-1 rounded-full font-medium">Locked In</span>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="space-y-4">
                    {messages.length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-400">Describe your target audience to get started…</p>
                      </div>
                    )}
                    {messages.map(m => {
                      const isMe = m.sender_id === user?.id || (m.role === 'user' && !m.sender_id)
                      const senderLabel = m.role === 'user'
                        ? (m.sender_name ?? (isMe ? user?.name ?? null : 'Unknown'))
                        : null
                      return (
                        <div key={m.id} className={`flex flex-col gap-0.5 ${m.role === 'user' ? (isMe ? 'items-end' : 'items-start') : 'items-start'}`}>
                          {senderLabel && <span className="text-xs text-gray-400 px-1 mb-0.5">{senderLabel}</span>}
                          <div
                            className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                              m.role === 'user'
                                ? isMe
                                  ? 'text-white rounded-tr-sm'
                                  : 'bg-yellow-100 text-yellow-900 rounded-tl-sm border border-yellow-200/60'
                                : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
                            }`}
                            style={m.role === 'user' && isMe ? {
                              background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
                              boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                            } : undefined}
                          >
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          </div>
                        </div>
                      )
                    })}

                    {aiThinking && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
                          {[0, 1, 2].map(i => (
                            <span key={i} className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                          <span className="text-xs text-gray-400 ml-2">AI is thinking...</span>
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>
                </div>
              )}
            </div>

            {/* ── Persistent input — always at bottom ─────────────────────── */}
            {!isConfirmed && (
              <div className="relative z-10 px-4 py-4 flex-shrink-0">
                <form onSubmit={handleFormSubmit} className="max-w-2xl mx-auto">
                  <div
                    className="rounded-2xl"
                    style={{
                      background:
                        'linear-gradient(#ffffff, #ffffff) padding-box, ' +
                        'linear-gradient(135deg, rgba(253,224,71,0.6) 0%, rgba(251,191,36,0.3) 40%, rgba(229,231,235,0.5) 100%) border-box',
                      border: '1px solid transparent',
                      boxShadow: '0 8px 40px rgba(251,191,36,0.12), 0 2px 12px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div
                      className="rounded-[15px] overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)' }}
                    >
                      <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          activeConvId && aiThinking
                            ? 'AI is thinking...'
                            : activeConvId
                            ? 'Describe your audience...'
                            : '✦  Describe your target audience in plain English...'
                        }
                        rows={activeConvId ? 2 : 3}
                        className="w-full px-5 pt-5 pb-2 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none bg-transparent leading-relaxed"
                        disabled={!!activeConvId && isInputLocked}
                      />

                      <div className="flex items-center gap-2 px-4 pb-4 pt-2 relative">
                        {/* Subtle bottom-left warm glow */}
                        <div className="absolute bottom-0 left-0 w-48 h-14 bg-gradient-to-tr from-yellow-50/80 to-transparent rounded-bl-[15px] pointer-events-none" />

                        {/* Invite button — visible whenever in an active conversation */}
                        {activeConvId && !isConfirmed && (
                          <button
                            type="button"
                            onClick={openInviteModal}
                            className="relative z-10 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-white hover:bg-yellow-50 border border-gray-200 hover:border-yellow-200 px-3 py-1.5 rounded-lg transition-all"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                            </svg>
                            Invite
                          </button>
                        )}

                        {/* Send button */}
                        <button
                          type="submit"
                          disabled={(!!activeConvId && isInputLocked) || !input.trim()}
                          className="relative z-10 ml-auto w-8 h-8 flex items-center justify-center rounded-xl text-white transition-all disabled:opacity-40"
                          style={{
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
                          }}
                        >
                          <IcSend />
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </main>

          {/* ══ Right panel — Audience signals ═════════════════════════════ */}
          <aside className="w-80 bg-white border-l border-gray-100 flex flex-col flex-shrink-0">
            <div className="flex border-b border-gray-100">
              <button className="flex-1 py-3.5 text-sm font-medium text-amber-700 border-b-2 border-amber-400">Audience</button>
              <button
                onClick={() => setSidePanel('groupchat')}
                className="flex-1 py-3.5 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
              >Group Chat</button>
            </div>

            {activeConvId ? (
              <div className="flex flex-col flex-1 overflow-hidden">
                <AudiencePanel signals={signals} estimate={estimate} isConfirmed={isConfirmed} onRemoveSignal={removeSignal} onConfirm={confirmAudience} />
                {isConfirmed && group && signals.length > 0 && (
                  <div className="p-4 border-t border-gray-100">
                    <button
                      onClick={exportToGroupChat}
                      disabled={exporting || exportSuccess}
                      className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                        exportSuccess ? 'bg-green-50 text-green-700 border-green-100' : 'bg-white border-gray-200 hover:border-yellow-300 hover:bg-yellow-100 text-gray-700'
                      }`}
                    >
                      {exportSuccess ? 'Audience Shared!' : exporting ? 'Sharing...' : 'Share Audience to Group'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">No audience in progress</p>
                  <p className="text-xs text-gray-400 mt-1">Start a new chat and describe your target audience to see signals here</p>
                </div>
              </div>
            )}
          </aside>

          </>
        )}
        </div>
      </div>
    </div>
  )
}
