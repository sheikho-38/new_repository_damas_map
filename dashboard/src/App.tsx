import { useState } from 'react'
import './App.css'
import Sidebar from './components/Sidebar'
import DashboardPage from './pages/DashboardPage'
import RoutesListPage from './pages/RoutesListPage'
import RoutesMapPage from './pages/RoutesMapPage'
import type { Page } from './types'

function App() {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    <div dir="rtl" className="dashboard">
      <Sidebar active={page} onNavigate={setPage} />

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
          {page === 'routes-map' && <RoutesMapPage />}
        </main>
      </div>
    </div>
  )
}

export default App