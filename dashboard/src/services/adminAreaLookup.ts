import { API_URL } from '../config'

export type AdminAreaHit = { id: number; name_ar: string }

export async function lookupAdminArea(latitude: number, longitude: number, signal?: AbortSignal): Promise<AdminAreaHit | null> {
  const response = await fetch(`${API_URL}/admin-areas/lookup/?lat=${latitude}&lon=${longitude}`, {
    credentials: 'omit', cache: 'no-store', signal,
  })
  if (!response.ok) return null
  const body = await response.json()
  return body.admin_area ?? null
}