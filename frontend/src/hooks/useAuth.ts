import { useState, useEffect, createContext, useContext } from 'react'
import { api } from '../lib/api'
import { resetSocket } from '../lib/socket'

interface AuthContextType {
  user: any | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, name: string, password: string, role?: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

export function useAuthState(): AuthContextType {
  const [user, setUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    api.auth.me().then(r => { setUser(r.user); setLoading(false) }).catch(() => { localStorage.removeItem('token'); setLoading(false) })
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password)
    localStorage.setItem('token', res.token)
    setUser(res.user)
  }

  const register = async (email: string, name: string, password: string, role?: string) => {
    const res = await api.auth.register(email, name, password, role)
    localStorage.setItem('token', res.token)
    setUser(res.user)
  }

  const logout = () => {
    localStorage.removeItem('token')
    resetSocket()
    setUser(null)
  }

  return { user, loading, login, register, logout }
}
