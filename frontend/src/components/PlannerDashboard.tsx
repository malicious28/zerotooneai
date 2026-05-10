import { useState, useEffect, FormEvent } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

interface Props {
  group: any
  onStartBuilding: (firstMessage?: string) => void
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

const ACTION_PILLS = [
  {
    label: 'Signals',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
      </svg>
    ),
  },
  {
    label: 'Estimate Reach',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    label: 'Deep Research',
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
]

export default function PlannerDashboard({ group, onStartBuilding }: Props) {
  const { user } = useAuth()
  const [welcomeInput, setWelcomeInput] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const firstName = user?.name?.split(' ')[0] ?? 'there'

  useEffect(() => {
    if (!group) return
    api.groups.getMembers(group.id).then(r => setMembers(r.members)).catch(() => {})
  }, [group?.id])

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    onStartBuilding(welcomeInput.trim() || undefined)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-white">

      {/* Ambient top glow — soft warm yellow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[260px] bg-gradient-to-b from-yellow-200/70 to-transparent blur-3xl" />
      </div>

      {/* Greeting */}
      <h1 className="text-[1.85rem] font-semibold text-gray-900 text-center leading-tight tracking-tight">
        {getGreeting()}, {firstName}
      </h1>
      <h2 className="text-[1.85rem] font-semibold text-center leading-tight mt-0.5 tracking-tight">
        How Can I{' '}
        <span style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          Assist You Today?
        </span>
      </h2>

      {/* Command input card */}
      <form onSubmit={handleSubmit} className="w-full max-w-2xl mt-10 px-4 relative z-10">
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
              value={welcomeInput}
              onChange={e => setWelcomeInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="✦  Initiate a query or send a command to the AI..."
              rows={3}
              className="w-full px-5 pt-5 pb-2 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none bg-transparent leading-relaxed"
            />

            <div className="flex items-center gap-1.5 px-4 pb-4 pt-2 relative">
              {/* Subtle bottom-left warm glow */}
              <div className="absolute bottom-0 left-0 w-48 h-14 bg-gradient-to-tr from-yellow-50/80 to-transparent rounded-bl-[15px] pointer-events-none" />

              {/* Paperclip */}
              <button type="button" className="relative z-10 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>

              {ACTION_PILLS.map(pill => (
                <button
                  key={pill.label}
                  type="button"
                  className="relative z-10 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-white hover:bg-yellow-50 border border-gray-200 hover:border-yellow-200 px-3 py-1.5 rounded-lg transition-all"
                >
                  <span className="text-gray-400">{pill.icon}</span>
                  {pill.label}
                </button>
              ))}

              {/* Send button */}
              <button
                type="submit"
                className="relative z-10 ml-auto w-8 h-8 flex items-center justify-center rounded-xl text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Group info strip */}
      {group && members.length > 0 && (
        <div className="flex items-center gap-3 mt-6 text-xs text-gray-400">
          <div className="flex -space-x-1.5">
            {members.slice(0, 4).map(m => (
              <div key={m.id} className="w-5 h-5 rounded-full bg-yellow-100 border-2 border-white flex items-center justify-center text-yellow-700 font-semibold" style={{ fontSize: 8 }}>
                {m.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          <span>{group.name} · {members.length} member{members.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  )
}
