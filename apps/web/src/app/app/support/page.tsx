export default function SupportPage() {
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, marginBottom: 24 }}>Поддержка</h1>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 32px' }}>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>Напишите нам — ответим в течение рабочего дня.</p>
        <a href="https://t.me/MindVaultClientBot" target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-block', background: 'var(--lime)', color: '#0a0a0f', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, padding: '10px 24px', borderRadius: 8, textDecoration: 'none' }}>
          Написать в Telegram →
        </a>
      </div>
    </div>
  )
}
