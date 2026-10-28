/**
 * طبقة معالم وساحات الاستدلال الثابتة على خريطة دمشق (Cognitive Basemap Waypoints)
 * 
 * المبادئ الكارتوغرافية المتبعة (وفق معايير Apple Maps و Mapbox):
 * 1. ظهور دائم كجزء من بنية الخريطة الأساسية (Basemap) دون حجب الشوارع.
 * 2. تدرج هرمي ذكي حسب مستوى التكبير (Zoom-Dependent LOD):
 *    - المستوى 1 (Tier 1 - زووم 11.0+): المعالم الكبرى ونقاط الاستدلال الرئيسية لكامل العاصمة.
 *    - المستوى 2 (Tier 2 - زووم 12.8+): الساحات الحيوية والصروح والمتاحف والمحاور الرئيسية.
 *    - المستوى 3 (Tier 3 - زووم 14.2+): الساحات والحدائق المحلية للأحياء والشوارع.
 * 3. شارات دقيقة غير مزعجة (Micro-Badges) مع خط قمرة/نوتو العربي مع هالة بيضاء تمنع التداخل (Halo Casing).
 * 4. نظام منع التصادم والتداخل التلقائي (Symbol Collision Avoidance).
 */

export interface LandmarkSelectPayload {
  id: number;
  title: string;
  title_en?: string;
  type: 'square' | 'monument' | 'park';
  tier: number;
  coordinates: [number, number];
  category_slug?: string;
  description?: string;
}

export function setupLandmarkLayers(
  map: any,
  getAssetUrl: (path: string) => string,
  onSelectLandmark: (item: LandmarkSelectPayload) => void
): void {
  if (!map || map.getSource('damascus-permanent-landmarks')) return;

  // 1. إضافة مصدر بيانات المعالم الدائمة
  map.addSource('damascus-permanent-landmarks', {
    type: 'geojson',
    data: getAssetUrl('/data/damascus_permanent_landmarks.geojson'),
    attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>',
    promoteId: 'id',
  });

  // -------------------------------------------------------------------------
  // المستوى الأول (Tier 1): زووم 11.0+ (9 معالم كبرى تكشف جغرافيا دمشق بالكامل)
  // -------------------------------------------------------------------------
  map.addLayer({
    id: 'landmarks-tier1-badge',
    type: 'circle',
    source: 'damascus-permanent-landmarks',
    filter: ['==', ['get', 'tier'], 1],
    minzoom: 11.0,
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        11, 4.5,
        14, 6.0,
        17, 7.5
      ],
      'circle-color': [
        'case',
        ['==', ['get', 'type'], 'square'], '#c8a76a', // ذهبي دمشقي عتيق للساحات
        ['==', ['get', 'type'], 'park'], '#059669',   // ياسميني أخضر للحدائق
        '#064239'                                     // أخضر سيادي للمعالم التاريخية
      ],
      'circle-stroke-width': 2.0,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.95,
    },
  });

  map.addLayer({
    id: 'landmarks-tier1-label',
    type: 'symbol',
    source: 'damascus-permanent-landmarks',
    filter: ['==', ['get', 'tier'], 1],
    minzoom: 11.0,
    layout: {
      'text-field': ['get', 'title'],
      'text-font': ['Klokantech Noto Sans Regular'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        11, 11.0,
        13.5, 12.5,
        16, 14.0
      ],
      'text-variable-anchor': ['top', 'bottom', 'left', 'right', 'top-left', 'top-right'],
      'text-radial-offset': 0.8,
      'text-justify': 'auto',
      'text-max-width': 8.5,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'symbol-sort-key': ['get', 'tier'],
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'type'], 'square'], '#1e293b',
        ['==', ['get', 'type'], 'park'], '#047857',
        '#064239'
      ],
      'text-halo-color': '#ffffff',
      'text-halo-width': 2.2,
      'text-halo-blur': 0.6,
    },
  });

  // -------------------------------------------------------------------------
  // المستوى الثاني (Tier 2): زووم 12.8+ (الساحات والمحاور والصروح الثقافية والخدمية)
  // -------------------------------------------------------------------------
  map.addLayer({
    id: 'landmarks-tier2-badge',
    type: 'circle',
    source: 'damascus-permanent-landmarks',
    filter: ['==', ['get', 'tier'], 2],
    minzoom: 12.8,
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        13, 4.0,
        15, 5.5,
        17, 6.5
      ],
      'circle-color': [
        'case',
        ['==', ['get', 'type'], 'square'], '#c8a76a',
        ['==', ['get', 'type'], 'park'], '#059669',
        '#064239'
      ],
      'circle-stroke-width': 1.8,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.95,
    },
  });

  map.addLayer({
    id: 'landmarks-tier2-label',
    type: 'symbol',
    source: 'damascus-permanent-landmarks',
    filter: ['==', ['get', 'tier'], 2],
    minzoom: 12.8,
    layout: {
      'text-field': ['get', 'title'],
      'text-font': ['Klokantech Noto Sans Regular'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        13, 10.5,
        15, 12.0,
        17, 13.5
      ],
      'text-variable-anchor': ['top', 'bottom', 'left', 'right', 'top-left', 'top-right'],
      'text-radial-offset': 0.75,
      'text-justify': 'auto',
      'text-max-width': 8.0,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'symbol-sort-key': ['get', 'tier'],
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'type'], 'square'], '#1e293b',
        ['==', ['get', 'type'], 'park'], '#047857',
        '#064239'
      ],
      'text-halo-color': '#ffffff',
      'text-halo-width': 2.0,
      'text-halo-blur': 0.5,
    },
  });

  // -------------------------------------------------------------------------
  // المستوى الثالث (Tier 3): زووم 14.2+ (الساحات والحدائق المحلية للأحياء)
  // -------------------------------------------------------------------------
  map.addLayer({
    id: 'landmarks-tier3-badge',
    type: 'circle',
    source: 'damascus-permanent-landmarks',
    filter: ['==', ['get', 'tier'], 3],
    minzoom: 14.2,
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        14.5, 3.8,
        17, 5.0
      ],
      'circle-color': [
        'case',
        ['==', ['get', 'type'], 'square'], '#c8a76a',
        ['==', ['get', 'type'], 'park'], '#059669',
        '#064239'
      ],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.9,
    },
  });

  map.addLayer({
    id: 'landmarks-tier3-label',
    type: 'symbol',
    source: 'damascus-permanent-landmarks',
    filter: ['==', ['get', 'tier'], 3],
    minzoom: 14.2,
    layout: {
      'text-field': ['get', 'title'],
      'text-font': ['Klokantech Noto Sans Regular'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        14.5, 10.0,
        17, 12.0
      ],
      'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
      'text-radial-offset': 0.7,
      'text-justify': 'auto',
      'text-max-width': 8.0,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'symbol-sort-key': ['get', 'tier'],
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'type'], 'square'], '#334155',
        ['==', ['get', 'type'], 'park'], '#047857',
        '#064239'
      ],
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.8,
      'text-halo-blur': 0.5,
    },
  });

  // -------------------------------------------------------------------------
  // تفاعل النقر والتحويم (Interactive Pointer & Selection)
  // -------------------------------------------------------------------------
  const landmarkLayerIds = [
    'landmarks-tier1-badge', 'landmarks-tier1-label',
    'landmarks-tier2-badge', 'landmarks-tier2-label',
    'landmarks-tier3-badge', 'landmarks-tier3-label'
  ];

  landmarkLayerIds.forEach((layerId) => {
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('click', layerId, (e: any) => {
      if (!e.features || !e.features[0]) return;
      if (e.originalEvent) e.originalEvent._handledByLayer = true;
      const feat = e.features[0];
      const props = feat.properties;
      const geom = feat.geometry;
      const coords = geom?.coordinates as [number, number];

      if (coords && props) {
        onSelectLandmark({
          id: Number(props.id),
          title: props.title || '',
          title_en: props.title_en,
          type: props.type,
          tier: Number(props.tier) || 1,
          coordinates: coords,
          category_slug: props.category_slug,
          description: props.description,
        });
      }
    });
  });
}
