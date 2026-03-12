'use client'
import { useState, useEffect } from 'react'
import styles from './brief.module.css'

const API = process.env.NEXT_PUBLIC_API_URL || ''

const WORK_STYLES = ['Утром', 'Днём', 'Вечером', 'Ночью', 'В любое время']
const COMM_STYLES = ['Коротко и по делу', 'С деталями и объяснениями', 'Дружелюбно и неформально', 'Строго и профессионально']
const TIMEZONES = ['UTC+2 (Калининград)', 'UTC+3 (Москва)', 'UTC+4 (Самара)', 'UTC+5 (Екатеринбург)', 'UTC+6 (Омск)', 'UTC+7 (Новосибирск)', 'UTC+8 (Иркутск)', 'UTC+9 (Якутск)', 'UTC+10 (Владивосток)', 'UTC+11 (Магадан)', 'UTC+12 (Камчатка)', 'Другой']

export default function BriefPage() {
  // Базовое
  const [botName, setBotName] = useState('')
  const [tg, setTg] = useState('')

  // Профессиональное
  const [role, setRole] = useState('')
  const [projects, setProjects] = useState([{ name: '', description: '' }])
  const [goals, setGoals] = useState('')

  // Личное
  const [timezone, setTimezone] = useState('UTC+3 (Москва)')
  const [workTime, setWorkTime] = useState('')
  const [commStyle, setCommStyle] = useState('')
  const [language, setLanguage] = useState('ru')
  const [interests, setInterests] = useState('')
  const [avoid, setAvoid] = useState('')

  // Контекст для SOUL
  const [values, setValues] = useState('')
  const [decisions, setDecisions] = useState('')
  const [lifeContext, setLifeContext] = useState('')

  const [saved, setSaved] = useState(false)

  const token = () => localStorage.getItem('access_token') || ''
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` })

  // Подтянуть TG из аккаунта
  useEffect(() => {
    fetch(`${API}/api/auth/me`, { headers: headers() })
      .then(r => r.json())
      .then(d => { if (d?.user?.telegramUsername) setTg(d.user.telegramUsername) })
  }, [])

  const addProject = () => {
    if (projects.length < 5) setProjects([...projects, { name: '', description: '' }])
  }

  const updateProject = (i: number, field: 'name' | 'description', val: string) => {
    const p = [...projects]; p[i][field] = val; setProjects(p)
  }

  async function handleSave() {
    await fetch(`${API}/api/brief`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({
        botName, role, goals, projects, language, telegramUsername: tg || null,
        timezone, workTime, commStyle, interests, avoid, values, decisions, lifeContext,
      }),
    })
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Бриф</h1>
      <p className={styles.sub}>
        Эта информация нужна для того, чтобы ваш AI-ассистент говорил на вашем языке, 
        знал ваш контекст и был максимально полезен с первого дня — а не обучался месяцами.
      </p>

      {/* Блок 1: Ваш ассистент */}
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
          <label className={styles.label}>Ваш Telegram</label>
          <div className={styles.inputPrefix}>
            <span>@</span>
            <input className={styles.input} value={tg} onChange={e => setTg(e.target.value.replace('@', ''))} placeholder="username" />
          </div>
          <span className={styles.fieldHint}>Нужен чтобы бот знал, кому отвечать</span>
        </div>
      </div>

      {/* Блок 2: Работа и проекты */}
      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <div className={styles.blockNum}>02</div>
          <div>
            <div className={styles.blockTitle}>Работа и проекты</div>
            <div className={styles.blockHint}>Бот будет помнить ваши проекты и оперировать вашими задачами, а не абстрактными примерами.</div>
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
          {projects.length < 5 && (
            <button className={styles.addBtn} onClick={addProject}>+ Добавить проект</button>
          )}
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Цели на ближайшее время</label>
          <textarea className={styles.textarea} value={goals} onChange={e => setGoals(e.target.value)} placeholder="Что хотите достичь за следующие 3–6 месяцев?" rows={3} />
          <span className={styles.fieldHint}>Бот будет держать эти цели в фокусе и напоминать о них</span>
        </div>
      </div>

      {/* Блок 3: Стиль общения */}
      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <div className={styles.blockNum}>03</div>
          <div>
            <div className={styles.blockTitle}>Как вам комфортно общаться</div>
            <div className={styles.blockHint}>Бот адаптирует тон, объём ответов и время активности под вас.</div>
          </div>
        </div>
        <div className={styles.twoCol}>
          <div className={styles.section}>
            <label className={styles.label}>Предпочтительное время работы</label>
            <div className={styles.chips}>
              {WORK_STYLES.map(w => (
                <button key={w} type="button" className={`${styles.chip} ${workTime === w ? styles.chipActive : ''}`} onClick={() => setWorkTime(w)}>{w}</button>
              ))}
            </div>
          </div>
          <div className={styles.section}>
            <label className={styles.label}>Стиль общения</label>
            <div className={styles.chips}>
              {COMM_STYLES.map(c => (
                <button key={c} type="button" className={`${styles.chip} ${commStyle === c ? styles.chipActive : ''}`} onClick={() => setCommStyle(c)}>{c}</button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.twoCol}>
          <div className={styles.section}>
            <label className={styles.label}>Язык общения</label>
            <div className={styles.chips}>
              {[['ru', '🇷🇺 Русский'], ['en', '🇺🇸 English'], ['both', '🌐 Оба']].map(([v, l]) => (
                <button key={v} type="button" className={`${styles.chip} ${language === v ? styles.chipActive : ''}`} onClick={() => setLanguage(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className={styles.section}>
            <label className={styles.label}>Часовой пояс</label>
            <select className={styles.select} value={timezone} onChange={e => setTimezone(e.target.value)}>
              {TIMEZONES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Блок 4: Личный контекст */}
      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <div className={styles.blockNum}>04</div>
          <div>
            <div className={styles.blockTitle}>Личный контекст</div>
            <div className={styles.blockHint}>Чем больше бот знает о вас, тем точнее советы. Это не просматривается командой — только используется для настройки вашего ассистента.</div>
          </div>
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Интересы и увлечения</label>
          <input className={styles.input} value={interests} onChange={e => setInterests(e.target.value)} placeholder="Спорт, книги, путешествия, музыка..." />
          <span className={styles.fieldHint}>Бот сможет делать более персональные рекомендации</span>
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Что вас раздражает / чего избегать</label>
          <input className={styles.input} value={avoid} onChange={e => setAvoid(e.target.value)} placeholder="Длинные списки, сухой тон, постоянные вопросы..." />
          <span className={styles.fieldHint}>Бот учтёт это с самого начала</span>
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Ваши ценности и принципы</label>
          <textarea className={styles.textarea} value={values} onChange={e => setValues(e.target.value)} placeholder="Что для вас важно в жизни и работе? Семья, рост, свобода, честность..." rows={3} />
          <span className={styles.fieldHint}>Формирует «характер» ассистента и его фильтр при советах</span>
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Как вы принимаете решения</label>
          <textarea className={styles.textarea} value={decisions} onChange={e => setDecisions(e.target.value)} placeholder="Опираетесь на данные? Интуицию? Советуетесь с кем-то? Долго взвешиваете?" rows={2} />
          <span className={styles.fieldHint}>Бот будет поддерживать ваш стиль, а не навязывать свой</span>
        </div>
        <div className={styles.section}>
          <label className={styles.label}>Текущий жизненный контекст</label>
          <textarea className={styles.textarea} value={lifeContext} onChange={e => setLifeContext(e.target.value)} placeholder="Что сейчас происходит в вашей жизни? Переезд, запуск бизнеса, смена карьеры, семья..." rows={3} />
          <span className={styles.fieldHint}>Помогает боту понять ваши приоритеты прямо сейчас</span>
        </div>
      </div>

      <button className={styles.btn} onClick={handleSave}>
        {saved ? 'Сохранено ✓' : 'Сохранить бриф →'}
      </button>
    </div>
  )
}
