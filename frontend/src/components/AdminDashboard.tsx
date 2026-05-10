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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    )
  }

  const activeConvCount = conversations.filter(c => c.status === 'active').length

  return (
    <div className="flex-1 overflow-y-auto bg-white">

      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100">
        <h1 className="text-xl font-semibold text-gray-900">Admin Panel</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage groups and monitor audience activity</p>
      </div>

      <div className="max-w-3xl px-8 py-8 space-y-8">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Groups',                value: groups.length,    valueColor: 'text-amber-600',  bg: 'bg-white', border: 'border-gray-100' },
            { label: 'Confirmed Audiences',   value: audiences.length, valueColor: 'text-green-600',  bg: 'bg-white', border: 'border-gray-100' },
            { label: 'Active Conversations',  value: activeConvCount,  valueColor: 'text-amber-600',  bg: 'bg-white', border: 'border-gray-100' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-5`}>
              <p className="text-xs font-medium text-gray-400">{s.label}</p>
              <p className={`text-3xl font-bold mt-1.5 ${s.valueColor}`}>{s.value}</p>
            </div>
          ))}
        </div>

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
                onKeyDown={e => e.key === 'Enter' && createGroup()}
                placeholder="e.g. Nike Campaign Team"
                className="w-full bg-transparent px-4 py-2.5 text-sm focus:outline-none rounded-xl placeholder-gray-300"
              />
            </div>
            <button
              onClick={createGroup}
              disabled={creating || !newGroupName.trim()}
              className="text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-40 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 12px rgba(245,158,11,0.25)' }}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>

        {/* Groups list */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Groups</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{groups.length}</span>
          </div>

          {groups.length === 0 ? (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-12 text-center">
              <p className="text-sm text-gray-400">No groups yet. Create one above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map(g => (
                <div key={g.id} className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-gray-200 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)' }}
                      >
                        {g.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{g.name}</p>
                        <p className="text-xs text-gray-400">{g.member_count ?? 0} members</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onGroupChatOpen(g)}
                      className="text-xs bg-white border border-gray-200 text-gray-700 hover:bg-yellow-100 hover:border-yellow-300 px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      Open Chat
                    </button>
                  </div>

                  {/* Invite link */}
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-center gap-2">
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
