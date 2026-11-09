// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./components/places/PlacesMap', () => ({ default: () => <div>خريطة الموقع</div> }))
vi.mock('./pages/RoutesMapPage', () => ({ default: () => <div>إضافة طريق</div> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('opens the real form from the home choice and saves without login or an invitation', async () => {
  const metadata = { auto_publish: true, categories: [{ id: 1, name_ar: 'الصحة', subcategories: [{ id: 2, name_ar: 'عيادة' }] }], admin_areas: [], sectors: ['Public'], contact_types: [] }
  const request = vi.fn(async (url: string, init: RequestInit) => {
    expect(url).toContain('/place-submissions/')
    expect(init.credentials).toBe('omit')
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
    return { ok: true, json: async () => init.method === 'POST' ? { id: 10, title_ar: 'عيادة الاختبار', is_visible: true } : metadata }
  })
  vi.stubGlobal('fetch', request)
  window.history.replaceState({}, '', '/')
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'إضافة مكان' }))
  fireEvent.change(await screen.findByLabelText('الاسم بالعربية'), { target: { value: 'عيادة الاختبار' } })
  fireEvent.change(screen.getByLabelText('الفئة الرئيسية'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('الفئة الفرعية'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('خط العرض'), { target: { value: '33.51' } })
  fireEvent.change(screen.getByLabelText('خط الطول'), { target: { value: '36.29' } })
  fireEvent.click(screen.getByRole('button', { name: 'حفظ المكان' }))
  expect(await screen.findByText('تم حفظ المكان بنجاح')).toBeTruthy()
  expect(screen.queryByText(/تسجيل الدخول/)).toBeNull()
  expect(request).toHaveBeenCalledTimes(2)
})

it('edits an existing place from the form without employee login', async () => {
  const metadata = { auto_publish: true, categories: [{ id: 1, name_ar: 'الصحة', subcategories: [{ id: 2, name_ar: 'عيادة' }] }], admin_areas: [], sectors: ['Public'], contact_types: [] }
  const place = { id: 10, title_ar: 'عيادة الاختبار', title_en: '', description: '', sector: 'Public', latitude: 33.51, longitude: 36.29, location_text: '', opening_hours: {}, is_visible: true, is_verified: false, sub_category_id: 2, category_id: 1, admin_area_id: null, communication_info: [], media: [] }
  const request = vi.fn(async (url: string, init: RequestInit) => {
    expect(init.credentials).toBe('omit')
    if (url.endsWith('/metadata/')) return { ok: true, json: async () => metadata }
    if (url.includes('places/?')) return { ok: true, json: async () => ({ count: 1, results: [place] }) }
    if (init.method === 'PATCH') return { ok: true, json: async () => ({ ...place, title_ar: 'عيادة معدلة' }) }
    return { ok: true, json: async () => place }
  })
  vi.stubGlobal('fetch', request)
  window.history.replaceState({}, '', '/places/new')
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'تعديل موقع' }))
  fireEvent.click(await screen.findByRole('button', { name: /عيادة الاختبار/ }))
  fireEvent.change(await screen.findByLabelText('الاسم بالعربية'), { target: { value: 'عيادة معدلة' } })
  fireEvent.click(screen.getByRole('button', { name: 'حفظ المكان' }))
  expect(await screen.findByText('تم حفظ المكان بنجاح')).toBeTruthy()
  expect(request.mock.calls.some(([url, init]) => url.endsWith('/places/10/') && init.method === 'PATCH')).toBe(true)
})
