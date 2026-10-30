import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { buildStyle, DAMASCUS_CENTER } from '../../map/setup'
import type { Place, PlacesGeoJSON } from '../../types/places'

type Props = {
  data?: PlacesGeoJSON; selected?: Place | null; onSelect?: (id: number) => void; onBounds?: (bbox: string) => void
  coordinates?: [number, number] | null; onCoordinates?: (coordinates: [number, number]) => void
}
export default function PlacesMap(props: Props) {
  const element = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const marker = useRef<maplibregl.Marker | null>(null)
  const callbacks = useRef(props)
  const camera = useRef<{ center: maplibregl.LngLat; zoom: number } | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => { callbacks.current = props })
  useEffect(() => {
    const map = new maplibregl.Map({ container: element.current!, style: buildStyle(), center: DAMASCUS_CENTER, zoom: 12 })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl())
    const bounds = () => { const b = map.getBounds(); callbacks.current.onBounds?.([Math.max(-180, b.getWest()), Math.max(-90, b.getSouth()), Math.min(180, b.getEast()), Math.min(90, b.getNorth())].join(',')) }
    map.on('load', () => {
      map.addSource('admin-places', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterMaxZoom: 14, clusterRadius: 45 })
      map.addLayer({ id: 'admin-places-clusters', type: 'circle', source: 'admin-places', filter: ['has', 'point_count'], paint: { 'circle-color': '#064239', 'circle-radius': 20 } })
      map.addLayer({ id: 'admin-places-count', type: 'symbol', source: 'admin-places', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Regular'], 'text-size': 12 }, paint: { 'text-color': '#fff' } })
      map.addLayer({ id: 'admin-places-points', type: 'circle', source: 'admin-places', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': ['get', 'color'], 'circle-radius': 7, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } })
      map.addLayer({ id: 'admin-places-labels', type: 'symbol', source: 'admin-places', minzoom: 14, filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['get', 'title'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.4] }, paint: { 'text-color': '#064239', 'text-halo-color': '#fff', 'text-halo-width': 2 } })
      setReady(true); bounds()
    })
    map.on('moveend', bounds)
    map.on('click', event => {
      if (callbacks.current.onCoordinates) { callbacks.current.onCoordinates([+event.lngLat.lng.toFixed(6), +event.lngLat.lat.toFixed(6)]); return }
      if (!map.getLayer('admin-places-points')) return
      const feature = map.queryRenderedFeatures(event.point, { layers: ['admin-places-points', 'admin-places-clusters'] })[0]
      if (!feature) return
      if (feature.properties.cluster_id !== undefined) {
        const source = map.getSource('admin-places') as GeoJSONSource
        void source.getClusterExpansionZoom(feature.properties.cluster_id).then(zoom => {
          if (feature.geometry.type === 'Point') map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom })
        }).catch(() => {})
      } else callbacks.current.onSelect?.(Number(feature.properties.id))
    })
    const observer = new ResizeObserver(() => map.resize()); observer.observe(element.current!)
    return () => { observer.disconnect(); marker.current?.remove(); marker.current = null; map.remove(); mapRef.current = null }
  }, [])
  useEffect(() => { if (ready && props.data) (mapRef.current?.getSource('admin-places') as GeoJSONSource)?.setData(props.data) }, [ready, props.data])
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    if (props.selected) {
      camera.current ??= { center: map.getCenter(), zoom: map.getZoom() }
      marker.current?.remove()
      marker.current = new maplibregl.Marker({ color: '#c8a76a' }).setLngLat([props.selected.longitude, props.selected.latitude]).addTo(map)
      map.flyTo({ center: [props.selected.longitude, props.selected.latitude], zoom: 16 })
    } else if (!callbacks.current.onCoordinates) {
      marker.current?.remove(); marker.current = null
      if (camera.current) { map.easeTo(camera.current); camera.current = null }
    }
  }, [ready, props.selected])
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !props.onCoordinates) return
    if (!props.coordinates) { marker.current?.remove(); marker.current = null; return }
    if (!marker.current) {
      marker.current = new maplibregl.Marker({ draggable: true, color: '#c8a76a' }).setLngLat(props.coordinates).addTo(map)
      marker.current.on('dragend', () => { const p = marker.current!.getLngLat(); callbacks.current.onCoordinates?.([+p.lng.toFixed(6), +p.lat.toFixed(6)]) })
    } else marker.current.setLngLat(props.coordinates)
  }, [ready, props.coordinates, props.onCoordinates])
  return <div className="places-map" ref={element} aria-label="خريطة أماكن دمشق" />
}
