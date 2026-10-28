import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import * as maplibregl from 'maplibre-gl'
import { DAMASCUS_CENTER, addRouteLayers, buildStyle } from '../map/setup'

// بينشئ الخريطة مرة وحدة بس، وبيرجّع العنصر اللي لازم نربطه بالـ div
export function useRoutesMap(
  mapRef: RefObject<maplibregl.Map | null>,
  onClick: (e: maplibregl.MapMouseEvent) => void,
) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const clickRef = useRef(onClick)
  const [ready, setReady] = useState(false)

  // دايماً منستخدم آخر نسخة من دالة الضغط بدون ما نعيد إنشاء الخريطة
  useEffect(() => {
    clickRef.current = onClick
  })

  useEffect(() => {
    if (!mapEl.current) return

    const map = new maplibregl.Map({
      container: mapEl.current,
      style: buildStyle(),
      center: DAMASCUS_CENTER,
      zoom: 12,
    })
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl(), 'top-left')

    // أيقونة شفافة لأي أيقونة ناقصة بالـ sprite (بتمنع التحذيرات)
    map.on('styleimagemissing', (e) => {
      if (map.hasImage(e.id)) return
      map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) })
    })

    map.on('load', () => {
      addRouteLayers(map)
      setReady(true)
    })

    map.on('click', (e) => clickRef.current(e))

    return () => {
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [mapRef])

  return { mapEl, ready }
}