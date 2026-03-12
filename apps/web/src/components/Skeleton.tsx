import styles from './Skeleton.module.css'

interface SkeletonProps {
  width?: string
  height?: string
  radius?: string
  className?: string
}

export function Skeleton({ width = '100%', height = '16px', radius = '6px', className }: SkeletonProps) {
  return (
    <span
      className={`${styles.skeleton} ${className || ''}`}
      style={{ width, height, borderRadius: radius }}
    />
  )
}

// Готовые блоки
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={`${styles.textBlock} ${className || ''}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '65%' : '100%'} height="14px" />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`${styles.card} ${className || ''}`}>
      <Skeleton width="60%" height="16px" />
      <div style={{ height: 8 }} />
      <Skeleton width="40%" height="12px" />
      <div style={{ height: 12 }} />
      <Skeleton width="80%" height="12px" />
    </div>
  )
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={`${styles.row} ${className || ''}`}>
      <Skeleton width="32px" height="32px" radius="50%" />
      <div className={styles.rowContent}>
        <Skeleton width="140px" height="13px" />
        <Skeleton width="90px" height="11px" />
      </div>
      <Skeleton width="60px" height="13px" />
    </div>
  )
}

export function SkeletonStatusItem() {
  return (
    <div className={styles.statusItem}>
      <Skeleton width="10px" height="10px" radius="50%" />
      <div className={styles.rowContent}>
        <Skeleton width="100px" height="13px" />
        <Skeleton width="160px" height="11px" />
      </div>
    </div>
  )
}
