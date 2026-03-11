'use client'
import { useState } from 'react'
import Link from 'next/link'
import styles from './login.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const valid = email.length > 3 && password.length >= 8

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(res.status === 401 ? 'Неверный email или пароль' : d.message || 'Ошибка')
        return
      }
      const data = await res.json()
      localStorage.setItem('access_token', data.accessToken)
      window.location.href = '/app'
    } catch {
      setError('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>Mind<span>Vault</span></div>
        <h1 className={styles.title}>Вход</h1>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>
          <div className={styles.field}>
            <label>Пароль</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.btn} disabled={!valid || loading}>
            {loading ? 'Входим...' : 'Войти →'}
          </button>
        </form>

        <div className={styles.links}>
          <Link href="/reset-password">Забыли пароль?</Link>
          <Link href="/signup">Создать аккаунт</Link>
        </div>
      </div>
    </div>
  )
}
