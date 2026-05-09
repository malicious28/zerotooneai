import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import GroupChatPage from './GroupChatPage'

const TYPE_COLORS: Record<string, string> = {
  location: 'bg-green-100 text-green-700',
  demographic: 'bg-blue-100 text-blue-700',
  transaction: 'bg-orange-100 text-orange-700',
  interest: 'bg-purple-100 text-purple-700',
  behavior: 'bg-pink-100 text-pink-700',
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

  useEffect(() => {
    Promise.all([
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
    const url = `${window.location.origin}/join/${code}`
    navigator.clipboard.writeText(url)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const regenerateInvite = async (groupId: string) => {
    try {
      const r = await api.groups.regenerateInvite(groupId)
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, invite_code: r.invite_code } : g))
    } catch (err: any) { alert(err.message) }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/chat" className="text-indigo-600 hover:underline text-sm">← Back to Chat</Link>
          <h1 className="font-bold text-gray-800">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.name}</span>
          <button onClick={logout} className="text-xs text-red-500 hover:underline">Sign out</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8 max-w-6xl mx-auto">
            {[
              { label: 'Total Conversations', value: conversations.length, color: 'text-gray-800' },
              { label: 'Confirmed Audiences', value: audiences.length, color: 'text-green-600' },
              { label: 'Active Sessions', value: conversations.filter(c => c.status === 'active').length, color: 'text-indigo-600' },
              { label: 'Groups', value: groups.length, color: 'text-orange-500', onClick: () => setTab('groups') },
            ].map(s => (
              <div key={s.label} className={`bg-white rounded-xl p-5 border ${s.onClick ? 'cursor-pointer hover:border-orange-300 transition-colors' : ''}`} onClick={s.onClick}>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="max-w-6xl mx-auto">
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {(['groups', 'audiences', 'conversations'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
                  {t === 'audiences' ? 'Confirmed Audiences' : t === 'conversations' ? 'All Conversations' : 'Groups'}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center text-gray-400 py-16">Loading...</div>
            ) : tab === 'groups' ? (
              <div className="space-y-6">
                {/* Create group */}
                <div className="bg-white rounded-xl border p-5">
                  <h3 className="font-semibold text-gray-800 mb-3">Create New Group</h3>
                  <div className="flex gap-3">
                    <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Group name (e.g. Nike Campaign Team)" className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" onKeyDown={e => e.key === 'Enter' && createGroup()} />
                    <button onClick={createGroup} disabled={creatingGroup || !newGroupName.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-5 py-2 rounded-lg text-sm font-medium">
                      {creatingGroup ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>

                {/* Group list */}
                {groups.length === 0 ? (
                  <p className="text-center text-gray-400 py-12">No groups yet. Create one above.</p>
                ) : (
                  groups.map(g => (
                    <div key={g.id} className={`bg-white rounded-xl border p-5 transition-colors ${activeGroupChat?.id === g.id ? 'border-indigo-300 ring-1 ring-indigo-200' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                            {g.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-800">{g.name}</h3>
                            <p className="text-sm text-gray-500 mt-0.5">{g.member_count ?? 0} members · Created {new Date(g.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setActiveGroupChat(activeGroupChat?.id === g.id ? null : g)}
                          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${activeGroupChat?.id === g.id ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                        >
                          {activeGroupChat?.id === g.id ? 'Close Chat' : 'Open Chat →'}
                        </button>
                      </div>

                      <div className="mt-4 bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1 font-medium">Invite Link</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs text-gray-700 bg-white border rounded px-2 py-1.5 truncate">
                            {`${window.location.origin}/join/${g.invite_code}`}
                          </code>
                          <button onClick={() => copyInviteLink(g.invite_code)} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${copiedCode === g.invite_code ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}>
                            {copiedCode === g.invite_code ? 'Copied!' : 'Copy'}
                          </button>
                          <button onClick={() => regenerateInvite(g.id)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium">
                            Regenerate
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : tab === 'audiences' ? (
              <div className="space-y-4">
                {audiences.length === 0 && <p className="text-center text-gray-400 py-16">No confirmed audiences yet.</p>}
                {audiences.map(a => (
                  <div key={a.id} className="bg-white rounded-xl border p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">{a.title}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{a.user_name} ({a.user_email}) · {new Date(a.confirmed_at).toLocaleDateString()}</p>
                      </div>
                      <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full">{a.signals.length} signals</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {a.signals.map((s: any) => (
                        <span key={s.id} className={`text-xs px-2 py-1 rounded-full ${TYPE_COLORS[s.type] ?? 'bg-gray-100 text-gray-600'}`}>{s.name}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Title', 'User', 'Status', 'Messages', 'Updated'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {conversations.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{c.title}</td>
                        <td className="px-4 py-3 text-gray-500">{c.user_name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{c.message_count}</td>
                        <td className="px-4 py-3 text-gray-400">{new Date(c.updated_at).toLocaleDateString()}</td>
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
          <div className="w-96 border-l bg-white flex flex-col flex-shrink-0">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-indigo-50">
              <div>
                <p className="font-semibold text-indigo-800 text-sm">{activeGroupChat.name}</p>
                <p className="text-xs text-indigo-500">Group Chat</p>
              </div>
              <button onClick={() => setActiveGroupChat(null)} className="text-indigo-400 hover:text-indigo-600 text-lg leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <GroupChatPage groupId={activeGroupChat.id} groupName={activeGroupChat.name} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
