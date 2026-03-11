import styles from './ProvisioningSteps.module.css'

const STEPS = [
  { key: 'CREATE_SERVER', label: 'Сервер создан' },
  { key: 'WAIT_SSH', label: 'SSH доступен' },
  { key: 'APPLY_TERRAFORM', label: 'Установка завершена' },
  { key: 'HEALTHCHECK', label: 'Проверка здоровья' },
]

const ORDER = ['NONE', 'CREATE_SERVER', 'WAIT_SSH', 'APPLY_TERRAFORM', 'HEALTHCHECK', 'FINALIZE']

export default function ProvisioningSteps({ currentStep, status }: { currentStep: string; status: string }) {
  if (!['QUEUED', 'PROVISIONING', 'FAILED', 'READY'].includes(status)) return null
  const currentIdx = ORDER.indexOf(currentStep)

  return (
    <div className={styles.wrap}>
      <h3 className={styles.heading}>Прогресс настройки</h3>
      <div className={styles.steps}>
        {STEPS.map((s, i) => {
          const stepIdx = ORDER.indexOf(s.key)
          const done = stepIdx < currentIdx || status === 'READY'
          const active = stepIdx === currentIdx && status === 'PROVISIONING'
          const failed = stepIdx === currentIdx && status === 'FAILED'
          return (
            <div key={s.key} className={`${styles.step} ${done ? styles.done : ''} ${active ? styles.active : ''} ${failed ? styles.failed : ''}`}>
              <div className={styles.dot}>{done ? '✓' : i + 1}</div>
              <span>{s.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
