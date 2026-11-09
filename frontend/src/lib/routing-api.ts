export type RoutingPoint = { lat: number; lon: number; title: string };
export type RoutingMode = 'transit' | 'car' | 'walk';
export interface RouteLeg {
  mode: 'walk' | 'bus';
  distance_m: number;
  duration_seconds: number;
  geojson: { type: 'Feature'; geometry: { type: 'LineString'; coordinates: number[][] }; properties?: Record<string, unknown> };
}

export interface RouteResult {
  mode: RoutingMode;
  mode_title: string;
  summary: string;
  line_name?: string;
  direction?: 'outbound' | 'inbound';
  alternatives?: Array<{ mode: 'walk'; summary: string; distance_m: number; duration_s: number; legs: RouteLeg[] }>;
  recommended_mode?: 'transit' | 'walk';
  cost_syp: number;
  total_distance_km: number;
  duration_minutes: number;
  calories_burned?: number;
  steps: Array<{ instruction: string; icon: string; duration_mins: number }>;
  route_geojson: { type: 'Feature'; geometry: { type: 'LineString'; coordinates: number[][] } };
  distance_m?: number;
  duration_seconds?: number;
  walking_distance_km?: number;
  walking_duration_minutes?: number;
  bus_distance_km?: number;
  bus_duration_minutes?: number;
  waiting_time_minutes?: number | null;
  boarding?: number[];
  alighting?: number[];
  boarding_safety_verified?: boolean;
  start?: { longitude: number; latitude: number };
  end?: { longitude: number; latitude: number };
  route_legs?: RouteLeg[];
}

export async function fetchRoutingResult(
  apiBaseUrl: string,
  origin: RoutingPoint,
  destination: RoutingPoint,
  mode: RoutingMode,
  signal: AbortSignal,
): Promise<RouteResult> {
  const query = new URLSearchParams({
    start_lat: String(origin.lat), start_lon: String(origin.lon),
    end_lat: String(destination.lat), end_lon: String(destination.lon), mode,
  });
  const response = await fetch(`${apiBaseUrl}/routing/?${query}`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'لم يُعثر على مسار قابل للقيادة.');
  if (!data.route_geojson || !Array.isArray(data.steps)) throw new Error('استجابة التوجيه غير صالحة.');
  return data as RouteResult;
}
