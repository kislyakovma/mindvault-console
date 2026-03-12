'use client'
import { useState, useEffect, useCallback } from 'react'
import styles from './VpnTab.module.css'

const API = process.env.NEXT_PUBLIC_API_URL || ''

interface Cert {
  id: string
  name: string
  status: 'ACTIVE' | 'REVOKED'
  createdAt: string
  revokedAt?: string
  config?: string
}

export default function VpnTab() {
  const [certs, setCerts] = useState<Cert[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [showConfig, setShowConfig] = useState<string | null>(null)

  const token = () => localStorage.getItem('access_token') || ''
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/vpn/certs`, { headers: headers() })
      const data = await res.json()
      setCerts(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function issue(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true); setMsg(null)
    try {
      const res = await fetch(`${API}/api/vpn/certs`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ text: data.message || 'Ошибка', ok: false }); return }
      setMsg({ text: 'Сертификат выпущен', ok: true })
      setNewName('')
      load()
    } catch { setMsg({ text: 'Ошибка сети', ok: false }) }
    finally { setCreating(false) }
  }

  async function revoke(id: string, name: string) {
    if (!confirm(`Отозвать сертификат "${name}"?`)) return
    const res = await fetch(`${API}/api/vpn/certs/${id}/revoke`, { method: 'POST', headers: headers() })
    if (res.ok) { setMsg({ text: `Сертификат "${name}" отозван`, ok: true }); load() }
    else setMsg({ text: 'Ошибка при отзыве', ok: false })
  }

  async function download(id: string, name: string) {
    const res = await fetch(`${API}/api/vpn/certs/${id}/config`, { headers: headers() })
    if (!res.ok) { setMsg({ text: 'Конфиг недоступен', ok: false }); return }
    const data = await res.json()
    const blob = new Blob([data.config], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${name}.conf`; a.click()
    URL.revokeObjectURL(url)
  }

  const activeCerts = certs.filter(c => c.status === 'ACTIVE')
  const revokedCerts = certs.filter(c => c.status === 'REVOKED')

  return (
    <div className={styles.wrap}>
      {/* Заголовок */}
      <div className={styles.intro}>
        <div className={styles.introIcon}>🔒</div>
        <div>
          <div className={styles.introTitle}>WireGuard VPN</div>
          <div className={styles.introText}>Каждый сертификат — отдельный пир. Выпускайте под устройство: телефон, ноутбук, планшет. Отозванные сертификаты немедленно блокируются.</div>
        </div>
      </div>

      {/* Форма выпуска */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Выпустить новый сертификат</div>
        <form className={styles.issueForm} onSubmit={issue}>
          <input
            className={styles.input}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Название устройства, например: iPhone, MacBook..."
            required
          />
          <button className={styles.issueBtn} type="submit" disabled={creating || !newName.trim()}>
            {creating ? 'Генерируем...' : '+ Выпустить'}
          </button>
        </form>
        {msg && <div className={`${styles.notice} ${msg.ok ? styles.ok : styles.err}`}>{msg.text}</div>}
      </div>

      {/* Активные */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Активные сертификаты ({activeCerts.length})</div>
        {loading ? (
          <div className={styles.empty}>Загрузка...</div>
        ) : activeCerts.length === 0 ? (
          <div className={styles.empty}>Нет активных сертификатов</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Название</th>
                <th>Выпущен</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activeCerts.map(c => (
                <tr key={c.id}>
                  <td className={styles.certName}>{c.name}</td>
                  <td className={styles.date}>{new Date(c.createdAt).toLocaleDateString('ru')}</td>
                  <td><span className={styles.badgeActive}>● Активен</span></td>
                  <td className={styles.actions}>
                    <button className={styles.actionBtn} onClick={() => download(c.id, c.name)} title="Скачать .conf">↓ Скачать</button>
                    <button className={`${styles.actionBtn} ${styles.revokeBtn}`} onClick={() => revoke(c.id, c.name)} title="Отозвать">✕ Отозвать</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Отозванные */}
      {revokedCerts.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Отозванные ({revokedCerts.length})</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Название</th>
                <th>Выпущен</th>
                <th>Отозван</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {revokedCerts.map(c => (
                <tr key={c.id} className={styles.revoked}>
                  <td className={styles.certName}>{c.name}</td>
                  <td className={styles.date}>{new Date(c.createdAt).toLocaleDateString('ru')}</td>
                  <td className={styles.date}>{c.revokedAt ? new Date(c.revokedAt).toLocaleDateString('ru') : '—'}</td>
                  <td><span className={styles.badgeRevoked}>✕ Отозван</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
