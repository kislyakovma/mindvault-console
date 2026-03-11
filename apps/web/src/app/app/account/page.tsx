'use client'
import { useState } from 'react'
import styles from '../../login/login.module.css'

export default function AccountPage() {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [msg, setMsg] = useState('')

  async function handleChange(e: React.FormEvent) {
    e.preventDefault()
    const token = localStorage.getItem('access_token')
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword: current, newPassword: newPass }),
    })
    setMsg(res.ok ? 'Пароль изменён' : 'Ошибка')
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, marginBottom: 32 }}>Аккаунт</h1>
      <div style={{ maxWidth: 400 }}>
        <form className={styles.form} onSubmit={handleChange}>
          <div className={styles.field}>
            <label>Текущий пароль</label>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label>Новый пароль</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} />
          </div>
          {msg && <div style={{ color: msg.includes('Ошибка') ? '#ff4d4f' : '#52c41a', fontSize: 13 }}>{msg}</div>}
          <button type="submit" className={styles.btn} disabled={!current || newPass.length < 8}>
            Сохранить пароль
          </button>
        </form>
        <button onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login' }}
          style={{ marginTop: 24, background: 'transparent', border: '1px solid rgba(255,77,79,0.3)', borderRadius: 8, padding: '10px 20px', color: '#ff4d4f', fontSize: 13, cursor: 'pointer' }}>
          Выйти со всех устройств
        </button>
      </div>
    </div>
  )
}
