const BASE = 'http://localhost:3001/api'

function getToken() {
  return localStorage.getItem('token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'Request failed')
  }
  return res.json()
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (email: string, name: string, password: string, role?: string) =>
      request<{ token: string; user: any }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, name, password, role }) }),
    registerViaInvite: (code: string, email: string, name: string, password: string) =>
      request<{ token: string; user: any; group: any }>(`/auth/register/invite/${code}`, { method: 'POST', body: JSON.stringify({ email, name, password }) }),
    me: () => request<{ user: any; group: any | null }>('/auth/me'),
  },
  groups: {
    list: () => request<{ groups: any[] }>('/groups'),
    create: (name: string) => request<{ group: any; invite_code: string }>('/groups', { method: 'POST', body: JSON.stringify({ name }) }),
    getByInvite: (code: string) => request<{ group: any }>(`/groups/invite/${code}`),
    regenerateInvite: (id: string) => request<{ invite_code: string }>(`/groups/${id}/regenerate-invite`, { method: 'POST' }),
    getMembers: (id: string) => request<{ members: any[] }>(`/groups/${id}/members`),
    getMessages: (id: string, since?: string) => request<{ messages: any[] }>(`/groups/${id}/messages${since ? `?since=${since}` : ''}`),
    sendMessage: (id: string, content: string) => request<{ message: any }>(`/groups/${id}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
    exportAudience: (id: string, data: any) => request<{ message: any }>(`/groups/${id}/export-audience`, { method: 'POST', body: JSON.stringify(data) }),
  },
  conversations: {
    list: () => request<{ conversations: any[] }>('/conversations'),
    create: () => request<{ conversation: any }>('/conversations', { method: 'POST' }),
    get: (id: string) => request<{ conversation: any; messages: any[]; signals: any; participants: any[] }>(`/conversations/${id}`),
    patch: (id: string, data: any) => request<{ ok: boolean }>(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    confirm: (id: string) => request<{ ok: boolean }>(`/conversations/${id}/confirm`, { method: 'POST' }),
    confirmedList: () => request<{ audiences: any[] }>('/conversations/admin/confirmed'),
    getParticipants: (id: string) => request<{ participants: any[] }>(`/chat/${id}/participants`),
    invite: (conversationId: string, userId: string) => request<{ ok: boolean }>(`/chat/${conversationId}/invite`, { method: 'POST', body: JSON.stringify({ userId }) }),
  },
  chat: {
    send: (conversationId: string, content: string) =>
      request<{ message: any; signals: any[]; audience_estimate: any }>(`/chat/${conversationId}/message`, { method: 'POST', body: JSON.stringify({ content }) }),
    removeSignal: (conversationId: string, signalId: string) =>
      request<{ signals: any[]; audience_estimate: any }>(`/chat/${conversationId}/signals/${signalId}`, { method: 'DELETE' }),
  },
}
