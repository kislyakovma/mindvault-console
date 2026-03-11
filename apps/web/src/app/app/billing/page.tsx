export default function BillingPage() {
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, marginBottom: 24 }}>Оплата</h1>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 32px' }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 8 }}>Статус подписки</div>
        <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 100, background: 'rgba(82,196,26,0.15)', color: '#52c41a', fontSize: 12, fontWeight: 600 }}>ACTIVE</div>
        <p style={{ color: 'var(--muted)', marginTop: 16, fontSize: 14 }}>Приём платежей будет настроен на следующем этапе.</p>
      </div>
    </div>
  )
}
