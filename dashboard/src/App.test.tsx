// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./pages/DashboardPage', () => ({ default: () => <p>dashboard-page</p> }))
vi.mock('./pages/RoutesListPage', () => ({ default: () => <p>routes-page</p> }))
vi.mock('./pages/RoutesMapPage', () => ({ default: ({ startAdding }: { startAdding?: boolean }) => <p>{startAdding ? 'routes-add-page' : 'routes-map-page'}</p> }))
vi.mock('./pages/PlacesExplorerPage', () => ({ default: () => <p>places-page</p> }))
vi.mock('./pages/EditPlacePage', () => ({ default: () => <p>edit-place-page</p> }))
vi.mock('./pages/PlaceSubmissionPage', () => ({ default: () => <p>standalone-place-form</p> }))
vi.mock('./pages/HomePage', () => ({ default: ({ onNavigate }: { onNavigate: (page: 'routes-new' | 'places-new') => void }) => <div><button onClick={() => onNavigate('routes-new')}>إضافة طريق</button><button onClick={() => onNavigate('places-new')}>إضافة مكان</button></div> }))
afterEach(cleanup)

it('opens the place form without a token, dashboard navigation or transport controls', () => {
  window.history.replaceState({}, '', '/places/new')
  render(<App />)
  expect(screen.getByText('standalone-place-form')).toBeTruthy()
  expect(screen.queryByRole('navigation')).toBeNull()
  expect(screen.queryByText('لوحة التحكم')).toBeNull()
  expect(screen.queryByText('خطوط النقل')).toBeNull()
})

it('also keeps the internal add form outside the transport dashboard layout', () => {
  window.history.replaceState({}, '', '/admin/places/new')
  render(<App />)
  expect(screen.getByText('standalone-place-form')).toBeTruthy()
  expect(screen.queryByRole('navigation')).toBeNull()
})

it.each([['/admin/places', 'places-page'], ['/admin/places/edit?id=7', 'edit-place-page'], ['/admin/places/new', 'standalone-place-form'], ['/admin/routes', 'routes-page'], ['/admin/routes/map', 'routes-map-page'], ['/admin/routes/new', 'routes-add-page'], ['/admin', 'dashboard-page']])('opens %s directly', (path, page) => {
  window.history.replaceState({}, '', path)
  render(<App />)
  expect(screen.getByText(page)).toBeTruthy()
})

it('shows add choices at the root and opens the corresponding forms', () => {
  window.history.replaceState({}, '', '/')
  const { unmount } = render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'إضافة طريق' }))
  expect(window.location.pathname).toBe('/admin/routes/new')
  expect(screen.getByText('routes-add-page')).toBeTruthy()

  unmount()
  window.history.replaceState({}, '', '/')
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'إضافة مكان' }))
  expect(window.location.pathname).toBe('/admin/places/new')
  expect(screen.getByText('standalone-place-form')).toBeTruthy()
})

it('hides place editing from transport navigation while preserving route navigation', () => {
  window.history.replaceState({}, '', '/admin')
  render(<App />)
  expect(screen.queryByRole('button', { name: /استكشاف الأماكن/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /تعديل مكان/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /خطوط النقل/ }))
  expect(window.location.pathname).toBe('/admin/routes')
  expect(screen.getByText('routes-page')).toBeTruthy()
  window.history.replaceState({}, '', '/admin/routes/map')
  fireEvent(window, new PopStateEvent('popstate'))
  expect(screen.getByText('routes-map-page')).toBeTruthy()
})
