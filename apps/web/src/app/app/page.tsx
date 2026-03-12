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

interface BriefInfo {
  id: string
  title: string
  status: string
  botName: string | null
  botStatus: string
  updatedAt: string
}

interface SystemStatus {
  hasBrief: boolean
  briefs: BriefInfo[]
}

const BOT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает запуска', color: '#6b6b8a' },
  provisioning: { label: 'Запускается...', color: '#faad14' },
  active: { label: 'Работает', color: '#52c41a' },
  error: { label: 'Ошибка', color: '#ff4d4f' },
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
  const [sysStatus, setSysStatus] = useState<SystemStatus>({ hasBrief: false, briefs: [] })
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
        briefs: briefStatus?.briefs || [],
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
                    ? `Заполнено брифов: ${sysStatus.briefs.filter(b => b.status === 'SUBMITTED').length}`
                    : 'Расскажите о себе — бот настроится под вас'}
                  href="/app/brief"
                />
                <StatusItem
                  ok={!!user?.telegramUsername}
                  label="Telegram"
                  sub={user?.telegramUsername ? `@${user.telegramUsername}` : 'Укажите username для связи с ботом'}
                  href="/app/account"
                />
                {sysStatus.briefs.length === 0 ? (
                  <StatusItem ok={false} label="Ассистент" sub="Будет запущен после заполнения брифа" href="/app/brief" />
                ) : sysStatus.briefs.map(b => {
                  const st = BOT_STATUS[b.botStatus] || BOT_STATUS.pending
                  return (
                    <StatusItem
                      key={b.id}
                      ok={b.botStatus === 'active'}
                      label={`Бот для «${b.title}»`}
                      sub={`${b.botName ? `${b.botName}: ` : ''}${st.label}`}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {!loading && !sysStatus.hasBrief && (
            <div className={styles.cta}>
              <div className={styles.ctaText}>
                <div className={styles.ctaTitle}>Заполните бриф</div>
                <div className={styles.ctaSub}>Это займёт 5 минут. Бот узнает кто вы, чем занимаетесь и как с вами общаться.</div>
              </div>
              <Link href="/app/brief" className={styles.ctaBtn}>Создать первый бриф →</Link>
            </div>
          )}
        </div>
      )}

      {tab === 'vpn' && <VpnTab />}
    </div>
  )
}
