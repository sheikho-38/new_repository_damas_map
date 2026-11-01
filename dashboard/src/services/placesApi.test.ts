// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { placesApi } from './placesApi'

afterEach(() => vi.unstubAllGlobals())

it('uploads a cover image as multipart with the staff CSRF token', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ csrf_token: 'csrf-test' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ file_url: 'http://api.test/media/photo.jpg', media_type: 'image', caption: '', is_cover: true }) })
  vi.stubGlobal('fetch', fetchMock)
  await placesApi.metadata()
  const file = new File(['image'], 'cover.jpg', { type: 'image/jpeg' })
  const [media] = await placesApi.uploadMedia([{ file, is_cover: true }])
  expect(media.is_cover).toBe(true)
  const [url, init] = fetchMock.mock.calls[1]
  expect(url).toContain('/admin/places/media/')
  expect(init.headers['X-CSRFToken']).toBe('csrf-test')
  expect(init.headers['Content-Type']).toBeUndefined()
  expect(init.body.get('file')).toBe(file)
  expect(init.body.get('is_cover')).toBe('true')
})
