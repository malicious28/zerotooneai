import { useState, useEffect, FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

export default function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  useAuth()

  const [group, setGroup] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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
      const r = await api.auth.registerViaInvite(code, email, name, password)
      localStorage.setItem('token', r.token)
      navigate('/chat')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-blue-100">
      <p className="text-gray-500">Validating invite link...</p>
    </div>
  )

  if (error && !group) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-blue-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <p className="text-4xl mb-4">🔗</p>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid Invite Link</h2>
        <p className="text-gray-500 text-sm">{error}</p>
        <button onClick={() => navigate('/login')} className="mt-6 text-violet-600 hover:underline text-sm">Go to login</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-blue-100">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">👥</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">You've been invited!</h1>
          <p className="text-gray-500 text-sm mt-1">
            Join <span className="font-semibold text-violet-600">{group?.name}</span> on AudienceBuilder
          </p>
          <p className="text-xs text-gray-400 mt-1">{group?.member_count ?? 0} members · managed by {group?.admin_name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" placeholder="Your name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" placeholder="••••••••" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-medium py-2 rounded-lg transition-colors">
            {submitting ? 'Joining...' : `Join ${group?.name}`}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} className="text-violet-500 hover:underline">Sign in</button>
        </p>
      </div>
    </div>
  )
}
