'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import VpnTab from '@/components/VpnTab'
import styles from './dashboard.module.css'

const API = process.env.NEXT_PUBLIC_API_URL || ''

const TABS = [
  { id: 'status', label: '⚡ Статус' },
  { id: 'vpn', label: '🔒 VPN' },
]

interface SystemStatus {
  hasBrief: boolean
  briefUpdatedAt: string | null
}

function StatusItem({ ok, label, sub, href }: { ok: boolean; label: string; sub?: string; href?: string }) {
  return (
    <div className={styles.statusItem}>
      <div className={`${styles.statusDot} ${ok ? styles.dotOk : styles.dotWarn}`} />
      <div className={styles.statusInfo}>
        <div className={styles.statusLabel}>{label}</div>
        {sub && <div className={styles.statusSub}>{sub}</div>}
      </div>
      {!ok && href && (
        <Link href={href} className={styles.statusAction}>Заполнить →</Link>
      )}
      {ok && <span className={styles.statusBadge}>✓</span>}
    </div>
  )
}

export default function DashboardPage() {
  const [tab, setTab] = useState('status')
  const [sysStatus, setSysStatus] = useState<SystemStatus>({ hasBrief: false, briefUpdatedAt: null })
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const t = localStorage.getItem('access_token') || ''
    const h = { Authorization: `Bearer ${t}` }
    Promise.all([
      fetch(`${API}/api/brief/status`, { headers: h }).then(r => r.json()),
      fetch(`${API}/api/auth/me`, { headers: h }).then(r => r.json()),
    ]).then(([briefStatus, me]) => {
      setSysStatus({
        hasBrief: briefStatus?.hasBrief || false,
        briefUpdatedAt: briefStatus?.briefUpdatedAt || null,
      })
      setUser(me?.user || null)
    }).finally(() => setLoading(false))
  }, [])

  const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : ''

  return (
    <div>
      <div className={styles.welcomeRow}>
        <h1 className={styles.title}>{name ? `Привет, ${name.split(' ')[0]} 👋` : 'Система'}</h1>
      </div>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'status' && (
        <div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Статус настройки</div>
            {loading ? (
              <div className={styles.loading}>Загрузка...</div>
            ) : (
              <div className={styles.statusList}>
                <StatusItem
                  ok={!!user?.firstName}
                  label="Профиль"
                  sub={user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Заполните имя и фамилию'}
                  href="/app/account"
                />
                <StatusItem
                  ok={sysStatus.hasBrief}
                  label="Бриф"
                  sub={sysStatus.hasBrief
                    ? `Обновлён ${sysStatus.briefUpdatedAt ? new Date(sysStatus.briefUpdatedAt).toLocaleDateString('ru') : ''}`
                    : 'Расскажите о себе — бот настроится под вас'}
                  href="/app/brief"
                />
                <StatusItem
                  ok={!!user?.telegramUsername}
                  label="Telegram"
                  sub={user?.telegramUsername ? `@${user.telegramUsername}` : 'Укажите username для связи с ботом'}
                  href="/app/account"
                />
                <StatusItem
                  ok={false}
                  label="Ассистент"
                  sub="Будет запущен после заполнения брифа"
                />
              </div>
            )}
          </div>

          {!sysStatus.hasBrief && !loading && (
            <div className={styles.cta}>
              <div className={styles.ctaText}>
                <div className={styles.ctaTitle}>Заполните бриф</div>
                <div className={styles.ctaSub}>Это займёт 5 минут. Бот узнает кто вы, чем занимаетесь и как с вами общаться.</div>
              </div>
              <Link href="/app/brief" className={styles.ctaBtn}>Заполнить бриф →</Link>
            </div>
          )}
        </div>
      )}

      {tab === 'vpn' && <VpnTab />}
    </div>
  )
}
