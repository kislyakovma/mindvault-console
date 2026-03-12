'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Sidebar.module.css'

const links = [
  { href: '/app', label: 'Статус', icon: '⚡' },
  { href: '/app/brief', label: 'Бриф', icon: '📋' },
  { href: '/app/billing', label: 'Оплата', icon: '💳' },
  { href: '/app/support', label: 'Поддержка', icon: '💬' },
  { href: '/app/account', label: 'Аккаунт', icon: '👤' },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>Mind<span>Vault</span></div>
      <nav className={styles.nav}>
        {links.map(l => (
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
