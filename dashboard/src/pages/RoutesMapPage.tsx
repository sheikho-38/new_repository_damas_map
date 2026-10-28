import { useCallback, useEffect, useRef, useState } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { deleteRoute, getMapRoutes } from '../api'
import RoutesPanel from '../components/RoutesPanel'
import { useRouteEditor } from '../hooks/useRouteEditor'
import { useRoutesMap } from '../hooks/useRoutesMap'
import { setSourceData } from '../map/setup'
import type { MapRoute } from '../types'

export default function RoutesMapPage() {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [routes, setRoutes] = useState<MapRoute[]>([])

  const loadRoutes = useCallback(async () => {
    setRoutes(await getMapRoutes())
  }, [])

  const editor = useRouteEditor(mapRef, loadRoutes)
  const { mapEl, ready } = useRoutesMap(mapRef, editor.onMapClick)
  const { setError } = editor

  // تحميل الخطوط أول ما تفتح الصفحة
  useEffect(() => {
    getMapRoutes()
      .then(setRoutes)
      .catch((e) => {
        console.error('Failed to load routes:', e)
        setError('تعذر تحميل الخطوط')
      })
  }, [setError])

  // عرض الخطوط المحفوظة على الخريطة (بدون الخط اللي عم نعدله)
  useEffect(() => {
    if (!ready) return
    setSourceData(mapRef.current, 'routes', {
      type: 'FeatureCollection',
      features: routes
        .filter((r) => r.id !== editor.editingId)
        .map((r) => ({
          type: 'Feature' as const,
          properties: { id: r.id, route_name: r.route_name, color: r.color },
          geometry: r.geometry,
        })),
    })
  }, [routes, editor.editingId, ready])

  const handleDelete = async (route: MapRoute) => {
    if (!window.confirm(`حذف ${route.route_name}؟`)) return
    try {
      await deleteRoute(route.id)
      await loadRoutes()
      setError('')
    } catch (e) {
      console.error('Delete failed:', e)
      setError(e instanceof Error ? e.message : 'فشل حذف الخط')
    }
  }

  return (
    <section className="welcome-card">
      <h2>المسارات</h2>

      <div className="routes-editor">
        <div ref={mapEl} className="routes-editor-map" />
        <RoutesPanel routes={routes} editor={editor} onDelete={handleDelete} />
      </div>
    </section>
  )
}