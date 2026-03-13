'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import VpnTab from '@/components/VpnTab'
import { apiJson } from '@/lib/api'
import { SkeletonStatusItem, Skeleton } from '@/components/Skeleton'
import styles from './dashboard.module.css'

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

function StatusItem({ ok, label, sub, href, tgUsername }: {
  ok: boolean; label: string; sub?: string; href?: string; tgUsername?: string
}) {
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
      {ok && tgUsername && (
        <a
          href={`https://t.me/${tgUsername.replace(/^@/, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.tgBtn}
        >
          ✈ Написать
        </a>
      )}
      {ok && !tgUsername && <span className={styles.statusBadge}>✓</span>}
    </div>
  )
}

export default function DashboardPage() {
  const [tab, setTab] = useState('status')
  const [sysStatus, setSysStatus] = useState<SystemStatus>({ hasBrief: false, briefs: [] })
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      apiJson('/api/brief/status'),
      apiJson('/api/auth/me'),
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
        {loading
          ? <Skeleton width="220px" height="32px" radius="8px" />
          : <h1 className={styles.title}>{name ? `Привет, ${name.split(' ')[0]} 👋` : 'Система'}</h1>
        }
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
              <div className={styles.skeletonList}>
                {[...Array(4)].map((_, i) => <SkeletonStatusItem key={i} />)}
              </div>
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
                  label="Ассистенты"
                  sub={sysStatus.hasBrief
                    ? `Настроено ассистентов: ${sysStatus.briefs.filter(b => b.status === 'SUBMITTED').length}`
                    : 'Создайте ассистента и заполните настройки'}
                  href="/app/brief"
                />
                <StatusItem
                  ok={!!user?.telegramUsername}
                  label="Telegram"
                  sub={user?.telegramUsername ? `@${user.telegramUsername}` : 'Укажите username для связи с ассистентом'}
                  href="/app/account"
                />
                {sysStatus.briefs.length === 0 ? (
                  <StatusItem ok={false} label="Ассистент" sub="Создайте первого бота чтобы начать" href="/app/brief" />
                ) : sysStatus.briefs.map(b => {
                  const st = BOT_STATUS[b.botStatus] || BOT_STATUS.pending
                  const isActive = b.botStatus === 'active'
                  return (
                    <StatusItem
                      key={b.id}
                      ok={isActive}
                      label={`Ассистент «${b.title}»`}
                      sub={b.botName ? `${b.botName} · ${st.label}` : st.label}
                      tgUsername={isActive && b.botName ? b.botName : undefined}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {!loading && !sysStatus.hasBrief && (
            <div className={styles.cta}>
              <div className={styles.ctaText}>
                <div className={styles.ctaTitle}>Создайте ассистента</div>
                <div className={styles.ctaSub}>Это займёт 5 минут. Ассистент узнает кто вы, чем занимаетесь и как с вами общаться.</div>
              </div>
              <Link href="/app/brief" className={styles.ctaBtn}>Создать ассистента →</Link>
            </div>
          )}
        </div>
      )}

      {tab === 'vpn' && <VpnTab />}
    </div>
  )
}
