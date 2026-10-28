import type {
  GeoJSONSource,
  GeoJSONSourceSpecification,
  Map as MapLibreMap,
  StyleSpecification,
} from 'maplibre-gl'
import baseStyle from '../assets/style.json'
import { API_URL } from '../config'

export const DAMASCUS_CENTER: [number, number] = [36.2913, 33.5138]

// أي بيانات GeoJSON بتنفع كمصدر لطبقة بالخريطة
export type GeoData = Exclude<GeoJSONSourceSpecification['data'], string>

export const EMPTY: GeoData = {
  type: 'FeatureCollection',
  features: [],
}

// منجهّز الستايل: الـ tiles من الباك إند، والخطوط من الفرونت (Noto Sans)
export function buildStyle(): StyleSpecification {
  const style = structuredClone(baseStyle) as unknown as StyleSpecification

  style.glyphs = `${window.location.origin}/fonts/{fontstack}/{range}.pbf`

  const tiles = style.sources['openmaptiles'] as { tiles?: string[] } | undefined
  if (tiles) tiles.tiles = [`${API_URL}/tiles/damascus/{z}/{x}/{y}`]

  style.layers.forEach((layer) => {
    const layout = (layer as { layout?: Record<string, unknown> }).layout
    const fonts = layout?.['text-font'] as string[] | undefined
    if (layout && fonts) {
      layout['text-font'] = [
        fonts.join(' ').includes('Bold') ? 'Noto Sans Bold' : 'Noto Sans Regular',
      ]
    }
  })

  return style
}

// تحديث بيانات طبقة GeoJSON بالخريطة
export function setSourceData(
  map: MapLibreMap | null,
  sourceId: string,
  data: GeoData,
) {
  ;(map?.getSource(sourceId) as GeoJSONSource | undefined)?.setData(data)
}

// طبقات الخطوط: 'routes' (المحفوظة) و 'draft' (اللي عم نرسمه)
export function addRouteLayers(map: MapLibreMap) {
  map.addSource('routes', { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: 'routes-line',
    type: 'line',
    source: 'routes',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': 0.6 },
  })
  map.addLayer({
    id: 'routes-label',
    type: 'symbol',
    source: 'routes',
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 500,
      'text-field': ['get', 'route_name'],
      'text-size': 12,
      'text-font': ['Noto Sans Bold'],
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
    },
  })

  map.addSource('draft', { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: 'draft-line',
    type: 'line',
    source: 'draft',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#2563eb', 'line-width': 6 },
  })
}