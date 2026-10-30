import { API_URL } from '../config'
import type { Metadata, Place, PlaceInput } from '../types/places'

export type SubmissionMetadata = Omit<Metadata, 'csrf_token'> & { auto_publish: boolean }

export function createSubmissionApi() {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_URL}/place-submissions/${path}`, {
      ...init, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) {
      if (response.status === 429) throw new Error('تم الوصول إلى الحد المؤقت للإضافات. حاول لاحقًا.')
      const body = await response.json().catch(() => null)
      throw new Error(body ? JSON.stringify(body) : 'تعذر الاتصال بالخادم. حاول مرة أخرى.')
    }
    return response.json()
  }
  return {
    metadata: (signal: AbortSignal) => request<SubmissionMetadata>('metadata/', { signal }),
    save: (input: PlaceInput) => request<Place>('', { method: 'POST', body: JSON.stringify({ ...input, is_verified: false, is_visible: false }) }),
  }
}
