import { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface Props {
  onGroupChatOpen: (group: any) => void
}

export default function AdminDashboard({ onGroupChatOpen }: Props) {
  const [groups, setGroups] = useState<any[]>([])
  const [audiences, setAudiences] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newGroupName, setNewGroupName] = useState('')
  const [creating, setCreating] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.groups.list().then(r => setGroups(r.groups)),
      api.conversations.confirmedList().then(r => setAudiences(r.audiences)),
      api.conversations.list().then(r => setConversations(r.conversations)),
    ]).finally(() => setLoading(false))
  }, [])

  const createGroup = async () => {
    if (!newGroupName.trim()) return
    setCreating(true)
    try {
      const r = await api.groups.create(newGroupName.trim())
      setGroups(prev => [{ ...r.group, member_count: 0 }, ...prev])
      setNewGroupName('')
    } catch (err: any) { alert(err.message) }
    setCreating(false)
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

  if (loading) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading...</div>

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* Header bar */}
      <div className="px-6 py-5 bg-white border-b">
        <h2 className="font-bold text-gray-800 text-lg">Admin Control Panel</h2>
        <p className="text-sm text-gray-400 mt-0.5">Manage your groups and monitor audience activity</p>
      </div>

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Groups', value: groups.length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Confirmed Audiences', value: audiences.length, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Active Conversations', value: conversations.filter(c => c.status === 'active').length, color: 'text-orange-500', bg: 'bg-orange-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-white`}>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Create group */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-800 text-sm mb-3">Create New Group</h3>
          <div className="flex gap-2">
            <input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createGroup()}
              placeholder="e.g. Nike Campaign Team"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={createGroup}
              disabled={creating || !newGroupName.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {creating ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </div>

        {/* Groups list */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Your Groups ({groups.length})
          </h3>
          {groups.length === 0 ? (
            <div className="bg-white rounded-xl border p-10 text-center text-gray-400">
              <p className="text-sm">No groups yet. Create one above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map(g => (
                <div key={g.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                        {g.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{g.name}</p>
                        <p className="text-xs text-gray-400">{g.member_count ?? 0} members</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onGroupChatOpen(g)}
                      className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      Open Chat →
                    </button>
                  </div>
                  {/* Invite link */}
                  <div className="bg-gray-50 rounded-lg p-2.5 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 mb-0.5">Invite link</p>
                      <code className="text-xs text-gray-600 truncate block">{`${window.location.origin}/join/${g.invite_code}`}</code>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => copyInviteLink(g.invite_code)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${copiedCode === g.invite_code ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
                      >
                        {copiedCode === g.invite_code ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={() => regenerateInvite(g.id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 font-medium transition-colors"
                      >
                        Regen
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
