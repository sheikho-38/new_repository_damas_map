import { useEffect, useState } from 'react'
import { placesApi } from '../services/placesApi'
import type { Filters, Metadata, PlacePage, PlacesGeoJSON } from '../types/places'

export function usePlacesMetadata() {
  const [metadata, setMetadata] = useState<Metadata>()
  const [error, setError] = useState('')
  useEffect(() => { let active = true; placesApi.metadata().then(data => { if (active) setMetadata(data) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [])
  return { metadata, error }
}

export function usePlaces(filters: Filters, page: number, bbox: string, revision: number) {
  const [list, setList] = useState<PlacePage>({ count: 0, results: [], next: null, previous: null })
  const [geojson, setGeojson] = useState<PlacesGeoJSON>({ type: 'FeatureCollection', features: [] })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [mapError, setMapError] = useState('')
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString()
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true); setError('')
      placesApi.list(`${query}&page=${page}`, controller.signal).then(setList)
        .catch(e => { if (e.name !== 'AbortError') setError(e.message) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, page, revision])
  useEffect(() => {
    if (!bbox) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setMapError('')
      placesApi.map(`${query}&bbox=${bbox}`, controller.signal).then(setGeojson)
        .catch(e => { if (e.name !== 'AbortError') setMapError(e.message) })
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, bbox, revision])
  return { list, geojson, error: error || mapError, loading }
}
