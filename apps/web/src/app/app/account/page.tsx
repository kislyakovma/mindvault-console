'use client'
import { useState, useEffect } from 'react'
import styles from './account.module.css'

const API = process.env.NEXT_PUBLIC_API_URL || ''

export default function AccountPage() {
  const [user, setUser] = useState<any>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [tg, setTg] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)

  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [passMsg, setPassMsg] = useState('')

  const token = () => localStorage.getItem('access_token') || ''
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` })

  useEffect(() => {
    fetch(`${API}/api/auth/me`, { headers: headers() })
      .then(r => r.json())
      .then(d => {
        const u = d.user
        setUser(u)
        setFirstName(u.firstName || '')
        setLastName(u.lastName || '')
        setTg(u.telegramUsername || '')
      })
  }, [])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    await fetch(`${API}/api/auth/profile`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ firstName, lastName, telegramUsername: tg }),
    })
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2000)
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(`${API}/api/account/password`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ currentPassword: current, newPassword: newPass }),
    })
    setPassMsg(res.ok ? 'Пароль изменён' : 'Неверный текущий пароль')
    if (res.ok) { setCurrent(''); setNewPass('') }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Аккаунт</h1>

      {/* Профиль */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Профиль</div>
        <form className={styles.form} onSubmit={saveProfile}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Имя</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Имя" />
            </div>
            <div className={styles.field}>
              <label>Фамилия</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Фамилия" />
            </div>
          </div>
          <div className={styles.field}>
            <label>Telegram</label>
            <div className={styles.inputIcon}>
              <span className={styles.prefix}>@</span>
              <input value={tg} onChange={e => setTg(e.target.value.replace('@', ''))} placeholder="username" />
            </div>
          </div>
          <button type="submit" className={styles.btn}>{profileSaved ? 'Сохранено ✓' : 'Сохранить профиль'}</button>
        </form>
      </div>

      {/* Email */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Email</div>
        <div className={styles.emailRow}>
          <span className={styles.emailVal}>{user?.email || '—'}</span>
          <span className={styles.badge}>
            <span className={styles.dot} />
            Подтверждён
          </span>
        </div>
        <p className={styles.hint}>Смена email будет доступна в следующей версии.</p>
      </div>

      {/* Пароль */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Пароль</div>
        <form className={styles.form} onSubmit={changePassword}>
          <div className={styles.field}>
            <label>Текущий пароль</label>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••••" />
          </div>
          <div className={styles.field}>
            <label>Новый пароль</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="мин. 8 символов" />
          </div>
          {passMsg && <div className={`${styles.notice} ${passMsg.includes('изменён') ? styles.ok : styles.err}`}>{passMsg}</div>}
          <button type="submit" className={styles.btn} disabled={!current || newPass.length < 8}>Сменить пароль</button>
        </form>
      </div>

      {/* Выход */}
      <button className={styles.logout} onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login' }}>
        Выйти
      </button>
    </div>
  )
}
