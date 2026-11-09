import { API_URL } from '../config'
import type { LocalMediaFile, Metadata, Place, PlaceInput } from '../types/places'

export type SubmissionMetadata = Omit<Metadata, 'csrf_token'> & { auto_publish: boolean }

export function createSubmissionApi() {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const multipart = typeof FormData !== 'undefined' && init.body instanceof FormData
    const response = await fetch(`${API_URL}/place-submissions/${path}`, {
      ...init, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: multipart ? {} : { 'Content-Type': 'application/json' },
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
    list: (query: string, signal: AbortSignal) => request<import('../types/places').PlacePage>(`places/?${query}`, { signal }),
    detail: (id: number, signal?: AbortSignal) => request<Place>(`places/${id}/`, { signal }),
    uploadMedia: (files: LocalMediaFile[]) => Promise.all(files.map(({ file, is_cover }) => {
      const body = new FormData(); body.append('file', file); body.append('is_cover', String(is_cover))
      return request<PlaceInput['media'][number]>('media/', { method: 'POST', body })
    })),
    save: (input: PlaceInput, id?: number) => request<Place>(id ? `places/${id}/` : '', { method: id ? 'PATCH' : 'POST', body: JSON.stringify({ ...input, is_verified: false, is_visible: id ? input.is_visible : false }) }),
  }
}
