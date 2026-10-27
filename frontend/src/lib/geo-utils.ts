/**
 * geo-utils.ts
 * دوال مساعدة لحساب الحدود الجغرافية والتسلسل الهرمي للبلديات والأحياء في دمشق
 */

export type LngLatBoundsLike = [[number, number], [number, number]];

/**
 * حساب الحدود الجغرافية الدقيقة لأي مضلع أو مضلع متعدد (Bounding Box)
 */
export function getFeatureBounds(feature: any): LngLatBoundsLike | null {
  if (!feature || !feature.geometry) return null;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;

  function scan(coords: any) {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const [lng, lat] = coords;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    } else {
      for (const item of coords) {
        scan(item);
      }
    }
  }

  scan(feature.geometry.coordinates);
  if (minLng === Infinity || maxLng === -Infinity) return null;
  return [[minLng, minLat], [maxLng, maxLat]];
}

/**
 * استخراج الأحياء التابعة لبلدية معينة من الـ GeoJSON
 */
export function getChildNeighborhoods(features: any[], municipalityId: number): any[] {
  if (!Array.isArray(features)) return [];
  return features.filter(
    (f) => Number(f.properties?.level) === 10 && Number(f.properties?.parent_id) === Number(municipalityId)
  );
}

/**
 * استخراج بيانات البلدية بواسطة معرفها ID
 */
export function getMunicipalityById(features: any[], municipalityId: number): any | null {
  if (!Array.isArray(features)) return null;
  return (
    features.find(
      (f) => Number(f.properties?.level) === 9 && Number(f.properties?.id) === Number(municipalityId)
    ) || null
  );
}
