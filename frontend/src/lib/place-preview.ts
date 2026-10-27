import type { PlaceDetailData } from '../components/PlaceDetailDrawer';

// Show the map's own data immediately, even if the detail API is unavailable.
export function createPlacePreview(
  properties: Record<string, unknown>,
  coordinates: [number, number],
): PlaceDetailData {
  return {
    id: Number(properties.id) || 0,
    title: String(properties.title || properties.name || 'مكان'),
    title_en: String(properties.title_en || ''),
    description: String(properties.description || ''),
    category: {
      id: 0,
      name_ar: String(properties.category_name_ar || properties.category_name || 'معلم على الخريطة'),
      slug: String(properties.category_slug || ''),
      icon: String(properties.icon || ''),
      color: String(properties.category_color || properties.color || '#064239'),
    },
    location: {
      longitude: coordinates[0],
      latitude: coordinates[1],
      address_text: String(properties.address_text || ''),
      neighborhood: '',
      municipality: '',
    },
    contact: {},
    is_verified: false,
    media: [],
  };
}
