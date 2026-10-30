import type { FeatureCollection, Point } from 'geojson'

export type Place = {
  id: number; title_ar: string; title_en: string; description: string; sector: string
  latitude: number; longitude: number; location_text: string
  opening_hours: Record<string, unknown>; is_visible: boolean; is_verified: boolean
  sub_category_id: number; admin_area_id: number | null; category_id?: number
  category_name?: string; sub_category_name?: string; admin_area_name?: string
  communication_info: { type: string; value: string }[]
  media: { file_url: string; media_type: string; caption: string; is_cover: boolean }[]
}
export type PlaceInput = Omit<Place, 'id'>
export type Metadata = {
  csrf_token: string
  categories: { id: number; name_ar: string; subcategories: { id: number; name_ar: string }[] }[]
  admin_areas: { id: number; name_ar: string }[]; sectors: string[]; contact_types: [string, string][]
}
export type Filters = { category_id: string; subcategory_id: string; admin_area_id: string; search: string; is_visible: string; is_verified: string }
export const emptyFilters: Filters = { category_id: '', subcategory_id: '', admin_area_id: '', search: '', is_visible: '', is_verified: '' }
export type PlacesGeoJSON = FeatureCollection<Point, { id: number; title: string; color: string }> & { truncated?: boolean }
export type PlacePage = { count: number; next: string | null; previous: string | null; results: Place[] }
