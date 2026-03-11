import styles from './StatusCard.module.css'

const STATUS_LABELS: Record<string, { label: string; color: string; cta?: string; ctaHref?: string }> = {
  DRAFT: { label: 'Черновик', color: 'muted', cta: 'Заполнить бриф →', ctaHref: '/app/brief' },
  PAYMENT_REQUIRED: { label: 'Требуется оплата', color: 'yellow', cta: 'Оплатить →', ctaHref: '/app/billing' },
  QUEUED: { label: 'В очереди', color: 'blue' },
  PROVISIONING: { label: 'Настраиваем систему...', color: 'blue' },
  READY: { label: 'Готово ✅', color: 'green', cta: 'Инструкции ↓' },
  FAILED: { label: 'Ошибка', color: 'red', cta: 'Повторить', ctaHref: '#retry' },
  SUSPENDED: { label: 'Приостановлено', color: 'yellow', cta: 'Оплатить →', ctaHref: '/app/billing' },
}

export default function StatusCard({ status }: { status: string }) {
  const s = STATUS_LABELS[status] || { label: status, color: 'muted' }
  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <div className={`${styles.badge} ${styles[s.color]}`}>{s.label}</div>
      </div>
      <p className={styles.desc}>{getDescription(status)}</p>
      {s.cta && (
        <a href={s.ctaHref || '#'} className={styles.cta}>{s.cta}</a>
      )}
    </div>
  )
}

function getDescription(status: string) {
  const d: Record<string, string> = {
    DRAFT: 'Заполните бриф, чтобы мы настроили вашу систему.',
    PAYMENT_REQUIRED: 'Нужна оплата, чтобы запустить настройку.',
    QUEUED: 'В очереди. Начнём в ближайшее время.',
    PROVISIONING: 'Настраиваем вашу систему. Это займёт до 30 минут.',
    READY: 'Ваша система готова к работе.',
    FAILED: 'Во время настройки произошла ошибка.',
    SUSPENDED: 'Доступ приостановлен из-за проблем с оплатой.',
  }
  return d[status] || ''
}
