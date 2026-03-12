'use client'
import { useState } from 'react'
import StatusCard from '@/components/StatusCard'
import ProvisioningSteps from '@/components/ProvisioningSteps'
import VpnTab from '@/components/VpnTab'
import styles from './dashboard.module.css'

const TABS = [
  { id: 'status', label: '⚡ Статус' },
  { id: 'vpn', label: '🔒 VPN' },
]

export default function DashboardPage() {
  const [tab, setTab] = useState('status')
  const status = 'DRAFT'
  const step = 'NONE'

  return (
    <div>
      <h1 className={styles.title}>Система</h1>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'status' && (
        <div>
          <StatusCard status={status} />
          <ProvisioningSteps currentStep={step} status={status} />
        </div>
      )}

      {tab === 'vpn' && <VpnTab />}
    </div>
  )
}
