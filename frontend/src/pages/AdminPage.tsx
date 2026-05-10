import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import GroupChatPage from './GroupChatPage'

const TYPE_COLORS: Record<string, string> = {
  location:    'bg-green-100 text-green-700',
  demographic: 'bg-blue-100 text-blue-700',
  transaction: 'bg-orange-100 text-orange-700',
  interest:    'bg-yellow-200 text-yellow-800',
  behavior:    'bg-pink-100 text-pink-700',
}

export default function AdminPage() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState<'audiences' | 'conversations' | 'groups'>('groups')
  const [audiences, setAudiences] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newGroupName, setNewGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [activeGroupChat, setActiveGroupChat] = useState<any>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    Promise.allSettled([
      api.conversations.confirmedList().then(r => setAudiences(r.audiences)),
      api.conversations.list().then(r => setConversations(r.conversations)),
      api.groups.list().then(r => setGroups(r.groups)),
    ]).finally(() => setLoading(false))
  }, [])

  const createGroup = async () => {
    if (!newGroupName.trim()) return
    setCreatingGroup(true)
    try {
      const r = await api.groups.create(newGroupName.trim())
      setGroups(prev => [{ ...r.group, member_count: 0 }, ...prev])
      setNewGroupName('')
    } catch (err: any) { alert(err.message) }
    setCreatingGroup(false)
  }

  const copyInviteLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${code}`)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const regenerateInvite = async (groupId: string) => {
    try {
      const r = await api.groups.regenerateInvite(groupId)
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, invite_code: r.invite_code } : g))
    } catch (err: any) { alert(err.message) }
  }

  const deleteGroup = async (groupId: string) => {
    if (!window.confirm('Delete this group? All messages and audience exports in this group will be permanently removed.')) return
    setDeletingId(groupId)
    try {
      await api.groups.delete(groupId)
      setGroups(prev => prev.filter(g => g.id !== groupId))
      if (activeGroupChat?.id === groupId) setActiveGroupChat(null)
    } catch (err: any) { alert(err.message) }
    setDeletingId(null)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Glassmorphism header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-3.5 flex-shrink-0"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-center gap-4">
          <Link
            to="/chat"
            className="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            ← Back
          </Link>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            </div>
            <h1 className="font-semibold text-gray-900 text-sm">Admin Dashboard</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)' }}
          >
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-gray-600">{user?.name}</span>
          <button onClick={logout} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8 max-w-5xl mx-auto">
            {[
              { label: 'Total Audiences', value: conversations.length, valueColor: 'text-gray-800' },
              { label: 'Confirmed Audiences',  value: audiences.length,    valueColor: 'text-amber-600' },
              { label: 'In Progress',       value: conversations.filter(c => c.status === 'active').length, valueColor: 'text-amber-600' },
              { label: 'Groups',                value: groups.length,       valueColor: 'text-amber-600', onClick: () => setTab('groups') },
            ].map(s => (
              <div
                key={s.label}
                onClick={s.onClick}
                className={`bg-white border border-gray-100 rounded-2xl p-5 transition-all ${s.onClick ? 'cursor-pointer hover:border-yellow-300 hover:bg-yellow-100/30' : ''}`}
              >
                <p className="text-xs font-medium text-gray-400">{s.label}</p>
                <p className={`text-3xl font-bold mt-1.5 ${s.valueColor}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="max-w-5xl mx-auto">

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {(['groups', 'audiences', 'conversations'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    tab === t
                      ? 'text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-yellow-100 hover:border-yellow-300'
                  }`}
                  style={tab === t ? { background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' } : undefined}
                >
                  {t === 'audiences' ? 'Confirmed Audiences' : t === 'conversations' ? 'All Conversations' : 'Groups'}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  Loading...
                </div>
              </div>
            ) : tab === 'groups' ? (
              <div className="space-y-4">

                {/* Create group */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5">
                  <h3 className="font-semibold text-gray-800 text-sm mb-4">Create New Group</h3>
                  <div className="flex gap-3">
                    <div
                      className="flex-1"
                      style={{
                        background: 'linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(135deg, rgba(253,224,71,0.5), rgba(229,231,235,0.6)) border-box',
                        border: '1px solid transparent',
                        borderRadius: '0.75rem',
                      }}
                    >
                      <input
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        placeholder="Group name (e.g. Nike Campaign Team)"
                        className="w-full bg-transparent px-4 py-2.5 text-sm focus:outline-none rounded-xl placeholder-gray-300"
                        onKeyDown={e => e.key === 'Enter' && createGroup()}
                      />
                    </div>
                    <button
                      onClick={createGroup}
                      disabled={creatingGroup || !newGroupName.trim()}
                      className="text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-40 flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 12px rgba(245,158,11,0.25)' }}
                    >
                      {creatingGroup ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>

                {/* Group list */}
                {groups.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-16 text-center">
                    <p className="text-sm text-gray-400">No groups yet. Create one above to get started.</p>
                  </div>
                ) : (
                  groups.map(g => (
                    <div
                      key={g.id}
                      className={`bg-white border rounded-2xl p-5 transition-all ${
                        activeGroupChat?.id === g.id
                          ? 'border-yellow-300 ring-1 ring-yellow-200'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)' }}
                          >
                            {g.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-800">{g.name}</h3>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {g.member_count ?? 0} members · Created {new Date(g.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setActiveGroupChat(activeGroupChat?.id === g.id ? null : g)}
                            className={`text-sm px-3.5 py-1.5 rounded-xl font-medium transition-all ${
                              activeGroupChat?.id === g.id
                                ? 'text-white'
                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-yellow-100 hover:border-yellow-300'
                            }`}
                            style={activeGroupChat?.id === g.id ? { background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' } : undefined}
                          >
                            {activeGroupChat?.id === g.id ? 'Close Chat' : 'Open Chat →'}
                          </button>
                          <button
                            onClick={() => deleteGroup(g.id)}
                            disabled={deletingId === g.id}
                            className="text-sm px-3 py-1.5 rounded-xl font-medium bg-white border border-gray-200 text-red-400 hover:bg-red-50 hover:border-red-200 transition-all disabled:opacity-40"
                          >
                            {deletingId === g.id ? '...' : 'Delete'}
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 mb-0.5">Invite link</p>
                          <code className="text-xs text-gray-600 truncate block">
                            {`${window.location.origin}/join/${g.invite_code}`}
                          </code>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => copyInviteLink(g.invite_code)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                              copiedCode === g.invite_code
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            }`}
                          >
                            {copiedCode === g.invite_code ? 'Copied!' : 'Copy'}
                          </button>
                          <button
                            onClick={() => regenerateInvite(g.id)}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 font-medium transition-colors"
                          >
                            Regenerate
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

            ) : tab === 'audiences' ? (
              <div className="space-y-3">
                {audiences.length === 0 && (
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-16 text-center">
                    <p className="text-sm text-gray-400">No confirmed audiences yet. Planners confirm their audiences from the AI chat.</p>
                  </div>
                )}
                {audiences.map(a => (
                  <div key={a.id} className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">{a.title}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {a.user_name} ({a.user_email}) · {new Date(a.confirmed_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="bg-green-50 text-green-700 border border-green-100 text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0">
                        {a.signals.length} signals
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {a.signals.map((s: any) => (
                        <span key={s.id} className={`text-xs px-2.5 py-1 rounded-full ${TYPE_COLORS[s.type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

            ) : (
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Audience Title', 'Planner', 'Status', 'Turns', 'Last Updated'].map(h => (
                        <th key={h} className="text-left px-5 py-3.5 text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {conversations.map(c => (
                      <tr key={c.id} className="hover:bg-yellow-100/30 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-gray-800">{c.title}</td>
                        <td className="px-5 py-3.5 text-gray-500">{c.user_name ?? '—'}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-200 text-yellow-800'
                          }`}>
                            {c.status === 'completed' ? 'Confirmed' : 'In Progress'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{c.message_count}</td>
                        <td className="px-5 py-3.5 text-gray-400">{new Date(c.updated_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Group chat side panel */}
        {activeGroupChat && (
          <div className="w-96 border-l border-gray-100 bg-white flex flex-col flex-shrink-0">
            <div
              className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between flex-shrink-0"
              style={{
                background: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)' }}
                >
                  {activeGroupChat.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{activeGroupChat.name}</p>
                  <p className="text-xs text-gray-400">Group Chat</p>
                </div>
              </div>
              <button
                onClick={() => setActiveGroupChat(null)}
                className="text-gray-300 hover:text-gray-600 text-lg leading-none transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <GroupChatPage
                groupId={activeGroupChat.id}
                groupName={activeGroupChat.name}
                inviteCode={activeGroupChat.invite_code}
                onConversationOpen={() => window.open(`/chat`, '_self')}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
