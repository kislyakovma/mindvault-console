'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SkeletonRow } from '@/components/Skeleton'
import styles from './admin.module.css'

interface User {
  id: string
  email: string
  role: string
  firstName?: string
  lastName?: string
  telegramUsername?: string
  createdAt: string
}

const API = process.env.NEXT_PUBLIC_API_URL || ''

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  // form
  const [email, setEmail] = useState('')
  const [tg, setTg] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [newCreds, setNewCreds] = useState<{ email: string; password: string; sentToUser: boolean } | null>(null)

  const token = () => typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` })

  const mountedRef = useRef(false)

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const url = `${API}/api/admin/users${q ? `?search=${encodeURIComponent(q)}` : ''}`
      const res = await fetch(url, { headers: headers() })
      if (res.status === 403) { window.location.href = '/app'; return }
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Начальная загрузка — один раз
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d?.user?.role === 'SUPERADMIN') setIsSuperAdmin(true) })
      .catch(() => {})
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search — только после первого рендера
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    const t = setTimeout(() => load(search || undefined), 300)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !tg) return
    setCreating(true); setMsg(null); setNewCreds(null)
    try {
      const res = await fetch(`${API}/api/admin/users`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ email, telegramUsername: tg, firstName: firstName || undefined, lastName: lastName || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ text: data.message || 'Ошибка', ok: false }); return }
      setNewCreds({ email: data.user.email, password: data.password, sentToUser: data.sentToUser })
      setEmail(''); setTg(''); setFirstName(''); setLastName('')
      load()
    } catch { setMsg({ text: 'Ошибка сети', ok: false }) }
    finally { setCreating(false) }
  }

  async function setRole(id: string, role: 'USER' | 'ADMIN') {
    const res = await fetch(`${API}/api/admin/users/${id}/role`, {
      method: 'PATCH', headers: headers(),
      body: JSON.stringify({ role }),
    })
    if (res.ok) load(search || undefined)
    else setMsg({ text: 'Ошибка смены роли', ok: false })
  }

  async function resetPassword(id: string) {
    const res = await fetch(`${API}/api/admin/users/${id}/reset-password`, { method: 'POST', headers: headers() })
    const data = await res.json()
    if (res.ok) {
      const note = data.sentToUser ? ' (отправлен пользователю)' : ' (передайте вручную)'
      setMsg({ text: `Новый пароль: ${data.password}${note}`, ok: true })
    } else setMsg({ text: 'Ошибка сброса', ok: false })
  }

  async function deleteUser(id: string, userEmail: string) {
    if (!confirm(`Удалить ${userEmail}?`)) return
    const res = await fetch(`${API}/api/admin/users/${id}`, { method: 'DELETE', headers: headers() })
    if (res.ok) load(search || undefined)
    else setMsg({ text: 'Ошибка удаления', ok: false })
  }

  const roleBadgeClass = (role: string) => {
    if (role === 'SUPERADMIN') return `${styles.badge} ${styles.badgeSuperAdmin}`
    if (role === 'ADMIN') return `${styles.badge} ${styles.badgeAdmin}`
    return styles.badge
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Пользователи</h1>

      {/* Форма создания */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Добавить пользователя</div>
        <form className={styles.form} onSubmit={create}>
          <div className={styles.row}>
            <input className={styles.input} type="text" placeholder="Имя" value={firstName} onChange={e => setFirstName(e.target.value)} />
            <input className={styles.input} type="text" placeholder="Фамилия" value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
          <input className={styles.input} type="email" placeholder="Email *" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className={styles.input} type="text" placeholder="Telegram @username *" value={tg} onChange={e => setTg(e.target.value)} required />
          <button className={styles.btn} type="submit" disabled={creating || !email || !tg}>
            {creating ? 'Создаём...' : 'Создать и отправить пароль →'}
          </button>
        </form>

        {msg && <div className={`${styles.notice} ${msg.ok ? styles.ok : styles.err}`}>{msg.text}</div>}

        {newCreds && (
          <div className={styles.credsBox}>
            <div className={styles.credsTitle}>✓ Аккаунт создан</div>
            <div className={styles.cred}><span>Email</span><code>{newCreds.email}</code></div>
            <div className={styles.cred}><span>Пароль</span><code>{newCreds.password}</code></div>
            <div className={styles.credsNote}>
              {newCreds.sentToUser
                ? '✓ Пароль отправлен пользователю в Telegram.'
                : '⚠️ Пользователь не писал боту — пароль отправлен вам. Передайте вручную.'}
            </div>
          </div>
        )}
      </div>

      {/* Таблица */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>Все пользователи ({users.length})</div>
          <input
            className={styles.search}
            type="text"
            placeholder="Поиск по email, имени, TG…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div>{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</div>
        ) : users.length === 0 ? (
          <div className={styles.loading}>Ничего не найдено</div>
        ) : (
          <div className={styles.table}>
            {users.map(u => (
              <div key={u.id} className={styles.row2}>
                <div className={styles.userInfo}>
                  {(u.firstName || u.lastName) && (
                    <div className={styles.userName}>{[u.firstName, u.lastName].filter(Boolean).join(' ')}</div>
                  )}
                  <div className={styles.userEmail}>{u.email}</div>
                  <div className={styles.userMeta}>
                    <span className={roleBadgeClass(u.role)}>{u.role}</span>
                    {u.telegramUsername && <span className={styles.tg}>@{u.telegramUsername}</span>}
                    <span className={styles.date}>{new Date(u.createdAt).toLocaleDateString('ru')}</span>
                  </div>
                </div>
                <div className={styles.rowActions}>
                  {isSuperAdmin && u.role !== 'SUPERADMIN' && (
                    <button
                      className={styles.actionBtn}
                      title={u.role === 'ADMIN' ? 'Разжаловать в USER' : 'Сделать ADMIN'}
                      onClick={() => setRole(u.id, u.role === 'ADMIN' ? 'USER' : 'ADMIN')}
                    >
                      {u.role === 'ADMIN' ? '👤' : '🛡'}
                    </button>
                  )}
                  <button className={styles.actionBtn} onClick={() => router.push(`/app/admin/users/${u.id}`)} title="Ассистенты">📋</button>
                  <button className={styles.actionBtn} onClick={() => resetPassword(u.id)} title="Сбросить пароль">🔑</button>
                  <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => deleteUser(u.id, u.email)} title="Удалить">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
