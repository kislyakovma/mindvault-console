'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import styles from './Sidebar.module.css'

const links = [
  { href: '/app', label: 'Статус', icon: '⚡' },
  { href: '/app/brief', label: 'Ассистенты', icon: '📋' },
  { href: '/app/billing', label: 'Оплата', icon: '💳' },
  { href: '/app/support', label: 'Поддержка', icon: '💬' },
  { href: '/app/account', label: 'Аккаунт', icon: '👤' },
]

const adminLink = { href: '/app/admin', label: 'Админ', icon: '🛡' }

export default function Sidebar() {
  const path = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d?.user?.role === 'ADMIN' || d?.user?.role === 'SUPERADMIN') setIsAdmin(true) })
      .catch(() => {})
  }, [])

  const allLinks = isAdmin ? [...links, adminLink] : links

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>Mind<span>Vault</span></div>
      <nav className={styles.nav}>
        {allLinks.map(l => (
          <Link key={l.href} href={l.href}
            className={`${styles.link} ${path === l.href ? styles.active : ''}`}>
            <span className={styles.icon}>{l.icon}</span>
            <span className={styles.label}>{l.label}</span>
          </Link>
        ))}
      </nav>
      <div className={styles.bottom}>
        <button className={styles.logout} onClick={() => {
          localStorage.removeItem('access_token')
          window.location.href = '/login'
        }}>
          Выйти
        </button>
      </div>
    </aside>
  )
}
