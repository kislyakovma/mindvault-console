'use client'
import { useState } from 'react'
import Link from 'next/link'
import styles from '../login/login.module.css'

export default function SignupPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [tg, setTg] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const valid = firstName.trim().length > 0
    && lastName.trim().length > 0
    && tg.trim().length > 0
    && email.length > 3
    && password.length >= 8

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          telegramUsername: tg.replace('@', ''),
          email,
          password,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(res.status === 409 ? 'Этот email уже зарегистрирован' : d.message || 'Ошибка')
        return
      }
      const data = await res.json()
      localStorage.setItem('access_token', data.accessToken)
      window.location.href = '/app'
    } catch { setError('Ошибка сети') } finally { setLoading(false) }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>Mind<span>Vault</span></div>
        <h1 className={styles.title}>Регистрация</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Имя *</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Иван" />
            </div>
            <div className={styles.field}>
              <label>Фамилия *</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Иванов" />
            </div>
          </div>
          <div className={styles.field}>
            <label>Telegram *</label>
            <div className={styles.inputPrefix}>
              <span>@</span>
              <input value={tg} onChange={e => setTg(e.target.value.replace('@', ''))} placeholder="username" />
            </div>
          </div>
          <div className={styles.field}>
            <label>Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className={styles.field}>
            <label>Пароль * (мин. 8 символов)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" className={styles.btn} disabled={!valid || loading}>
            {loading ? 'Создаём аккаунт...' : 'Создать аккаунт →'}
          </button>
        </form>
        <div className={styles.links}>
          <span />
          <Link href="/login">Уже есть аккаунт</Link>
        </div>
      </div>
    </div>
  )
}
