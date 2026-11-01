// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PlacesFilters from './PlacesFilters'
import PlacesMap from './PlacesMap'
import PlaceForm from './PlaceForm'
import { emptyFilters, type Metadata, type Place, type PlacesGeoJSON } from '../../types/places'
import { placesApi } from '../../services/placesApi'

const mocks = vi.hoisted(() => ({ maps: [] as FakeMap[], markers: [] as FakeMarker[] }))
type Handler = (event: { lngLat: { lng: number; lat: number }; point: number[] }) => void
class FakeMap {
  handlers: Record<string, Handler> = {}
  data = vi.fn(); flyTo = vi.fn(); easeTo = vi.fn(); remove = vi.fn()
  constructor() { mocks.maps.push(this) }
  on(name: string, handler: Handler) { this.handlers[name] = handler }
  addControl() {} addSource() {} addLayer() {} resize() {}
  getLayer() { return true }
  queryRenderedFeatures() { return [{ properties: { id: 7 } }] }
  getSource() { return { setData: this.data } }
  getBounds() { return { getWest: () => 36.1, getSouth: () => 33.4, getEast: () => 36.4, getNorth: () => 33.6 } }
  getCenter() { return { lng: 36.29, lat: 33.51 } }
  getZoom() { return 12 }
}
class FakeMarker {
  coordinates = [0, 0]
  drag?: () => void
  removed = false
  constructor() { mocks.markers.push(this) }
  setLngLat(value: number[]) { this.coordinates = value; return this }
  addTo() { return this }
  on(_name: string, callback: () => void) { this.drag = callback }
  getLngLat() { return { lng: this.coordinates[0], lat: this.coordinates[1] } }
  remove() { this.removed = true }
}
vi.mock('maplibre-gl', () => ({ Map: class { constructor() { return new FakeMap() } }, Marker: class { constructor() { return new FakeMarker() } }, NavigationControl: class {} }))
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })

const metadata: Metadata = { csrf_token: 'test', categories: [{ id: 1, name_ar: 'الصحة', subcategories: [{ id: 10, name_ar: 'مشفى' }] }, { id: 2, name_ar: 'التعليم', subcategories: [{ id: 20, name_ar: 'مدرسة' }] }], admin_areas: [], sectors: ['Public'], contact_types: [['phone', 'هاتف']] }
const place: Place = { id: 7, title_ar: 'مكان تجريبي', title_en: '', description: '', sector: 'Public', latitude: 33.52, longitude: 36.3, location_text: '', opening_hours: {}, is_visible: true, is_verified: false, sub_category_id: 10, category_id: 1, admin_area_id: null, communication_info: [], media: [] }
const event = { lngLat: { lng: 36.31, lat: 33.53 }, point: [0, 0] }
afterEach(() => { cleanup(); mocks.maps.length = 0; mocks.markers.length = 0; vi.restoreAllMocks() })

describe('places workflows', () => {
  it.each([
    ['phone', '1234567', ['123456', '12345678', '123a567']],
    ['mobile', '0912345678', ['0812345678', '091234567', '09123456789']],
    ['whatsapp', '0998765432', ['+963998765432', '099876543', '09abcdefgh']],
    ['email', 'place@gmail.com', ['place@yahoo.com', '@gmail.com', 'place @gmail.com', 'place@gmail.com.evil']],
    ['website', 'http://example.com', ['example.com', 'ftp://example.com', 'https://', 'https:///example.com']],
    ['website', 'https://example.com/path?q=1', ['https://exa mple.com']],
    ['facebook', 'https://facebook.com/place', ['http://facebook.com/place', 'https://facebook.com.evil/place', 'https://facebook.com@evil.com']],
    ['instagram', 'https://instagram.com/place', ['https://facebook.com/place', 'https://instagram.com.evil']],
    ['telegram', 'https://t.me/place', ['http://t.me/place', 'https://t.me.evil/place']],
  ])('validates %s contacts before saving', async (type, valid, invalid) => {
    const save = vi.fn().mockResolvedValue(place)
    render(<PlaceForm metadata={{ ...metadata, contact_types: [[type, type]] }} initial={{ ...place, communication_info: [{ type, value: '' }] }} savePlace={save} onSaved={vi.fn()} />)
    const input = screen.getByLabelText('قيمة التواصل')
    const form = screen.getByRole('button', { name: 'حفظ المكان' }).closest('form')!
    for (const value of invalid) {
      fireEvent.change(input, { target: { value } })
      fireEvent.submit(form)
      expect(input.getAttribute('aria-invalid')).toBe('true')
      expect(save).not.toHaveBeenCalled()
    }
    fireEvent.change(input, { target: { value: valid } })
    expect(input.getAttribute('aria-invalid')).toBe('false')
    await act(async () => { fireEvent.submit(form) })
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ communication_info: [{ type, value: valid }] }), place.id)
  })

  it('revalidates the contact value when its type changes', () => {
    render(<PlaceForm metadata={{ ...metadata, contact_types: [['phone', 'هاتف'], ['mobile', 'موبايل']] }} initial={{ ...place, communication_info: [{ type: 'phone', value: '1234567' }] }} onSaved={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('نوع التواصل'), { target: { value: 'mobile' } })
    expect(screen.getByLabelText('قيمة التواصل').getAttribute('aria-invalid')).toBe('true')
    fireEvent.change(screen.getByLabelText('نوع التواصل'), { target: { value: 'phone' } })
    expect(screen.getByLabelText('قيمة التواصل').getAttribute('aria-invalid')).toBe('false')
  })

  it('shows required-field hints on blur, clears them after correction, and focuses the first missing field', () => {
    const save = vi.fn()
    render(<PlaceForm metadata={metadata} savePlace={save} onSaved={vi.fn()} />)
    const title = screen.getByLabelText('الاسم بالعربية')
    fireEvent.blur(title)
    expect(title.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('هذا الحقل مطلوب.')).toBeTruthy()
    fireEvent.change(title, { target: { value: 'صيدلية' } })
    expect(title.getAttribute('aria-invalid')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'حفظ المكان' }))
    expect(document.activeElement).toBe(screen.getByLabelText('الفئة الرئيسية'))
    expect(save).not.toHaveBeenCalled()
  })

  it('opens an optional section when its added required row is empty', () => {
    const save = vi.fn()
    render(<PlaceForm metadata={metadata} initial={{ ...place, communication_info: [{ type: 'phone', value: '' }] }} savePlace={save} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'حفظ المكان' }))
    const contact = screen.getByLabelText('قيمة التواصل')
    expect(contact.closest('details')?.open).toBe(true)
    expect(document.activeElement).toBe(contact)
    expect(save).not.toHaveBeenCalled()
  })

  it('uploads the selected image and saves its cover flag with the place', async () => {
    const savedMedia = { file_url: 'http://localhost/media/cover.png', media_type: 'image', caption: '', is_cover: true }
    const uploadMedia = vi.fn().mockResolvedValue([savedMedia])
    const save = vi.fn().mockResolvedValue({ ...place, media: [savedMedia] })
    render(<PlaceForm metadata={metadata} initial={place} uploadMedia={uploadMedia} savePlace={save} onSaved={vi.fn()} />)
    const file = new File(['image'], 'cover.png', { type: 'image/png' })
    await act(async () => fireEvent.change(screen.getByLabelText('اختيار الصور والفيديو'), { target: { files: [file] } }))
    fireEvent.click(screen.getByLabelText('تعيين cover.png كصورة غلاف'))
    await act(async () => fireEvent.submit(screen.getByRole('button', { name: 'حفظ المكان' }).closest('form')!))
    expect(uploadMedia).toHaveBeenCalledWith([{ file, is_cover: true }])
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ media: [savedMedia] }), place.id)
  })

  it('marks only the selected image as cover when existing images are available', () => {
    const first = { file_url: 'https://example.com/one.jpg', media_type: 'image', caption: 'الأولى', is_cover: true }
    const second = { file_url: 'https://example.com/two.jpg', media_type: 'image', caption: 'الثانية', is_cover: false }
    const initial = { ...place, media: [first, second] }
    const view = render(<PlaceForm metadata={metadata} initial={initial} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('تعيين الوسيط 2 كصورة غلاف'))
    expect((screen.getByLabelText('تعيين الوسيط 1 كصورة غلاف') as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText('تعيين الوسيط 2 كصورة غلاف') as HTMLInputElement).checked).toBe(true)
    view.unmount()
  })

  it('announces saving and prevents duplicate submissions until the request finishes', async () => {
    let resolve!: (value: Place) => void
    const save = vi.fn(() => new Promise<Place>(done => { resolve = done }))
    const saved = vi.fn()
    render(<PlaceForm metadata={metadata} initial={place} savePlace={save} onSaved={saved} />)
    const form = screen.getByRole('button', { name: 'حفظ المكان' }).closest('form')!
    fireEvent.submit(form); fireEvent.submit(form)
    expect(save).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: 'جارٍ الحفظ…' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('جارٍ إرسال البيانات، يرجى الانتظار…')).toBeTruthy()
    await act(async () => resolve(place))
    expect(saved).toHaveBeenCalledWith(place)
  })

  it('clears the dependent subcategory and shows only children of the new category', () => {
    const change = vi.fn()
    const view = render(<PlacesFilters metadata={metadata} value={{ ...emptyFilters, category_id: '1', subcategory_id: '10' }} onChange={change} />)
    expect(screen.queryByText('مدرسة')).toBeNull()
    fireEvent.change(screen.getByLabelText('الفئة الرئيسية'), { target: { value: '2' } })
    expect(change).toHaveBeenCalledWith({ ...emptyFilters, category_id: '2', subcategory_id: '' })
    view.rerender(<PlacesFilters metadata={metadata} value={change.mock.calls[0][0]} onChange={change} />)
    expect(screen.queryByText('مشفى')).toBeNull()
    expect(screen.getByText('مدرسة')).toBeTruthy()
  })

  it('updates the source without rebuilding the map and restores the previous camera', () => {
    const data: PlacesGeoJSON = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [36.3, 33.52] }, properties: { id: 7, title: place.title_ar, color: '#064239' } }] }
    const select = vi.fn()
    const view = render(<PlacesMap data={data} selected={null} onSelect={select} />)
    const map = mocks.maps[0]
    act(() => map.handlers.load(event))
    expect(map.data).toHaveBeenCalledWith(data)
    act(() => map.handlers.click(event))
    expect(select).toHaveBeenCalledWith(7)
    view.rerender(<PlacesMap data={data} selected={place} onSelect={select} />)
    expect(map.flyTo).toHaveBeenCalledWith({ center: [36.3, 33.52], zoom: 16 })
    view.rerender(<PlacesMap data={{ ...data, features: [] }} selected={null} onSelect={select} />)
    expect(map.easeTo).toHaveBeenCalledWith({ center: { lng: 36.29, lat: 33.51 }, zoom: 12 })
    expect(mocks.maps).toHaveLength(1)
  })

  it('uses one draggable marker and keeps longitude/latitude ordering on click and manual changes', () => {
    const change = vi.fn()
    const view = render(<PlacesMap coordinates={null} onCoordinates={change} />)
    const map = mocks.maps[0]
    act(() => map.handlers.load(event))
    act(() => map.handlers.click(event))
    expect(change).toHaveBeenCalledWith([36.31, 33.53])
    view.rerender(<PlacesMap coordinates={[36.31, 33.53]} onCoordinates={change} />)
    view.rerender(<PlacesMap coordinates={[36.32, 33.54]} onCoordinates={change} />)
    expect(mocks.markers).toHaveLength(1)
    expect(mocks.markers[0].coordinates).toEqual([36.32, 33.54])
    act(() => mocks.markers[0].drag?.())
    expect(change).toHaveBeenLastCalledWith([36.32, 33.54])
  })

  it('rejects invalid coordinates and retains entered fields after an API failure', async () => {
    const save = vi.spyOn(placesApi, 'save').mockRejectedValue(new Error('تعذر الاتصال'))
    render(<PlaceForm metadata={metadata} initial={place} onSaved={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('خط العرض'), { target: { value: '91' } })
    fireEvent.submit(screen.getByRole('button', { name: 'حفظ المكان' }).closest('form')!)
    expect(save).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('خط العرض'), { target: { value: '33.51' } })
    await act(async () => { fireEvent.submit(screen.getByRole('button', { name: 'حفظ المكان' }).closest('form')!) })
    expect(screen.getByRole('alert').textContent).toContain('تعذر الاتصال')
    expect((screen.getByLabelText('الاسم بالعربية') as HTMLInputElement).value).toBe(place.title_ar)
  })
})
