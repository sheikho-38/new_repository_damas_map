import { useEffect, useState } from 'react'
import { getRoutes } from '../api'
import type { RouteSummary } from '../types'

export default function RoutesListPage() {
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    getRoutes()
      .then(setRoutes)
      .catch((e) => {
        console.error('Failed to load routes:', e)
        setError('تعذر تحميل الخطوط')
      })
  }, [])

  return (
    <section className="routes-section">
      <h2>خطوط النقل ({routes.length})</h2>

      {error && <p className="routes-editor-error">{error}</p>}

      {routes.map((route) => (
        <div key={route.id} className="route-item">
          <span className="route-color" style={{ backgroundColor: route.color }} />
          <span>{route.route_name}</span>
          <span>{route.is_active ? 'نشط' : 'غير نشط'}</span>
        </div>
      ))}
    </section>
  )
}