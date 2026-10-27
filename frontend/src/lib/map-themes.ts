// ألوان الهوية البصرية المعتمدة من فيغما (Figma Design Tokens)
export const FIGMA_TOKENS = {
  // Green
  green: '#064239',
  greenDark: '#04352e',
  greenDeep: '#032d27',
  greenMedium: '#3a6962',
  greenDarkAlt: '#07473c',
  greenSoft: 'rgba(6, 66, 57, 0.68)',
  greenSoftLight: 'rgba(6, 66, 57, 0.08)',
  greenBorder: 'rgba(6, 66, 57, 0.2)',

  // Gold
  gold: '#c8a76a',
  goldLight: '#ecc988',
  goldDark: '#a58b5c',
  goldAccent: '#b8912e',
  goldMuted: '#b9a779',
  goldSand: '#be9c5a',
  goldPale: '#e8d098',

  // Backgrounds & Surfaces
  paper: '#f8f6f1',
  white: '#ffffff',
  cream: '#f7f4ed',
  creamCultural: '#f5f1e8',
  creamSoft: '#f3eddf',
  cardBg: '#fdfbf7',
  cardBgSoft: '#f4f8f6',

  // Text
  text: '#193b35',
  textDark: '#064239',
  textSdMuted: '#5a7a74',
};

export type ThemeKey = 'green-deep' | 'gold' | 'green-medium' | 'stone' | 'classic' | 'governorate';

export interface ThemeConfig {
  id: ThemeKey;
  label: string;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  colors: {
    motorway: string;
    motorwayCasing: string;
    primary: string;
    primaryCasing: string;
    secondary: string;
    secondaryCasing: string;
    minor: string;
    minorCasing: string;
    background: string;
    building: string;
    buildingOutline: string;
    text: string;
    halo: string;
  };
}

export const THEMES: Record<ThemeKey, ThemeConfig> = {
  // Basemap colors from map_style.js; identity accents from map.css.
  governorate: {
    id: 'governorate',
    label: 'هوية المحافظة',
    badgeBg: FIGMA_TOKENS.green,
    badgeText: FIGMA_TOKENS.goldLight,
    dotColor: '#a8d5a2',
    colors: {
      motorway: '#aeb7ba',
      motorwayCasing: '#ffffff',
      primary: '#aeb7ba',
      primaryCasing: '#ffffff',
      secondary: '#aeb7ba',
      secondaryCasing: '#ffffff',
      minor: '#aeb7ba',
      minorCasing: '#ffffff',
      background: '#edf0e9',
      building: '#f5f5f2',
      buildingOutline: '#d5d8d4',
      text: FIGMA_TOKENS.text,
      halo: FIGMA_TOKENS.white,
    },
  },
  // 1. الخيار الأول: الأخضر الدمشقي الفاحم (#064239)
  'green-deep': {
    id: 'green-deep',
    label: '🌿 الأخضر الفاحم (#064239)',
    badgeBg: '#064239',
    badgeText: '#ffffff',
    dotColor: '#3a6962',
    colors: {
      motorway: FIGMA_TOKENS.green,
      motorwayCasing: FIGMA_TOKENS.greenDeep,
      primary: FIGMA_TOKENS.green,
      primaryCasing: FIGMA_TOKENS.greenDark,
      secondary: FIGMA_TOKENS.greenMedium,
      secondaryCasing: FIGMA_TOKENS.greenDarkAlt,
      minor: FIGMA_TOKENS.white,
      minorCasing: 'rgba(6, 66, 57, 0.28)',
      background: FIGMA_TOKENS.cream,
      building: FIGMA_TOKENS.creamCultural,
      buildingOutline: 'rgba(6, 66, 57, 0.12)',
      text: FIGMA_TOKENS.textDark,
      halo: FIGMA_TOKENS.white,
    },
  },

  // 2. الخيار الثاني: الذهب الدمشقي الأصيل (#c8a76a)
  gold: {
    id: 'gold',
    label: '✨ الذهب الدمشقي (#c8a76a)',
    badgeBg: '#c8a76a',
    badgeText: '#064239',
    dotColor: '#b8912e',
    colors: {
      motorway: FIGMA_TOKENS.gold,
      motorwayCasing: FIGMA_TOKENS.goldDark,
      primary: FIGMA_TOKENS.goldSand,
      primaryCasing: FIGMA_TOKENS.goldDark,
      secondary: FIGMA_TOKENS.goldLight,
      secondaryCasing: FIGMA_TOKENS.goldMuted,
      minor: FIGMA_TOKENS.white,
      minorCasing: FIGMA_TOKENS.goldPale,
      background: FIGMA_TOKENS.cardBg,
      building: FIGMA_TOKENS.creamSoft,
      buildingOutline: 'rgba(184, 145, 46, 0.25)',
      text: '#4a3b1a',
      halo: FIGMA_TOKENS.white,
    },
  },

  // 3. الخيار الثالث: الأخضر المتناسق المريح (#3a6962)
  'green-medium': {
    id: 'green-medium',
    label: '🍃 الأخضر المتناسق (#3a6962)',
    badgeBg: '#3a6962',
    badgeText: '#ffffff',
    dotColor: '#74c69d',
    colors: {
      motorway: FIGMA_TOKENS.greenMedium,
      motorwayCasing: FIGMA_TOKENS.green,
      primary: FIGMA_TOKENS.greenMedium,
      primaryCasing: FIGMA_TOKENS.greenDark,
      secondary: FIGMA_TOKENS.textSdMuted,
      secondaryCasing: FIGMA_TOKENS.greenMedium,
      minor: FIGMA_TOKENS.white,
      minorCasing: 'rgba(58, 105, 98, 0.3)',
      background: FIGMA_TOKENS.paper,
      building: FIGMA_TOKENS.cardBgSoft,
      buildingOutline: 'rgba(58, 105, 98, 0.15)',
      text: FIGMA_TOKENS.textDark,
      halo: FIGMA_TOKENS.white,
    },
  },

  // 4. الخيار الرابع: الحجر الدمشقي الأصيل (#edebe0)
  stone: {
    id: 'stone',
    label: '🪨 الحجر الدمشقي (#edebe0)',
    badgeBg: '#edebe0',
    badgeText: '#4a4738',
    dotColor: '#edebe0',
    colors: {
      motorway: '#7a6a42',
      motorwayCasing: '#5a4d2e',
      primary: '#8c7a50',
      primaryCasing: '#6b5c35',
      secondary: '#a89870',
      secondaryCasing: '#8a7a55',
      minor: '#ffffff',
      minorCasing: 'rgba(74, 71, 56, 0.2)',
      background: '#edebe0',
      building: '#dedad0',
      buildingOutline: 'rgba(74, 71, 56, 0.18)',
      text: '#3a3626',
      halo: '#f5f4ee',
    },
  },

  // 5. الخيار الخامس: النمط الحيادي الأصلي (Neutral OSM)
  classic: {
    id: 'classic',
    label: 'النمط الحيادي الأصلي',
    badgeBg: '#334155',
    badgeText: '#ffffff',
    dotColor: '#94a3b8',
    colors: {
      motorway: '#fc8',
      motorwayCasing: '#e9ac77',
      primary: '#fea',
      primaryCasing: '#e9ac77',
      secondary: '#fea',
      secondaryCasing: '#e9ac77',
      minor: '#ffffff',
      minorCasing: '#cfcdca',
      background: '#f8f4f0',
      building: '#ebd3be',
      buildingOutline: '#dcd1be',
      text: '#666666',
      halo: '#ffffff',
    },
  },
};

/**
 * دالة تطبيق النمط اللوني على الخريطة مباشرة وفورياً باستخدام WebGL paint properties
 */
const governoratePaint: [string, string, string][] = [
  ...['park', 'landcover-grass', 'landcover-grass-park', 'landcover-wood'].flatMap(
    (id): [string, string, string][] => [
      [id, 'fill-color', '#a8d5a2'],
      [id, 'fill-outline-color', '#78ae75'],
    ],
  ),
  ...['water', 'water-intermittent'].map(
    (id): [string, string, string] => [id, 'fill-color', '#9dcce8'],
  ),
  ...['waterway_tunnel', 'waterway-other', 'waterway-other-intermittent',
    'waterway-stream-canal', 'waterway-stream-canal-intermittent',
    'waterway-river', 'waterway-river-intermittent'].map(
    (id): [string, string, string] => [id, 'line-color', '#79b7db'],
  ),
  ['highway-area', 'fill-color', '#aeb7ba'],
  ...['tunnel-motorway-link', 'bridge-motorway-link'].flatMap(
    (id): [string, string, string][] => [
      [id, 'line-color', '#aeb7ba'],
      [`${id}-casing`, 'line-color', '#ffffff'],
    ],
  ),
];
const originalNaturePaint = new WeakMap<object, Map<string, unknown>>();

export function applyThemeToMap(map: any, themeKey: ThemeKey) {
  if (!map || typeof map.getLayer !== 'function') return;

  const theme = THEMES[themeKey];
  if (!theme) return;

  const { colors } = theme;

  // Restore the original nature palette when switching to an existing identity.
  let originalPaint = originalNaturePaint.get(map);
  if (themeKey === 'governorate' && !originalPaint) {
    originalPaint = new Map();
    originalNaturePaint.set(map, originalPaint);
  }
  governoratePaint.forEach(([id, prop, color]) => {
    if (!map.getLayer(id)) return;
    const key = `${id}:${prop}`;
    if (themeKey === 'governorate') {
      if (!originalPaint!.has(key)) {
        originalPaint!.set(key, map.getPaintProperty(id, prop) ?? null);
      }
      map.setPaintProperty(id, prop, color);
    } else if (originalPaint?.has(key)) {
      map.setPaintProperty(id, prop, originalPaint.get(key));
    }
  });

  const safeSetPaint = (layerId: string, prop: string, value: any) => {
    try {
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, prop, value);
      }
    } catch (e) {
      // طبقة اختيارية غير متوفرة
    }
  };

  // 1. خلفية الخريطة
  safeSetPaint('background', 'background-color', colors.background);

  // 2. الكتل المعمارية والأبنية
  safeSetPaint('building', 'fill-color', colors.building);
  safeSetPaint('building', 'fill-outline-color', colors.buildingOutline);
  safeSetPaint('building-top', 'fill-color', colors.building);
  safeSetPaint('building-top', 'fill-outline-color', colors.buildingOutline);

  // 3. الأوتوسترادات والطرق السريعة (Motorways & Trunks)
  const motorwayLayers = [
    'highway-motorway',
    'highway-trunk',
    'tunnel-motorway',
    'tunnel-trunk-primary',
    'bridge-motorway',
    'bridge-trunk-primary',
    'highway-motorway-link',
  ];
  motorwayLayers.forEach((id) => safeSetPaint(id, 'line-color', colors.motorway));

  const motorwayCasings = [
    'highway-motorway-casing',
    'highway-trunk-casing',
    'tunnel-motorway-casing',
    'tunnel-trunk-primary-casing',
    'bridge-motorway-casing',
    'bridge-trunk-primary-casing',
    'highway-motorway-link-casing',
  ];
  motorwayCasings.forEach((id) => safeSetPaint(id, 'line-color', colors.motorwayCasing));

  // 4. الشوارع الرئيسية (Primary)
  safeSetPaint('highway-primary', 'line-color', colors.primary);
  safeSetPaint('highway-primary-casing', 'line-color', colors.primaryCasing);

  // 5. الشوارع الشريانية والفرعية (Secondary & Tertiary & Links)
  const secondaryLayers = [
    'highway-secondary-tertiary',
    'highway-link',
    'tunnel-secondary-tertiary',
    'tunnel-link',
    'bridge-secondary-tertiary',
    'bridge-link',
  ];
  secondaryLayers.forEach((id) => safeSetPaint(id, 'line-color', colors.secondary));

  const secondaryCasings = [
    'highway-secondary-tertiary-casing',
    'highway-link-casing',
    'tunnel-secondary-tertiary-casing',
    'tunnel-link-casing',
    'bridge-secondary-tertiary-casing',
    'bridge-link-casing',
  ];
  secondaryCasings.forEach((id) => safeSetPaint(id, 'line-color', colors.secondaryCasing));

  // 6. الأزقة وحارات دمشق القديمة (Minor, Service, Path)
  const minorLayers = [
    'highway-minor',
    'highway-path',
    'tunnel-minor',
    'tunnel-service-track',
    'tunnel-path',
    'bridge-minor',
    'bridge-path',
  ];
  minorLayers.forEach((id) => safeSetPaint(id, 'line-color', colors.minor));

  const minorCasings = [
    'highway-minor-casing',
    'tunnel-minor-casing',
    'tunnel-service-track-casing',
    'bridge-minor-casing',
    'bridge-path-casing',
  ];
  minorCasings.forEach((id) => safeSetPaint(id, 'line-color', colors.minorCasing));

  // 7. أسماء الشوارع والساحات (Street Labels)
  const labelLayers = [
    'highway-name-major',
    'highway-name-minor',
    'highway-name-path',
  ];
  labelLayers.forEach((id) => {
    safeSetPaint(id, 'text-color', colors.text);
    safeSetPaint(id, 'text-halo-color', colors.halo);
    if (themeKey !== 'governorate') safeSetPaint(id, 'text-halo-width', 2.0);
  });
}
