import type { Page } from '../types'

export default function HomePage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <main dir="rtl" className="home-page">
      <section className="home-card">
        <div className="home-brand">طريقي</div>
        <h1>ماذا تريد أن تضيف؟</h1>
        <p>اختر نوع البيانات التي تريد إضافتها إلى النظام.</p>
        <div className="home-actions">
          <button type="button" onClick={() => onNavigate('routes-new')}>
            <span aria-hidden="true">🚌</span>
            إضافة طريق
          </button>
          <button type="button" onClick={() => onNavigate('places-new')}>
            <span aria-hidden="true">📍</span>
            إضافة مكان
          </button>
        </div>
      </section>
    </main>
  )
}
