import { API_URL } from './config'
import type {
  CalculatedRoute,
  Direction,
  LngLat,
  MapRoute,
  RouteCreatePayload,
  RouteSummary,
  RouteUpdatePayload,
} from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = body?.detail
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg).join(', ')
      : detail

    throw new Error(
      typeof message === 'string' && message
        ? message
        : `HTTP ${res.status}`,
    )
  }

  return res.json() as Promise<T>
}

export const getRoutes = () => request<RouteSummary[]>('/admin/routes')

export const getMapRoutes = () => request<MapRoute[]>('/admin/routes/map')

export const calculateRoute = (points: LngLat[]) =>
  request<CalculatedRoute>('/admin/routes/brouter-waypoints', {
    method: 'POST',
    body: JSON.stringify({
      waypoints: points.map(([lon, lat]) => ({ lon, lat })),
    }),
  })

export const createRoute = (payload: RouteCreatePayload) =>
  request<{ id: number; bus_id: number; route_name: string; version: number }>(
    '/admin/routes',
    {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        waypoints: payload.waypoints.map(([lon, lat]) => ({ lon, lat })),
      }),
    },
  )


export const addDirectionToBus = (
  busId: number,
  payload: {
    direction: Direction
    start_point: string
    end_point: string
    waypoints: LngLat[]
  },
) =>
  request<{
    id: number
    bus_id: number
    route_name: string
    version: number
    direction: Direction
  }>(`/admin/routes/buses/${busId}/routes`, {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      waypoints: payload.waypoints.map(([lon, lat]) => ({ lon, lat })),
    }),
  })


export const updateRoute = (id: number, payload: RouteUpdatePayload) =>
  request<{ id: number; bus_id: number; route_name: string; version: number }>(
    `/admin/routes/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        ...payload,
        waypoints: payload.waypoints.map(([lon, lat]) => ({ lon, lat })),
      }),
    },
  )

export const deleteRoute = (id: number) =>
  request<{ id: number; bus_id: number; deleted: boolean; is_active: boolean }>(
    `/admin/routes/${id}`,
    {
      method: 'DELETE',
    },
  )

export const deleteBus = (busId: number) =>
  request<{ id: number; deleted: boolean; is_active: boolean }>(
    `/admin/routes/buses/${busId}`,
    {
      method: 'DELETE',
    },
  )
