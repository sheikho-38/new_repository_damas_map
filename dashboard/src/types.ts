export type Page = 'dashboard' | 'routes' | 'routes-map'

// [longitude, latitude]
export type LngLat = [number, number]

export type Direction = 'ذهاب' | 'إياب'

export type LineGeometry = {
  type: 'LineString'
  coordinates: number[][]
}

// Active route returned by GET /admin/routes
export type RouteSummary = {
  id: number
  bus_id: number
  route_name: string
  name: string
  color: string
  direction: Direction
  version: number
  is_active: boolean
  start_point: string
  end_point: string
  distance_m: number
  trip_time_s: number
  fare: number | null
}

// Active route displayed on the map
export type MapRoute = {
  id: number
  bus_id: number
  route_name: string
  color: string
  fare: number | null
  direction: Direction
  version: number
  start_point: string
  end_point: string
  distance_m: number
  trip_time_s: number
  geometry: LineGeometry
}

// Request for creating a bus and its first route
export type RouteCreatePayload = {
  name: string
  color: string
  price: number
  direction: Direction
  start_point: string
  end_point: string
  waypoints: LngLat[]
}

// Request for creating a new version of an existing route
export type RouteUpdatePayload = {
  name: string
  color: string
  price: number
  direction: Direction
  start_point: string
  end_point: string
  waypoints: LngLat[]
}

export type CalculatedRoute = {
  geometry: LineGeometry
  distance_m: number
  trip_time_s: number
  duration_seconds?: number
  duration_minutes: number
}
