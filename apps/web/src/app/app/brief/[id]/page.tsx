'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import styles from '../brief.module.css'

const API = process.env.NEXT_PUBLIC_API_URL || ''
const WORK_STYLES = ['Утром', 'Днём', 'Вечером', 'Ночью', 'В любое время']
const COMM_STYLES = ['Коротко и по делу', 'С деталями и объяснениями', 'Дружелюбно и неформально', 'Строго и профессионально']
const TIMEZONES = ['UTC+2 (Калининград)', 'UTC+3 (Москва)', 'UTC+4 (Самара)', 'UTC+5 (Екатеринбург)', 'UTC+6 (Новосибирск)', 'UTC+7 (Красноярск)', 'UTC+8 (Иркутск)', 'UTC+9 (Якутск)', 'UTC+10 (Владивосток)', 'Другой']

export default function BriefEditorPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [briefTitle, setBriefTitle] = useState('Мой бриф')
  const [botName, setBotName] = useState('')
  const [tg, setTg] = useState('')
  const [role, setRole] = useState('')
  const [projects, setProjects] = useState([{ name: '', description: '' }])
  const [goals, setGoals] = useState('')
  const [timezone, setTimezone] = useState('UTC+3 (Москва)')
  const [workTime, setWorkTime] = useState('')
  const [commStyle, setCommStyle] = useState('')
  const [language, setLanguage] = useState('ru')
  const [interests, setInterests] = useState('')
  const [avoid, setAvoid] = useState('')
  const [values, setValues] = useState('')
  const [decisions, setDecisions] = useState('')
  const [lifeContext, setLifeContext] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const token = () => localStorage.getItem('access_token') || ''
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` })

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`${API}/api/brief/${id}`, { headers: headers() }).then(r => r.json()),
      fetch(`${API}/api/auth/me`, { headers: headers() }).then(r => r.json()),
    ]).then(([brief, me]) => {
      if (brief?.title) setBriefTitle(brief.title)
      if (brief?.botName) setBotName(brief.botName)
      if (brief?.role) setRole(brief.role)
      if (brief?.goals) setGoals(brief.goals)
      if (brief?.projects?.length) setProjects(brief.projects)
      if (brief?.timezone) setTimezone(brief.timezone)
      if (brief?.workTime) setWorkTime(brief.workTime)
      if (brief?.commStyle) setCommStyle(brief.commStyle)
      if (brief?.language) setLanguage(brief.language)
      if (brief?.interests) setInterests(brief.interests)
      if (brief?.avoid) setAvoid(brief.avoid)
      if (brief?.values) setValues(brief.values)
      if (brief?.decisions) setDecisions(brief.decisions)
      if (brief?.lifeContext) setLifeContext(brief.lifeContext)
      if (brief?.telegramUsername) setTg(brief.telegramUsername)
      else if (me?.user?.telegramUsername) setTg(me.user.telegramUsername)
    }).finally(() => setLoading(false))
  }, [id])

  const addProject = () => { if (projects.length < 5) setProjects([...projects, { name: '', description: '' }]) }
  const updateProject = (i: number, field: 'name' | 'description', val: string) => {
    const p = [...projects]; p[i][field] = val; setProjects(p)
  }

  async function handleSave() {
    await fetch(`${API}/api/brief/${id}`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ title: briefTitle, botName, role, goals, projects, language, telegramUsername: tg || null, timezone, workTime, commStyle, interests, avoid, values, decisions, lifeContext }),
    })
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px' }}>Загрузка...</div>

  return (
    <div className={styles.page}>
      <div className={styles.editorHeader}>
        <Link href="/app/brief" className={styles.backLink}>← Все брифы</Link>
        <input
          className={styles.titleInput}
          value={briefTitle}
          onChange={e => setBriefTitle(e.target.value)}
          placeholder="Название брифа"
        />
      </div>

      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <div className={styles.blockNum}>01</div>
          <div>
            <div className={styles.blockTitle}>Ваш ассистент</div>
            <div className={styles.blockHint}>Как назовёте — так и будет. Имя задаёт характер.</div>
          </div>
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Имя бота</label>
          <input className={styles.input} value={botName} onChange={e => setBotName(e.target.value)} placeholder="Например: Алекс, Тони, Макс..." />
          <span className={styles.fieldHint}>Ассистент будет представляться этим именем в Telegram</span>
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Telegram пользователя</label>
          <div className={styles.inputPrefix}><span>@</span><input className={styles.input} value={tg} onChange={e => setTg(e.target.value.replace('@', ''))} placeholder="username" /></div>
          <span className={styles.fieldHint}>Кому этот ассистент будет отвечать</span>
        </div>
      </div>

      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <div className={styles.blockNum}>02</div>
          <div>
            <div className={styles.blockTitle}>Работа и проекты</div>
            <div className={styles.blockHint}>Бот будет помнить ваши проекты и оперировать вашими задачами.</div>
          </div>
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Кто вы профессионально</label>
          <input className={styles.input} value={role} onChange={e => setRole(e.target.value)} placeholder="Предприниматель, продакт, разработчик, консультант..." />
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Текущие проекты (до 5)</label>
          {projects.map((p, i) => (
            <div key={i} className={styles.project}>
              <input className={styles.input} value={p.name} onChange={e => updateProject(i, 'name', e.target.value)} placeholder={`Проект ${i + 1}: название`} />
              <input className={styles.input} value={p.description} onChange={e => updateProject(i, 'description', e.target.value)} placeholder="Чем занимается, что сейчас важно" />
            </div>
          ))}
          {projects.length < 5 && <button className={styles.addBtn} onClick={addProject}>+ Добавить проект</button>}
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Цели на ближайшее время</label>
          <textarea className={styles.textarea} value={goals} onChange={e => setGoals(e.target.value)} placeholder="Что хотите достичь за следующие 3–6 месяцев?" rows={3} />
        </div>
      </div>

      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <div className={styles.blockNum}>03</div>
          <div>
            <div className={styles.blockTitle}>Стиль общения</div>
            <div className={styles.blockHint}>Бот адаптирует тон, объём ответов и время активности под вас.</div>
          </div>
        </div>
        <div className={styles.twoCol}>
          <div className={styles.section}>
            <label className={styles.label}>Время работы</label>
            <div className={styles.chips}>{WORK_STYLES.map(w => <button key={w} type="button" className={`${styles.chip} ${workTime === w ? styles.chipActive : ''}`} onClick={() => setWorkTime(w)}>{w}</button>)}</div>
          </div>
          <div className={styles.section}>
            <label className={styles.label}>Стиль общения</label>
            <div className={styles.chips}>{COMM_STYLES.map(c => <button key={c} type="button" className={`${styles.chip} ${commStyle === c ? styles.chipActive : ''}`} onClick={() => setCommStyle(c)}>{c}</button>)}</div>
          </div>
        </div>
        <div className={styles.twoCol}>
          <div className={styles.section}>
            <label className={styles.label}>Язык</label>
            <div className={styles.chips}>{[['ru','🇷🇺 Русский'],['en','🇺🇸 English'],['both','🌐 Оба']].map(([v,l]) => <button key={v} type="button" className={`${styles.chip} ${language === v ? styles.chipActive : ''}`} onClick={() => setLanguage(v)}>{l}</button>)}</div>
          </div>
          <div className={styles.section}>
            <label className={styles.label}>Часовой пояс</label>
            <select className={styles.select} value={timezone} onChange={e => setTimezone(e.target.value)}>{TIMEZONES.map(t => <option key={t}>{t}</option>)}</select>
          </div>
        </div>
      </div>

      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <div className={styles.blockNum}>04</div>
          <div>
            <div className={styles.blockTitle}>Личный контекст</div>
            <div className={styles.blockHint}>Используется только для настройки ассистента — не передаётся третьим лицам.</div>
          </div>
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Интересы и увлечения</label>
          <input className={styles.input} value={interests} onChange={e => setInterests(e.target.value)} placeholder="Спорт, книги, путешествия..." />
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Что раздражает / чего избегать</label>
          <input className={styles.input} value={avoid} onChange={e => setAvoid(e.target.value)} placeholder="Длинные списки, сухой тон..." />
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Ценности и принципы</label>
          <textarea className={styles.textarea} value={values} onChange={e => setValues(e.target.value)} placeholder="Что для вас важно в жизни и работе?" rows={3} />
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Как принимаете решения</label>
          <textarea className={styles.textarea} value={decisions} onChange={e => setDecisions(e.target.value)} placeholder="Данные, интуиция, советы?" rows={2} />
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Текущий жизненный контекст</label>
          <textarea className={styles.textarea} value={lifeContext} onChange={e => setLifeContext(e.target.value)} placeholder="Что сейчас происходит в вашей жизни?" rows={3} />
        </div>
      </div>

      <button className={styles.btn} onClick={handleSave}>
        {saved ? 'Сохранено ✓' : 'Сохранить бриф →'}
      </button>
    </div>
  )
}
