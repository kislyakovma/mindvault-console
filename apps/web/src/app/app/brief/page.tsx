'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, apiJson } from '@/lib/api'
import styles from './briefs.module.css'

interface Brief {
  id: string
  title: string
  status: 'DRAFT' | 'SUBMITTED'
  botName: string | null
  botStatus: string
  updatedAt: string
}

const BOT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает запуска', color: '#6b6b8a' },
  provisioning: { label: 'Запускается...', color: '#faad14' },
  active: { label: 'Работает', color: '#52c41a' },
  error: { label: 'Ошибка', color: '#ff4d4f' },
}

export default function BriefListPage() {
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [showForm, setShowForm] = useState(false)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    const data = await apiJson('/api/brief')
    setBriefs(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    const data = await apiJson('/api/brief', {
      method: 'POST',
      body: JSON.stringify({ title: newTitle.trim() }),
    })
    setCreating(false)
    setShowForm(false)
    setNewTitle('')
    if (data.id) router.push(`/app/brief/${data.id}`)
  }

  async function deleteBrief(id: string, title: string) {
    if (!confirm(`Удалить бота "${title}"?`)) return
    await apiFetch(`/api/brief/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Боты</h1>
        <button className={styles.newBtn} onClick={() => setShowForm(true)}>+ Новый бот</button>
      </div>
      <p className={styles.sub}>Каждый бот — отдельный ассистент. Создайте для себя, коллеги или члена семьи.</p>

      {showForm && (
        <div className={styles.newForm}>
          <form onSubmit={create} className={styles.formRow}>
            <input
              className={styles.input}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Название, например: Михаил — рабочий, Мама, Андрей..."
              autoFocus
            />
            <button className={styles.createBtn} type="submit" disabled={creating || !newTitle.trim()}>
              {creating ? '...' : 'Создать'}
            </button>
            <button className={styles.cancelBtn} type="button" onClick={() => setShowForm(false)}>✕</button>
          </form>
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : briefs.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📋</div>
          <div className={styles.emptyTitle}>Ботов пока нет</div>
          <div className={styles.emptySub}>Создайте первый, чтобы настроить ассистента</div>
          <button className={styles.newBtn} onClick={() => setShowForm(true)}>+ Создать бота</button>
        </div>
      ) : (
        <div className={styles.grid}>
          {briefs.map(b => {
            const botSt = BOT_STATUS_LABELS[b.botStatus] || BOT_STATUS_LABELS.pending
            return (
              <div key={b.id} className={styles.card} onClick={() => router.push(`/app/brief/${b.id}`)}>
                <div className={styles.cardTop}>
                  <div className={styles.cardTitle}>{b.title}</div>
                  <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); deleteBrief(b.id, b.title) }} title="Удалить">✕</button>
                </div>

                <div className={styles.cardMeta}>
                  <span className={`${styles.statusBadge} ${b.status === 'SUBMITTED' ? styles.badgeOk : styles.badgeDraft}`}>
                    {b.status === 'SUBMITTED' ? '✓ Заполнен' : '✎ Черновик'}
                  </span>
                  <span className={styles.date}>{new Date(b.updatedAt).toLocaleDateString('ru')}</span>
                </div>

                <div className={styles.botRow}>
                  <span className={styles.botDot} style={{ background: botSt.color }} />
                  <span className={styles.botLabel}>
                    {b.botName ? `Бот ${b.botName}` : 'Бот'}: <span style={{ color: botSt.color }}>{botSt.label}</span>
                  </span>
                </div>

                <div className={styles.editHint}>Нажмите чтобы редактировать →</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
