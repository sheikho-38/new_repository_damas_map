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

// Rasterize small vector badges once; no remote images or font-dependent symbols.
function registerLandmarkIcons(map: any): void {
  const icons = {
    monument: { color: '#064239', path: 'M5 10L12 5L19 10Z M7 12V18 M12 12V18 M17 12V18 M5 20H19' },
    square: { color: '#c8a76a', path: 'M5 5H19V19H5Z M9 9H15V15H9Z M12 5V9 M12 15V19 M5 12H9 M15 12H19' },
    park: { color: '#059669', path: 'M12 4L6 11H9L5 16H19L15 11H18Z M12 16V21' },
  };
  for (const [type, icon] of Object.entries(icons)) {
    if (map.hasImage(`landmark-${type}`)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.scale(2, 2);
    ctx.fillStyle = icon.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.translate(4, 4);
    ctx.lineWidth = 1.6;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(icon.path));
    map.addImage(`landmark-${type}`, ctx.getImageData(0, 0, 64, 64), { pixelRatio: 2 });
  }
}

const landmarkIconLayout = {
  'icon-image': ['match', ['get', 'type'], 'park', 'landmark-park', 'square', 'landmark-square', 'landmark-monument'],
  'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 17, 1],
  'icon-allow-overlap': false,
  'icon-padding': 2,
};

export function setupLandmarkLayers(
  map: any,
  getAssetUrl: (path: string) => string,
  onSelectLandmark: (item: LandmarkSelectPayload) => void
): void {
  if (!map || map.getSource('damascus-permanent-landmarks')) return;
  registerLandmarkIcons(map);

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
    type: 'symbol',
    source: 'damascus-permanent-landmarks',
    filter: ['==', ['get', 'tier'], 1],
    minzoom: 11.0,
    layout: landmarkIconLayout,
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
      'text-radial-offset': 1.3,
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
    type: 'symbol',
    source: 'damascus-permanent-landmarks',
    filter: ['==', ['get', 'tier'], 2],
    minzoom: 12.8,
    layout: landmarkIconLayout,
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
      'text-radial-offset': 1.3,
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
    type: 'symbol',
    source: 'damascus-permanent-landmarks',
    filter: ['==', ['get', 'tier'], 3],
    minzoom: 14.2,
    layout: landmarkIconLayout,
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
      'text-radial-offset': 1.3,
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
