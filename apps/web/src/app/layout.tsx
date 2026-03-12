import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MindVault Console',
  description: 'Личный кабинет MindVault',
  icons: { icon: '/favicon.svg' },
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
