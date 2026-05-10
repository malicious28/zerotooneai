import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'planner' | 'admin'>('planner')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, name, password, role)
      }
      navigate('/chat')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex overflow-hidden">

      {/* Left — branding panel */}
      <div className="hidden lg:flex w-[44%] flex-col justify-between p-12 relative overflow-hidden flex-shrink-0">
        {/* Ambient glow */}
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
          <span className="font-bold text-gray-900 text-sm tracking-tight">AudienceBuilder</span>
        </div>

        {/* Hero text */}
        <div className="relative space-y-6">
          <div>
            <h2 className="text-[2.4rem] font-semibold text-gray-900 leading-tight tracking-tight">
              Build audiences<br />
              <span style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                that convert.
              </span>
            </h2>
            <p className="text-gray-400 text-sm mt-4 leading-relaxed max-w-xs">
              AI-powered audience signals, real-time collaboration, and reach estimation — all in one workspace.
            </p>
          </div>

          {/* Feature pills */}
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

        <p className="relative text-xs text-gray-300">© 2026 AudienceBuilder</p>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Subtle right-side glow */}
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
            <span className="font-bold text-gray-900 text-sm tracking-tight">AudienceBuilder</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              {mode === 'login' ? 'Welcome back' : 'Get started'}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {mode === 'login' ? 'Sign in to your workspace' : 'Create your free account'}
            </p>
          </div>

          {/* Tab toggle */}
          <div
            className="flex p-1 mb-7 rounded-xl"
            style={{
              background: 'linear-gradient(#f9fafb, #f9fafb) padding-box, linear-gradient(135deg, rgba(253,224,71,0.4), rgba(229,231,235,0.6)) border-box',
              border: '1px solid transparent',
            }}
          >
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Full Name</label>
                <div
                  style={{
                    background: 'linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(135deg, rgba(253,224,71,0.5), rgba(229,231,235,0.5)) border-box',
                    border: '1px solid transparent',
                    borderRadius: '0.75rem',
                  }}
                >
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="Jane Smith"
                    className="w-full bg-transparent px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none rounded-xl"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
              <div
                style={{
                  background: 'linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(135deg, rgba(253,224,71,0.5), rgba(229,231,235,0.5)) border-box',
                  border: '1px solid transparent',
                  borderRadius: '0.75rem',
                }}
              >
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
              <div
                style={{
                  background: 'linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(135deg, rgba(253,224,71,0.5), rgba(229,231,235,0.5)) border-box',
                  border: '1px solid transparent',
                  borderRadius: '0.75rem',
                }}
              >
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

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Role</label>
                <div
                  style={{
                    background: 'linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(135deg, rgba(253,224,71,0.5), rgba(229,231,235,0.5)) border-box',
                    border: '1px solid transparent',
                    borderRadius: '0.75rem',
                  }}
                >
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as 'planner' | 'admin')}
                    className="w-full bg-transparent px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none rounded-xl appearance-none"
                  >
                    <option value="planner">Media Planner</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            )}

            {error && (
              <p className="text-red-500 text-xs bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-medium py-2.5 rounded-xl text-sm transition-all disabled:opacity-60 mt-2"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 14px rgba(245,158,11,0.28)' }}
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-300 mt-8">
            By continuing, you agree to our terms of service.
          </p>
        </div>
      </div>
    </div>
  )
}
