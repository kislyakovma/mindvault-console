'use client'
import { useState, useEffect, useCallback } from 'react'
import styles from './admin.module.css'

interface User {
  id: string
  email: string
  role: string
  createdAt: string
}

const API = process.env.NEXT_PUBLIC_API_URL || ''

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [tg, setTg] = useState('')
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [newCreds, setNewCreds] = useState<{ email: string; password: string } | null>(null)

  const token = () => typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/users`, { headers: headers() })
      if (res.status === 403) { window.location.href = '/app'; return }
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setCreating(true); setMsg(null); setNewCreds(null)
    try {
      const res = await fetch(`${API}/api/admin/users`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ email, telegramUsername: tg || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ text: data.message || 'Ошибка', ok: false }); return }
      setNewCreds({ email: data.user.email, password: data.password })
      setEmail(''); setTg('')
      load()
    } catch { setMsg({ text: 'Ошибка сети', ok: false }) }
    finally { setCreating(false) }
  }

  async function resetPassword(id: string) {
    const res = await fetch(`${API}/api/admin/users/${id}/reset-password`, { method: 'POST', headers: headers() })
    const data = await res.json()
    if (res.ok) setMsg({ text: `Новый пароль: ${data.password}`, ok: true })
    else setMsg({ text: 'Ошибка сброса', ok: false })
  }

  async function deleteUser(id: string, userEmail: string) {
    if (!confirm(`Удалить ${userEmail}?`)) return
    const res = await fetch(`${API}/api/admin/users/${id}`, { method: 'DELETE', headers: headers() })
    if (res.ok) load()
    else setMsg({ text: 'Ошибка удаления', ok: false })
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Пользователи</h1>

      {/* Форма создания */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Добавить пользователя</div>
        <form className={styles.form} onSubmit={create}>
          <input className={styles.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className={styles.input} type="text" placeholder="Telegram @username (необязательно)" value={tg} onChange={e => setTg(e.target.value)} />
          <button className={styles.btn} type="submit" disabled={creating || !email}>
            {creating ? 'Создаём...' : 'Создать и отправить пароль →'}
          </button>
        </form>

        {msg && (
          <div className={`${styles.notice} ${msg.ok ? styles.ok : styles.err}`}>
            {msg.text}
          </div>
        )}

        {newCreds && (
          <div className={styles.credsBox}>
            <div className={styles.credsTitle}>✓ Аккаунт создан</div>
            <div className={styles.cred}><span>Email</span><code>{newCreds.email}</code></div>
            <div className={styles.cred}><span>Пароль</span><code>{newCreds.password}</code></div>
            <div className={styles.credsNote}>Пароль отправлен в Telegram. Сохраните его — повторно не показываем.</div>
          </div>
        )}
      </div>

      {/* Таблица юзеров */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Все пользователи ({users.length})</div>
        {loading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : (
          <div className={styles.table}>
            {users.map(u => (
              <div key={u.id} className={styles.row}>
                <div className={styles.userInfo}>
                  <div className={styles.userEmail}>{u.email}</div>
                  <div className={styles.userMeta}>
                    <span className={`${styles.badge} ${u.role === 'ADMIN' ? styles.badgeAdmin : ''}`}>{u.role}</span>
                    <span className={styles.date}>{new Date(u.createdAt).toLocaleDateString('ru')}</span>
                  </div>
                </div>
                <div className={styles.rowActions}>
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
