'use client'
import { useState, useEffect } from 'react'
import { apiJson, apiFetch } from '@/lib/api'
import { Skeleton, SkeletonText } from '@/components/Skeleton'
import styles from './billing.module.css'

interface Transaction {
  id: string
  amountKopecks: number
  type: string
  description: string
  createdAt: string
}

interface Sub {
  id: string
  status: string
  priceKopecks: number
  nextBillingAt: string
  brief: { id: string; title: string; botName: string | null }
}

const TX_ICONS: Record<string, string> = {
  TOPUP: '↑',
  CHARGE: '↓',
  REFUND: '↩',
  BONUS: '★',
  ADJUSTMENT: '✎',
}

const TX_COLORS: Record<string, string> = {
  TOPUP: '#52c41a',
  BONUS: '#52c41a',
  REFUND: '#52c41a',
  CHARGE: '#ff4d4f',
  ADJUSTMENT: '#faad14',
}

const SUB_STATUS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Активна', color: '#52c41a' },
  PAUSED: { label: 'Приостановлена', color: '#faad14' },
  CANCELLED: { label: 'Отменена', color: '#6b6b8a' },
}

function Rub({ kopecks, sign = false }: { kopecks: number; sign?: boolean }) {
  const prefix = sign && kopecks > 0 ? '+' : ''
  const isPositive = kopecks >= 0
  return (
    <>{prefix}{(Math.abs(kopecks) / 100).toLocaleString('ru', { minimumFractionDigits: 2 })}{' '}<span className="rub" style={{ color: 'inherit' }}>₽</span></>
  )
}

export default function BillingPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [subs, setSubs] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      apiJson('/api/billing/balance'),
      apiJson('/api/billing/transactions'),
      apiJson('/api/billing/subscriptions'),
    ]).then(([b, t, s]) => {
      setBalance(b?.balanceKopecks ?? 0)
      setTxs(Array.isArray(t) ? t : [])
      setSubs(Array.isArray(s) ? s : [])
    }).finally(() => setLoading(false))
  }, [])

  async function cancelSub(id: string) {
    if (!confirm('Отменить подписку?')) return
    setCancelling(id)
    await apiFetch(`/api/billing/subscriptions/${id}`, { method: 'DELETE' })
    setSubs(prev => prev.map(s => s.id === id ? { ...s, status: 'CANCELLED' } : s))
    setCancelling(null)
  }

  if (loading) return (
    <div className={styles.page}>
      <Skeleton width="140px" height="30px" radius="8px" />
      <div style={{ height: 24 }} />
      <div className={styles.card}><SkeletonText lines={3} /></div>
      <div style={{ height: 16 }} />
      <div className={styles.card}><SkeletonText lines={5} /></div>
    </div>
  )

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Баланс и подписки</h1>

      {/* Баланс */}
      <div className={styles.balanceCard}>
        <div className={styles.balanceLabel}>Текущий баланс</div>
        <div className={styles.balanceAmount}>{(( balance ?? 0) / 100).toLocaleString('ru', { minimumFractionDigits: 2 })}{' '}<span className="rub">₽</span></div>
        <div className={styles.balanceSub}>Пополнение через платёжные инструменты — скоро</div>
        <button className={styles.topupBtn} disabled>Пополнить баланс</button>
      </div>

      {/* Подписки */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Подписки на ассистентов</div>
        {subs.length === 0 ? (
          <div className={styles.empty}>Нет активных подписок</div>
        ) : (
          <div className={styles.subList}>
            {subs.map(s => {
              const st = SUB_STATUS[s.status] || SUB_STATUS.ACTIVE
              return (
                <div key={s.id} className={styles.subRow}>
                  <div className={styles.subInfo}>
                    <div className={styles.subName}>{s.brief.title}{s.brief.botName ? ` (${s.brief.botName})` : ''}</div>
                    <div className={styles.subMeta}>
                      <span style={{ color: st.color }}>{st.label}</span>
                      {s.status === 'ACTIVE' && (
                        <span className={styles.subDate}>· следующее списание {new Date(s.nextBillingAt).toLocaleDateString('ru')}</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.subRight}>
                    <span className={styles.subPrice}>{(s.priceKopecks / 100).toLocaleString('ru')}{' '}<span className="rub">₽</span>/мес</span>
                    {s.status === 'ACTIVE' && (
                      <button
                        className={styles.cancelBtn}
                        onClick={() => cancelSub(s.id)}
                        disabled={cancelling === s.id}
                      >
                        {cancelling === s.id ? '...' : 'Отменить'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* История транзакций */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>История транзакций</div>
        {txs.length === 0 ? (
          <div className={styles.empty}>Транзакций пока нет</div>
        ) : (
          <div className={styles.txList}>
            {txs.map(tx => (
              <div key={tx.id} className={styles.txRow}>
                <span className={styles.txIcon} style={{ color: TX_COLORS[tx.type] || 'var(--muted)' }}>
                  {TX_ICONS[tx.type] || '·'}
                </span>
                <div className={styles.txInfo}>
                  <div className={styles.txDesc}>{tx.description}</div>
                  <div className={styles.txDate}>{new Date(tx.createdAt).toLocaleString('ru')}</div>
                </div>
                <span className={styles.txAmount} style={{ color: TX_COLORS[tx.type] || 'var(--text)' }}>
                  {tx.amountKopecks >= 0 ? '+' : ''}{(tx.amountKopecks / 100).toLocaleString('ru', { minimumFractionDigits: 2 })}{' '}<span className="rub">₽</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
