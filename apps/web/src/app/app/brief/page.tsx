'use client'
import { useState } from 'react'
import styles from './brief.module.css'

export default function BriefPage() {
  const [role, setRole] = useState('')
  const [goals, setGoals] = useState('')
  const [tg, setTg] = useState('')
  const [projects, setProjects] = useState([{ name: '', description: '' }])
  const [saved, setSaved] = useState(false)

  const addProject = () => {
    if (projects.length < 5) setProjects([...projects, { name: '', description: '' }])
  }

  const updateProject = (i: number, field: 'name' | 'description', val: string) => {
    const p = [...projects]; p[i][field] = val; setProjects(p)
  }

  async function handleSave() {
    const token = localStorage.getItem('access_token')
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/brief`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role, goals, projects, language: 'ru', telegramUsername: tg || null }),
    })
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Бриф</h1>
      <p className={styles.sub}>Расскажите о себе — мы настроим систему под вас.</p>

      <div className={styles.section}>
        <label className={styles.label}>Роль / сфера деятельности</label>
        <input className={styles.input} value={role} onChange={e => setRole(e.target.value)} placeholder="Например: предприниматель, менеджер, разработчик" />
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Проекты (до 5)</label>
        {projects.map((p, i) => (
          <div key={i} className={styles.project}>
            <input className={styles.input} value={p.name} onChange={e => updateProject(i, 'name', e.target.value)} placeholder={`Проект ${i + 1}: название`} />
            <input className={styles.input} value={p.description} onChange={e => updateProject(i, 'description', e.target.value)} placeholder="Краткое описание" />
          </div>
        ))}
        {projects.length < 5 && (
          <button className={styles.addBtn} onClick={addProject}>+ Добавить проект</button>
        )}
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Цели и задачи</label>
        <textarea className={styles.textarea} value={goals} onChange={e => setGoals(e.target.value)} placeholder="Чего хотите достичь с помощью ассистента?" rows={4} />
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Telegram username (необязательно)</label>
        <input className={styles.input} value={tg} onChange={e => setTg(e.target.value)} placeholder="@username" />
      </div>

      <button className={styles.btn} onClick={handleSave}>
        {saved ? 'Сохранено ✓' : 'Сохранить'}
      </button>
    </div>
  )
}
