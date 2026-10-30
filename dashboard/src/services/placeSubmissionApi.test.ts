// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createSubmissionApi } from './placeSubmissionApi'
import type { PlaceInput } from '../types/places'

afterEach(() => vi.unstubAllGlobals())

it('posts to the creation-only API without a token or session cookies', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 42, is_visible: true }) })
  vi.stubGlobal('fetch', fetchMock)
  const api = createSubmissionApi()
  const payload: PlaceInput = { title_ar: 'مكان جديد', title_en: '', description: '', sector: 'Public', latitude: 33.51, longitude: 36.29, location_text: '', opening_hours: {}, is_visible: true, is_verified: true, sub_category_id: 1, admin_area_id: null, communication_info: [], media: [] }
  const result = await api.save(payload)
  expect(result.id).toBe(42)
  expect(fetchMock.mock.calls[0][0]).toContain('/place-submissions/')
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' } })
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).is_verified).toBe(false)
})

it('explains rate limits without asking for a login', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
  await expect(createSubmissionApi().metadata(new AbortController().signal)).rejects.toThrow('الحد المؤقت')
})
