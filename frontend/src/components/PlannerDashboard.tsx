import { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface Props {
  group: any
  onStartBuilding: () => void
}

export default function PlannerDashboard({ group, onStartBuilding }: Props) {
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!group) return
    setLoading(true)
    api.groups.getMembers(group.id)
      .then(r => setMembers(r.members))
      .finally(() => setLoading(false))
  }, [group?.id])

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${group.invite_code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* Header bar */}
      <div className="px-6 py-5 bg-white border-b">
        <h2 className="font-bold text-gray-800 text-lg">Welcome back</h2>
        <p className="text-sm text-gray-400 mt-0.5">Build audiences or chat with your team</p>
      </div>

      <div className="p-6 space-y-5">
        {/* Start building CTA */}
        <div className="bg-indigo-600 rounded-xl p-5 text-white">
          <p className="font-semibold text-lg">Build a new audience</p>
          <p className="text-indigo-200 text-sm mt-1">Describe your target audience in plain English and the AI will structure it for you.</p>
          <button
            onClick={onStartBuilding}
            className="mt-4 bg-white text-indigo-600 font-semibold text-sm px-5 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            + New Audience
          </button>
        </div>

        {/* Group section */}
        {group ? (
          <>
            {/* Group card */}
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                  {group.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{group.name}</p>
                  <p className="text-xs text-gray-400">Managed by {group.admin_name}</p>
                </div>
              </div>

              {/* Invite link — planners can also share this */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Invite teammates to your group</p>
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2.5">
                  <code className="flex-1 text-xs text-gray-600 truncate">
                    {`${window.location.origin}/join/${group.invite_code}`}
                  </code>
                  <button
                    onClick={copyInviteLink}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0 transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
                  >
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
            </div>

            {/* Members */}
            <div className="bg-white rounded-xl border p-4">
              <p className="font-semibold text-gray-800 text-sm mb-3">
                Team Members
                <span className="ml-2 text-xs font-normal text-gray-400">{members.length} people</span>
              </p>
              {loading ? (
                <p className="text-sm text-gray-400">Loading...</p>
              ) : (
                <div className="space-y-1">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                        <p className="text-xs text-gray-400 truncate">{m.email}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.role === 'admin' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border p-8 text-center">
            <div className="text-3xl mb-3">👥</div>
            <p className="text-sm font-medium text-gray-600">You're not in a group yet</p>
            <p className="text-xs text-gray-400 mt-1">Ask your admin for an invite link to join a team</p>
          </div>
        )}
      </div>
    </div>
  )
}
