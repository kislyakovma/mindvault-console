'use client'
import StatusCard from '@/components/StatusCard'
import ProvisioningSteps from '@/components/ProvisioningSteps'

export default function DashboardPage() {
  // TODO: fetch real data via TanStack Query
  const status = 'DRAFT'
  const step = 'NONE'

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, marginBottom: 32 }}>
        Статус системы
      </h1>
      <StatusCard status={status} />
      <ProvisioningSteps currentStep={step} status={status} />
    </div>
  )
}
