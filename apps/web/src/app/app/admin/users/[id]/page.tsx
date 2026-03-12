'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiJson, apiFetch } from '@/lib/api'
import styles from './user.module.css'

interface Brief {
  id: string
  title: string
  status: 'DRAFT' | 'SUBMITTED'
  botName: string | null
  botStatus: string
  updatedAt: string
}

interface BriefDetail extends Brief {
  botName: string | null
  role?: string
  goals?: string
  interests?: string
  avoid?: string
  values?: string
  decisions?: string
  lifeContext?: string
  workTime?: string
  commStyle?: string
  language?: string
  timezone?: string
  telegramUsername?: string
  projects?: { name: string; description: string }[]
  user?: { id: string; email: string; firstName: string; lastName: string }
}

const LABELS: Record<string, string> = {
  role: 'Роль',
  goals: 'Цели',
  interests: 'Интересы',
  avoid: 'Избегать',
  values: 'Ценности',
  decisions: 'Принятие решений',
  lifeContext: 'Жизненный контекст',
  workTime: 'Время работы',
  commStyle: 'Стиль общения',
  language: 'Язык',
  timezone: 'Часовой пояс',
  telegramUsername: 'Telegram',
  botName: 'Имя бота',
}

export default function AdminUserPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [selected, setSelected] = useState<BriefDetail | null>(null)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiJson(`/api/admin/users/${id}/briefs`)
      .then(data => { setBriefs(Array.isArray(data) ? data : []) })
      .finally(() => setLoading(false))
  }, [id])

  async function openBrief(briefId: string) {
    const data = await apiJson(`/api/admin/briefs/${briefId}`)
    setSelected(data)
    setEditData({ ...data })
    setEditing(false)
  }

  async function saveBrief() {
    if (!selected) return
    setSaving(true)
    const res = await apiFetch(`/api/admin/briefs/${selected.id}`, {
      method: 'PUT',
      body: JSON.stringify(editData),
    })
    const updated = await res.json()
    setSaving(false)
    if (res.ok) {
      setMsg({ text: 'Сохранено', ok: true })
      setBriefs(prev => prev.map(b => b.id === selected.id ? { ...b, ...updated } : b))
      setSelected({ ...selected, ...updated })
      setEditing(false)
    } else {
      setMsg({ text: updated.message || 'Ошибка', ok: false })
    }
    setTimeout(() => setMsg(null), 3000)
  }

  const FIELDS = ['botName', 'role', 'goals', 'telegramUsername', 'workTime', 'commStyle', 'language', 'timezone', 'interests', 'avoid', 'values', 'decisions', 'lifeContext']

  return (
    <div className={styles.page}>
      <Link href="/app/admin" className={styles.back}>← Пользователи</Link>
      <h1 className={styles.title}>Брифы пользователя</h1>

      {loading ? (
        <div className={styles.empty}>Загрузка...</div>
      ) : briefs.length === 0 ? (
        <div className={styles.empty}>Брифов нет</div>
      ) : (
        <div className={styles.layout}>
          {/* Список брифов */}
          <div className={styles.list}>
            {briefs.map(b => (
              <div
                key={b.id}
                className={`${styles.briefCard} ${selected?.id === b.id ? styles.briefCardActive : ''}`}
                onClick={() => openBrief(b.id)}
              >
                <div className={styles.briefTitle}>{b.title}</div>
                <div className={styles.briefMeta}>
                  <span className={`${styles.badge} ${b.status === 'SUBMITTED' ? styles.badgeOk : styles.badgeDraft}`}>
                    {b.status === 'SUBMITTED' ? '✓ Заполнен' : 'Черновик'}
                  </span>
                  <span className={styles.date}>{new Date(b.updatedAt).toLocaleDateString('ru')}</span>
                </div>
                {b.botName && <div className={styles.botName}>Бот: {b.botName}</div>}
              </div>
            ))}
          </div>

          {/* Детальный просмотр */}
          {selected && (
            <div className={styles.detail}>
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.detailTitle}>{selected.title}</div>
                  {selected.user && <div className={styles.detailUser}>{selected.user.email}</div>}
                </div>
                <div className={styles.detailActions}>
                  {msg && <span className={`${styles.msg} ${msg.ok ? styles.msgOk : styles.msgErr}`}>{msg.text}</span>}
                  {editing ? (
                    <>
                      <button className={styles.saveBtn} onClick={saveBrief} disabled={saving}>{saving ? '...' : 'Сохранить'}</button>
                      <button className={styles.cancelBtn} onClick={() => { setEditing(false); setEditData({ ...selected }) }}>Отмена</button>
                    </>
                  ) : (
                    <button className={styles.editBtn} onClick={() => setEditing(true)}>Редактировать</button>
                  )}
                </div>
              </div>

              <div className={styles.fields}>
                {FIELDS.map(key => {
                  const val = editData[key]
                  if (!editing && !val) return null
                  return (
                    <div key={key} className={styles.field}>
                      <label className={styles.fieldLabel}>{LABELS[key] || key}</label>
                      {editing ? (
                        key === 'goals' || key === 'values' || key === 'lifeContext' || key === 'decisions' ? (
                          <textarea className={styles.textarea} value={val || ''} onChange={e => setEditData({ ...editData, [key]: e.target.value })} rows={3} />
                        ) : (
                          <input className={styles.input} value={val || ''} onChange={e => setEditData({ ...editData, [key]: e.target.value })} />
                        )
                      ) : (
                        <div className={styles.fieldVal}>{val || '—'}</div>
                      )}
                    </div>
                  )
                })}

                {/* Projects */}
                {editData.projects?.length > 0 && (
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Проекты</label>
                    {editData.projects.map((p: any, i: number) => (
                      <div key={i} className={styles.project}>
                        {editing ? (
                          <>
                            <input className={styles.input} value={p.name || ''} onChange={e => { const pr = [...editData.projects]; pr[i].name = e.target.value; setEditData({ ...editData, projects: pr }) }} placeholder="Название" />
                            <input className={styles.input} value={p.description || ''} onChange={e => { const pr = [...editData.projects]; pr[i].description = e.target.value; setEditData({ ...editData, projects: pr }) }} placeholder="Описание" />
                          </>
                        ) : (
                          <div className={styles.fieldVal}><strong>{p.name}</strong>{p.description ? ` — ${p.description}` : ''}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
