const API = process.env.NEXT_PUBLIC_API_URL || ''

let refreshing: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // refresh_token из cookie
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.accessToken) {
      localStorage.setItem('access_token', data.accessToken)
      return data.accessToken
    }
    return null
  } catch {
    return null
  }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('access_token') || ''

  const makeHeaders = (t: string) => ({
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
    Authorization: `Bearer ${t}`,
  })

  let res = await fetch(`${API}${path}`, { ...options, headers: makeHeaders(token) })

  if (res.status === 401) {
    // Только один рефреш одновременно
    if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null })
    const newToken = await refreshing

    if (newToken) {
      res = await fetch(`${API}${path}`, { ...options, headers: makeHeaders(newToken) })
    } else {
      // Рефреш не помог — редирект на логин
      if (typeof window !== 'undefined') window.location.href = '/login'
    }
  }

  return res
}

export function apiJson<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  return apiFetch(path, options).then(r => r.json())
}
