import type { Page } from '../types'

type NavItem = { page: Page | null; icon: string; label: string }

// page = null يعني الصفحة لسا ما انعملت
const NAV_ITEMS: NavItem[] = [
  { page: 'dashboard', icon: '▦', label: 'لوحة التحكم' },
  { page: 'routes', icon: '🚌', label: 'خطوط النقل' },
  { page: 'routes-map', icon: '🗺', label: 'المسارات' },
  { page: null, icon: '💰', label: 'الأجور' },
  { page: null, icon: '⚙', label: 'الإعدادات' },
]

type Props = {
  active: Page
  onNavigate: (page: Page) => void
}

export default function Sidebar({ active, onNavigate }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">ط</div>

        <div>
          <h2>طريقي</h2>
          <span>نظام النقل العام</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ page, icon, label }) => (
          <button
            key={label}
            type="button"
            className={`nav-item ${page !== null && page === active ? 'active' : ''}`}
            onClick={page ? () => onNavigate(page) : undefined}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        لوحة إدارة النقل
        <small>الإصدار 1.0</small>
      </div>
    </aside>
  )
}