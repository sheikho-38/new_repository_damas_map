import { API_URL } from '../config'
import type { Metadata, Place, PlaceInput, PlacePage, PlacesGeoJSON } from '../types/places'

let csrfToken = ''
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/admin/places/${path}`, {
    ...init, credentials: 'include', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken, ...init.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(response.status === 403 ? 'سجّل الدخول بحساب موظف في Django ثم أعد المحاولة.' : JSON.stringify(body))
  }
  return response.status === 204 ? undefined as T : response.json()
}
export const placesApi = {
  metadata: async () => { const data = await request<Metadata>('metadata/'); csrfToken = data.csrf_token; return data },
  list: (query: string, signal: AbortSignal) => request<PlacePage>(`?${query}`, { signal }),
  map: (query: string, signal: AbortSignal) => request<PlacesGeoJSON>(`geojson/?${query}`, { signal }),
  detail: (id: number, signal?: AbortSignal) => request<Place>(`${id}/`, { signal }),
  save: (data: Partial<PlaceInput>, id?: number) => request<Place>(id ? `${id}/` : '', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(data) }),
  remove: (id: number) => request<void>(`${id}/`, { method: 'DELETE' }),
}
