import { useState, useEffect, FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

const gradientBorder = {
  background: 'linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(135deg, rgba(253,224,71,0.5), rgba(229,231,235,0.5)) border-box',
  border: '1px solid transparent',
  borderRadius: '0.75rem',
}

export default function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user, registerViaInvite } = useAuth()

  const [group, setGroup] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (user) { navigate('/chat', { replace: true }); return }
  }, [user, navigate])

  useEffect(() => {
    if (!code) return
    api.groups.getByInvite(code)
      .then(r => setGroup(r.group))
      .catch(() => setError('This invite link is invalid or has expired.'))
      .finally(() => setLoading(false))
  }, [code])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!code) return
    setSubmitting(true)
    setError('')
    try {
      await registerViaInvite(code, email, name, password)
      navigate('/chat', { replace: true })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <p className="text-gray-400 text-sm">Validating invite link...</p>
    </div>
  )

  if (error && !group) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-sm text-center px-8">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 14px rgba(245,158,11,0.28)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Invite Link</h2>
        <p className="text-gray-400 text-sm mb-6">{error}</p>
        <button
          onClick={() => navigate('/login')}
          className="text-sm font-medium"
          style={{ color: '#d97706' }}
        >
          Go to sign in
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white flex overflow-hidden">

      {/* Left — branding panel */}
      <div className="hidden lg:flex w-[44%] flex-col justify-between p-12 relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-[55%] bg-gradient-to-br from-yellow-100/80 via-amber-50/60 to-transparent" />
          <div className="absolute bottom-0 right-0 w-72 h-72 bg-gradient-to-tl from-yellow-200/40 to-transparent blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 14px rgba(245,158,11,0.30)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="white"/>
            </svg>
          </div>
          <span className="font-bold text-gray-900 text-sm tracking-tight">Sightline</span>
        </div>

        {/* Invite context */}
        <div className="relative space-y-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: '#d97706' }}>You're invited</p>
            <h2 className="text-[2.4rem] font-semibold text-gray-900 leading-tight tracking-tight">
              Join the<br />
              <span style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {group?.name}
              </span>
              <br />team.
            </h2>
            <p className="text-gray-400 text-sm mt-4 leading-relaxed max-w-xs">
              {group?.member_count ?? 0} {group?.member_count === 1 ? 'member' : 'members'} already collaborating — managed by {group?.admin_name}.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {[
              { icon: '✦', label: 'AI signal extraction from natural language' },
              { icon: '⬡', label: 'Real-time collaborative audience building' },
              { icon: '◎', label: 'Reach estimation across segments' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
                >
                  {f.icon}
                </div>
                <span className="text-sm text-gray-500">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-gray-300">© 2026 Sightline</p>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-yellow-50/60 to-transparent pointer-events-none" />

        <div className="w-full max-w-sm relative">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-10 justify-center">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="white"/>
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-tight">Sightline</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4"
              style={{ background: 'rgba(245,158,11,0.10)', color: '#d97706' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
              Invited to {group?.name}
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Create your account</h1>
            <p className="text-sm text-gray-400 mt-1">
              Managed by <span className="text-gray-600 font-medium">{group?.admin_name}</span> · {group?.member_count ?? 0} {group?.member_count === 1 ? 'member' : 'members'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Full Name</label>
              <div style={gradientBorder}>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Jane Smith"
                  className="w-full bg-transparent px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
              <div style={gradientBorder}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full bg-transparent px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
              <div style={gradientBorder}>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-transparent px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none rounded-xl"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-xs bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full text-white font-medium py-2.5 rounded-xl text-sm transition-all disabled:opacity-60 mt-2"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 14px rgba(245,158,11,0.28)' }}
            >
              {submitting ? 'Joining...' : `Join ${group?.name}`}
            </button>
          </form>

          <p className="text-center text-xs text-gray-300 mt-8">
            Already have an account?{' '}
            <button
              onClick={() => navigate('/login')}
              className="font-medium"
              style={{ color: '#d97706' }}
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
