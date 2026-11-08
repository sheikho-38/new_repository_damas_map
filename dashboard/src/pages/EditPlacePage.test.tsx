// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import EditPlacePage from './EditPlacePage'
import { placesApi } from '../services/placesApi'
import type { Metadata, Place } from '../types/places'

const metadata: Metadata = { csrf_token: 'test', categories: [], admin_areas: [], sectors: [], contact_types: [] }
const place: Place = { id: 7, title_ar: 'مشفى تجريبي', title_en: '', description: '', sector: 'Public', latitude: 33.5, longitude: 36.3, location_text: '', opening_hours: {}, is_visible: true, is_verified: false, sub_category_id: 1, admin_area_id: null, communication_info: [], media: [] }

vi.mock('../components/places/PlaceForm', () => ({
  default: ({ initial, onSaved }: { initial: Place; onSaved: (place: Place) => void }) => <div>
    <p>تحرير {initial.title_ar}: {initial.latitude}, {initial.longitude}</p>
    <button onClick={() => onSaved({ ...initial, latitude: 33.6, longitude: 36.4 })}>حفظ تجريبي</button>
  </div>,
}))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('finds a place, opens its edit page, and shows saved coordinates', async () => {
  window.history.replaceState({}, '', '/admin/places/edit')
  vi.spyOn(placesApi, 'metadata').mockResolvedValue(metadata)
  vi.spyOn(placesApi, 'list').mockResolvedValue({ count: 1, next: null, previous: null, results: [place] })
  vi.spyOn(placesApi, 'detail').mockResolvedValue(place)
  render(<EditPlacePage />)
  fireEvent.change(await screen.findByLabelText('اسم المكان'), { target: { value: 'مشفى' } })
  fireEvent.click(await screen.findByRole('button', { name: /مشفى تجريبي/ }))
  expect(window.location.search).toBe('?id=7')
  expect(await screen.findByText('تحرير مشفى تجريبي: 33.5, 36.3')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'حفظ تجريبي' }))
  await waitFor(() => expect(screen.getByText('تحرير مشفى تجريبي: 33.6, 36.4')).toBeTruthy())
  expect(screen.getByRole('status').textContent).toContain('تم حفظ تعديلات')
})

it('loads a direct edit link', async () => {
  window.history.replaceState({}, '', '/admin/places/edit?id=7')
  vi.spyOn(placesApi, 'metadata').mockResolvedValue(metadata)
  vi.spyOn(placesApi, 'detail').mockResolvedValue(place)
  render(<EditPlacePage />)
  expect(await screen.findByText('تحرير مشفى تجريبي: 33.5, 36.3')).toBeTruthy()
})
