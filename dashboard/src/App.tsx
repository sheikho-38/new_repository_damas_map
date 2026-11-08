import { useEffect, useState } from 'react'
import './App.css'
import './places.css'
import './submission.css'
import PlaceSubmissionPage from './pages/PlaceSubmissionPage'
import PlacesExplorerPage from './pages/PlacesExplorerPage'
import EditPlacePage from './pages/EditPlacePage'
import HomePage from './pages/HomePage'
import Sidebar from './components/Sidebar'
import DashboardPage from './pages/DashboardPage'
import RoutesListPage from './pages/RoutesListPage'
import RoutesMapPage from './pages/RoutesMapPage'
import type { Page } from './types'

const paths: Record<Page, string> = { home: '/', dashboard: '/admin', routes: '/admin/routes', 'routes-map': '/admin/routes/map', 'routes-new': '/admin/routes/new', places: '/admin/places', 'places-new': '/admin/places/new', 'places-edit': '/admin/places/edit' }
const currentPage = (): Page => (Object.entries(paths).find(([, path]) => path === (window.location.pathname.replace(/\/$/, '') || '/'))?.[0] as Page) ?? 'dashboard'
function App() {
  const [page, setPage] = useState<Page>(currentPage)
  const navigate = (next: Page) => { window.history.pushState({}, '', paths[next]); setPage(next) }
  useEffect(() => { const pop = () => setPage(currentPage()); window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop) }, [])

  if (window.location.pathname.replace(/\/$/, '') === '/places/new') return <PlaceSubmissionPage />
  if (page === 'places-new') return <PlaceSubmissionPage />
  if (page === 'home') return <HomePage onNavigate={navigate} />

  return (
    <div dir="rtl" className="dashboard">
      <Sidebar active={page} onNavigate={navigate} />

      <div className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1>لوحة التحكم</h1>
            <p>إدارة ومتابعة نظام النقل العام</p>
          </div>

          <div className="dashboard-user">
            <span className="user-icon">م</span>

            <div>
              <strong>مسؤول النظام</strong>
              <small>مدير النظام</small>
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          {page === 'dashboard' && <DashboardPage />}
          {page === 'routes' && <RoutesListPage />}
          {(page === 'routes-map' || page === 'routes-new') && <RoutesMapPage startAdding={page === 'routes-new'} />}
          {page === 'places' && <PlacesExplorerPage onAdd={() => navigate('places-new')} onEdit={id => { window.history.pushState({}, '', `${paths['places-edit']}?id=${id}`); setPage('places-edit') }} />}
          {page === 'places-edit' && <EditPlacePage />}
        </main>
      </div>
    </div>
  )
}

export default App
