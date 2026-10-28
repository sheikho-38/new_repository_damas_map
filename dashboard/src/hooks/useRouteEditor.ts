
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import * as maplibregl from 'maplibre-gl'
import {
  addDirectionToBus,
  calculateRoute,
  createRoute,
  updateRoute,
} from '../api'
import { nearestIdx, sampleWaypoints } from '../lib/geo'
import { EMPTY, setSourceData } from '../map/setup'
import type { Direction, LineGeometry, LngLat, MapRoute } from '../types'

const DEFAULT_COLOR = '#2563eb'

// منطق رسم وتعديل خط: النقاط على الخريطة + حساب المسار + الحفظ
export function useRouteEditor(
  mapRef: RefObject<maplibregl.Map | null>,
  onSaved: () => Promise<void> | void,
) {
  const markersRef = useRef<maplibregl.Marker[]>([])
  const draftCoords = useRef<number[][]>([])
  const editingRef = useRef(false)
  const reqId = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  const [editing, setEditing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [addingToBusId, setAddingToBusId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [fare, setFare] = useState('')
  const [direction, setDirection] = useState<Direction>('ذهاب')
  const [startPoint, setStartPoint] = useState('')
  const [endPoint, setEndPoint] = useState('')
  const [count, setCount] = useState(0)
  const [hasRoute, setHasRoute] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    editingRef.current = editing
  }, [editing])

  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current)
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
    }
  }, [])

  const renumber = () => {
    markersRef.current.forEach((m, i) => {
      m.getElement().textContent = String(i + 1)
    })
    setCount(markersRef.current.length)
  }

  const showDraft = (geometry: LineGeometry | null) => {
    setSourceData(
      mapRef.current,
      'draft',
      geometry ? { type: 'Feature', properties: {}, geometry } : EMPTY,
    )
  }

  // حساب المسار من BRouter وعرضه كخط مؤقت
  const requestRoute = () => {
    window.clearTimeout(timer.current)
    const id = ++reqId.current

    if (markersRef.current.length < 2) {
      draftCoords.current = []
      showDraft(null)
      setHasRoute(false)
      setBusy(false)
      return
    }

    // إلغاء صلاحية المسار السابق عند تغيير النقاط
    draftCoords.current = []
    showDraft(null)
    setHasRoute(false)

    setBusy(true)
    setError('')

    timer.current = window.setTimeout(async () => {
      const points = markersRef.current.map((m): LngLat => {
        const p = m.getLngLat()
        return [p.lng, p.lat]
      })

      try {
        const data = await calculateRoute(points)
        if (id !== reqId.current) return

        draftCoords.current = data.geometry.coordinates
        showDraft(data.geometry)
        setHasRoute(true)
      } catch (e) {
        console.error('BRouter failed:', e)
        if (id === reqId.current) {
          setError(e instanceof Error ? e.message : 'فشل حساب المسار')
        }
      } finally {
        if (id === reqId.current) setBusy(false)
      }
    }, 250)
  }

  const removeMarker = (marker: maplibregl.Marker) => {
    marker.remove()
    markersRef.current = markersRef.current.filter((m) => m !== marker)
    renumber()
    requestRoute()
  }

  const addWaypoint = (lngLat: LngLat, index?: number, skipRequest = false) => {
    const map = mapRef.current
    if (!map) return

    const el = document.createElement('div')
    el.className = 'wp-marker'

    const marker = new maplibregl.Marker({
      element: el,
      draggable: true,
      anchor: 'center',
    })
      .setLngLat(lngLat)
      .addTo(map)

    marker.on('dragend', requestRoute)
    el.addEventListener('click', (ev) => ev.stopPropagation())
    el.addEventListener('contextmenu', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      removeMarker(marker)
    })

    if (index === undefined) markersRef.current.push(marker)
    else markersRef.current.splice(index, 0, marker)

    renumber()
    if (!skipRequest) requestRoute()
  }

  // مكان إدراج نقطة جديدة عند الضغط على الخط
  const insertIndexFor = (p: LngLat) => {
    const coords = draftCoords.current
    if (!coords.length) return undefined

    const clickIdx = nearestIdx(coords, p)
    const wpIdx = markersRef.current.map((m) => {
      const ll = m.getLngLat()
      return nearestIdx(coords, [ll.lng, ll.lat])
    })

    const at = wpIdx.findIndex((i) => i > clickIdx)
    return at === -1 ? undefined : at
  }

  // الضغط على الخريطة: إضافة نقطة أو إدراجها على الخط
  const onMapClick = (e: maplibregl.MapMouseEvent) => {
    const map = mapRef.current
    if (!map || !editingRef.current) return

    const p: LngLat = [e.lngLat.lng, e.lngLat.lat]
    const onLine =
      map.queryRenderedFeatures(e.point, { layers: ['draft-line'] }).length > 0

    addWaypoint(p, onLine ? insertIndexFor(p) : undefined)
  }

  const resetDraft = () => {
    window.clearTimeout(timer.current)
    reqId.current++
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    renumber()
    draftCoords.current = []
    showDraft(null)
    setHasRoute(false)
    setBusy(false)
    setError('')
  }

  const startNew = () => {
    resetDraft()
    setEditing(true)
    setEditingId(null)
    setName('')
    setColor(DEFAULT_COLOR)
    setFare('')
    setDirection('ذهاب')
    setStartPoint('')
    setEndPoint('')
    setAddingToBusId(null)
  }

  const startEdit = (r: MapRoute) => {
    resetDraft()
    setEditing(true)
    setEditingId(r.id)
    setName(r.route_name)
    setColor(r.color)
    setFare(r.fare != null ? String(r.fare) : '')
    setDirection(r.direction)
    setStartPoint(r.start_point)
    setEndPoint(r.end_point)
    setAddingToBusId(null)

    const coords = r.geometry.coordinates
    sampleWaypoints(coords).forEach((p) => addWaypoint(p, undefined, true))

    draftCoords.current = coords
    showDraft(r.geometry)
    setHasRoute(true)

    const map = mapRef.current
    if (map) {
      const bounds = new maplibregl.LngLatBounds()
      coords.forEach((c) => bounds.extend([c[0], c[1]]))
      map.fitBounds(bounds, { padding: 80 })
    }
  }

  const startAddDirection = (
    r: MapRoute,
    newDirection: Direction,
  ) => {
    resetDraft()
    setEditing(true)
    setEditingId(null)
    setAddingToBusId(r.bus_id)

    // بيانات الباص مشتركة بين الاتجاهين
    setName(r.route_name)
    setColor(r.color)
    setFare(r.fare != null ? String(r.fare) : '')

    setDirection(newDirection)
    setStartPoint('')
    setEndPoint('')
  }

  const cancel = () => {
    resetDraft()
    setEditing(false)
    setEditingId(null)
    setAddingToBusId(null)
  }

  const undo = () => {
    const last = markersRef.current[markersRef.current.length - 1]
    if (last) removeMarker(last)
  }

  const save = async () => {
    if (
      saving ||
      busy ||
      !hasRoute ||
      draftCoords.current.length < 2 ||
      !name.trim() ||
      fare === '' ||
      Number(fare) < 0 ||
      !startPoint.trim() ||
      !endPoint.trim()
    ) {
      return
    }

    // إرسال نقاط التحكم المرسومة على الخريطة، وليس geometry الناتج
    const waypoints: LngLat[] = markersRef.current.map((m) => {
      const p = m.getLngLat()
      return [p.lng, p.lat]
    })

    const payload = {
      name: name.trim(),
      color,
      price: Number(fare),
      direction,
      start_point: startPoint.trim(),
      end_point: endPoint.trim(),
      waypoints,
    }

    setSaving(true)
    setError('')

    try {
      if (editingId !== null) {
        await updateRoute(editingId, payload)
      } else if (addingToBusId !== null) {
        await addDirectionToBus(addingToBusId, {
          direction,
          start_point: startPoint.trim(),
          end_point: endPoint.trim(),
          waypoints,
        })
      } else {
        await createRoute(payload)
      }

      await onSaved()
      cancel()
    } catch (e) {
      console.error('Save failed:', e)
      setError(e instanceof Error ? e.message : 'فشل حفظ الخط')
    } finally {
      setSaving(false)
    }
  }

  return {
    editing,
    editingId,
    name,
    setName,
    color,
    setColor,
    fare,
    setFare,
    direction,
    setDirection,
    startPoint,
    setStartPoint,
    endPoint,
    setEndPoint,
    count,
    hasRoute,
    busy,
    saving,
    error,
    setError,
    startNew,
    startEdit,
    cancel,
    undo,
    save,
    onMapClick,
    addingToBusId,
    startAddDirection,
  }
}

export type RouteEditor = ReturnType<typeof useRouteEditor>
