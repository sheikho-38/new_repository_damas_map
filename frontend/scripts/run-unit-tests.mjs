import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');

// 1. Test Static Font Assets & Typography Configuration
test('Font Assets: ITF Qomra Arabic files exist and are non-empty', () => {
  const fontFiles = [
    'itfQomraArabic-Regular.woff2',
    'itfQomraArabic-Regular.woff',
    'itfQomraArabic-Medium.woff2',
    'itfQomraArabic-Medium.woff',
    'itfQomraArabic-Bold.woff2',
    'itfQomraArabic-Bold.woff',
    'itfQomraArabic-Black.woff2',
    'itfQomraArabic-Black.woff',
  ];

  for (const file of fontFiles) {
    const fullPath = path.join(frontendRoot, 'public/fonts', file);
    assert.ok(fs.existsSync(fullPath), `Font file missing: ${file}`);
    const stats = fs.statSync(fullPath);
    assert.ok(stats.size > 20000, `Font file ${file} too small: ${stats.size} bytes`);
  }
});

test('Typography & Tokens: layout.tsx loads Qomra via next/font/local and globals.css references tokens', () => {
  const cssPath = path.join(frontendRoot, 'src/app/globals.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const layoutPath = path.join(frontendRoot, 'src/app/layout.tsx');
  const layout = fs.readFileSync(layoutPath, 'utf8');

  assert.ok(layout.includes('itfQomraArabic'), 'Missing Qomra font loading in layout.tsx');
  assert.ok(css.includes('--stone: #edebe0'), 'Missing --stone: #edebe0 token');
  assert.ok(css.includes('var(--font-qomra)'), 'Missing var(--font-qomra) in body font-family');
});


// 2. Test Map Themes & Stone Theme (#edebe0) Specification
test('Visual Identity: Stone (#edebe0) theme and all theme definitions', async () => {
  const { THEMES, applyThemeToMap } = await import('../src/lib/map-themes.ts');

  assert.ok(THEMES.stone, 'Stone theme is missing from THEMES');
  assert.equal(THEMES.stone.id, 'stone');
  assert.equal(THEMES.stone.colors.background, '#edebe0', 'Stone theme background must be #edebe0');
  assert.equal(THEMES.stone.dotColor, '#edebe0', 'Stone theme dotColor must be #edebe0');
  assert.ok(THEMES.stone.label.includes('#edebe0'), 'Stone label should mention #edebe0');

  const requiredKeys = ['green-deep', 'gold', 'green-medium', 'stone', 'classic'];
  for (const key of requiredKeys) {
    const theme = THEMES[key];
    assert.ok(theme, `Theme ${key} must exist`);
    assert.ok(theme.colors.motorway, `Theme ${key} missing motorway color`);
    assert.ok(theme.colors.primary, `Theme ${key} missing primary color`);
    assert.ok(theme.colors.background, `Theme ${key} missing background color`);
    assert.ok(theme.colors.building, `Theme ${key} missing building color`);
    assert.ok(theme.colors.text, `Theme ${key} missing text color`);
  }

  // Test applyThemeToMap with a mock MapLibre map instance
  const paintedLayers = {};
  const mockMap = {
    getLayer: (id) => true,
    setPaintProperty: (layerId, prop, value) => {
      paintedLayers[`${layerId}:${prop}`] = value;
    },
  };

  applyThemeToMap(mockMap, 'stone');
  assert.equal(paintedLayers['background:background-color'], '#edebe0');
  assert.equal(paintedLayers['building:fill-color'], '#dedad0');
});

// 3. Test API and Asset URL Configurations
test('Deployment Config: getApiBaseUrl and getAssetUrl work under different environments', async () => {
  const { getApiBaseUrl, getAssetUrl, getAssetPath, BASE_PATH } = await import('../src/lib/api-config.ts');

  assert.equal(typeof getApiBaseUrl, 'function');
  assert.equal(typeof getAssetUrl, 'function');
  assert.equal(typeof getAssetPath, 'function');

  // Test asset URL formatting
  const tileUrl = getAssetUrl('/vector-tiles/11/1230/822.pbf');
  assert.ok(tileUrl.endsWith('/vector-tiles/11/1230/822.pbf'));

  const styleUrl = getAssetUrl('damascus-clean-style.json');
  assert.ok(styleUrl.endsWith('/damascus-clean-style.json'));

  // Test SSR safety of getAssetPath (always relative, identical on server and client)
  const logoPath = getAssetPath('/damascus_governorate_logo.png');
  assert.equal(logoPath, `${BASE_PATH}/damascus_governorate_logo.png`);

  // Simulate client window and verify MapLibre absolute requirements vs SSR safety
  global.window = { location: { origin: 'http://localhost:3000' } };
  
  // 1. getAssetPath must remain isomorphic and root-relative on client to prevent hydration mismatches
  const clientLogoPath = getAssetPath('/damascus_governorate_logo.png');
  assert.equal(clientLogoPath, `${BASE_PATH}/damascus_governorate_logo.png`);

  // 2. getAssetUrl on client must be absolute to satisfy MapLibre sprite and glyph specifications
  const clientSpriteUrl = getAssetUrl('/sprites/ofm');
  assert.equal(clientSpriteUrl, `http://localhost:3000${BASE_PATH}/sprites/ofm`);
  assert.ok(clientSpriteUrl.startsWith('http://') || clientSpriteUrl.startsWith('https://'), 'MapLibre sprite URL must be absolute');

  const clientGlyphsUrl = getAssetUrl('/fonts/{fontstack}/{range}.pbf');
  assert.equal(clientGlyphsUrl, `http://localhost:3000${BASE_PATH}/fonts/{fontstack}/{range}.pbf`);

  delete global.window;
});


// 4. Test MapLibre Style Specification and Administrative GeoJSON Data Integrity
test('Map Data Integrity: damascus-clean-style.json and damascus_admin_areas.geojson', () => {
  const stylePath = path.join(frontendRoot, 'public/damascus-clean-style.json');
  assert.ok(fs.existsSync(stylePath), 'damascus-clean-style.json missing');
  const style = JSON.parse(fs.readFileSync(stylePath, 'utf8'));
  assert.equal(style.version, 8);
  assert.ok(style.sources.openmaptiles, 'openmaptiles source missing in style');
  assert.ok(Array.isArray(style.layers), 'style layers must be an array');
  assert.ok(style.layers.length > 10, 'style should have at least 10 layers');

  const adminGeoJsonPath = path.join(frontendRoot, 'public/data/damascus_admin_areas.geojson');
  assert.ok(fs.existsSync(adminGeoJsonPath), 'damascus_admin_areas.geojson missing');
  const adminGeoJson = JSON.parse(fs.readFileSync(adminGeoJsonPath, 'utf8'));
  assert.equal(adminGeoJson.type, 'FeatureCollection');
  assert.ok(Array.isArray(adminGeoJson.features));
  assert.equal(adminGeoJson.features.length, 114, 'Should contain exactly 114 administrative polygons');
});

// 5. Test Theme & Dark Mode Selection Highlighting Contrast Integrity
test('Dark Mode & Selection Contrast: globals.css and components have high-contrast selection and hover rules', () => {
  const cssPath = path.join(frontendRoot, 'src/app/globals.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify text selection CSS exists for light and dark modes
  assert.ok(css.includes('::selection'), 'globals.css must define ::selection');
  assert.ok(css.includes('@media (prefers-color-scheme: dark)'), 'globals.css must have dark prefers-color-scheme selection');
  assert.ok(css.includes('.dark ::selection'), 'globals.css must have .dark class selection support');

  // Verify MapViewer category chips have dark mode hover styling (preventing invisible white-on-white text)
  const mapViewerPath = path.join(frontendRoot, 'src/components/MapViewer.tsx');
  const mapViewerSrc = fs.readFileSync(mapViewerPath, 'utf8');
  assert.ok(mapViewerSrc.includes('dark:hover:bg-zinc-800'), 'MapViewer chips must have dark:hover:bg-zinc-800');
  assert.ok(mapViewerSrc.includes('dark:hover:text-white'), 'MapViewer chips must have dark:hover:text-white');

  // Verify DamasceneSearchBar search items have dark hover text
  const searchBarPath = path.join(frontendRoot, 'src/components/DamasceneSearchBar.tsx');
  const searchBarSrc = fs.readFileSync(searchBarPath, 'utf8');
  assert.ok(searchBarSrc.includes('dark:group-hover:text-emerald-300'), 'DamasceneSearchBar must have dark:group-hover:text-emerald-300');
});

// 6. Test Arabic RTL Ergonomics & Floating Card Consistency: Master Controls on Right, Floating Cards on Left
test('Arabic RTL Ergonomics: LayersPanel on right, floating PlaceDetailDrawer on left', () => {
  const mapViewerPath = path.join(frontendRoot, 'src/components/MapViewer.tsx');
  const mapViewerSrc = fs.readFileSync(mapViewerPath, 'utf8');
  assert.ok(mapViewerSrc.includes('right-3 sm:right-4'), 'LayersPanel container in MapViewer must be on the right');
  assert.ok(mapViewerSrc.includes('sm:left-4'), 'selectedArea detail card in MapViewer must be on the left');
  assert.ok(mapViewerSrc.includes('rounded-3xl'), 'selectedArea detail card must have rounded-3xl floating styling');

  const drawerPath = path.join(frontendRoot, 'src/components/PlaceDetailDrawer.tsx');
  const drawerSrc = fs.readFileSync(drawerPath, 'utf8');
  assert.ok(drawerSrc.includes('sm:left-4'), 'PlaceDetailDrawer must float on the left (sm:left-4)');
  assert.ok(drawerSrc.includes('sm:rounded-3xl'), 'PlaceDetailDrawer must have sm:rounded-3xl floating corners');
  assert.ok(drawerSrc.includes('backdrop-blur-md'), 'PlaceDetailDrawer must have backdrop-blur-md frosted glass');
});

// 7. Test Google Maps-Style Place Card: Unscrollable, Cover Image, Clean Address, Expandable Description, Bottom CTA
test('Google Maps Place Card: Compact unscrollable layout, cover photo, expandable info, and bottom CTA', () => {
  const drawerPath = path.join(frontendRoot, 'src/components/PlaceDetailDrawer.tsx');
  const drawerSrc = fs.readFileSync(drawerPath, 'utf8');

  // Verify cover photo with Google Maps style placeholder
  assert.ok(drawerSrc.includes('DEFAULT_PLACEHOLDERS'), 'PlaceDetailDrawer must define fallback cover photos');
  assert.ok(drawerSrc.includes('displayImage'), 'PlaceDetailDrawer must render cover photo');
  assert.ok(drawerSrc.includes('damascus_government_cover.png'), 'PlaceDetailDrawer must use Damascus Governorate sovereign cover for government POIs');
  assert.ok(!drawerSrc.includes('photo-1541872703-74c5e44368f9'), 'Foreign/Obama government placeholder image must be removed');

  const govCoverPath = path.join(frontendRoot, 'public/damascus_government_cover.png');
  assert.ok(fs.existsSync(govCoverPath), 'damascus_government_cover.png must exist');
  assert.ok(fs.statSync(govCoverPath).size > 20000, 'damascus_government_cover.png must be non-empty');

  // Verify expandable "نبذة" button next to name
  assert.ok(drawerSrc.includes('showDescription'), 'PlaceDetailDrawer must have expandable description state');
  assert.ok(drawerSrc.includes('نبذة'), 'PlaceDetailDrawer must feature a "نبذة" button next to title');

  // Verify clean address formatting without title duplication
  assert.ok(drawerSrc.includes('formatCleanAddress'), 'PlaceDetailDrawer must clean and format address hierarchy');
  assert.ok(drawerSrc.includes('formattedAddress'), 'PlaceDetailDrawer must display formatted address');

  // Verify opening hours and CTA navigation at bottom
  assert.ok(drawerSrc.includes('formattedHours'), 'PlaceDetailDrawer must display formatted opening hours');
  assert.ok(drawerSrc.includes('الوصول إلى المكان'), 'PlaceDetailDrawer must render navigation CTA button');

  // Verify strict React Rules of Hooks compliance: all hooks must be declared before any early return
  const returnIdx = drawerSrc.indexOf('if (!place) return null;');
  const lastHookIdx = Math.max(
    drawerSrc.lastIndexOf('useState('),
    drawerSrc.lastIndexOf('useEffect(')
  );
  assert.ok(returnIdx > lastHookIdx, 'All React hooks in PlaceDetailDrawer must be called before if (!place) return null');
});

// 8. Test POI Focus & Isolation: Zoom to POI and hide all others
test('POI Focus & Isolation: MapViewer zooms to chosen POI and hides all other markers', () => {
  const mapViewerPath = path.join(frontendRoot, 'src/components/MapViewer.tsx');
  const mapViewerSrc = fs.readFileSync(mapViewerPath, 'utf8');

  // Verify filter isolation logic for circles and labels
  assert.ok(mapViewerSrc.includes("map.setFilter('places-poi-circles', filter)"), 'Must filter POI circles to selected place');
  assert.ok(mapViewerSrc.includes("map.setFilter('places-poi-labels', filter)"), 'Must filter POI labels to selected place');

  // Verify filter reset logic when place is closed
  assert.ok(mapViewerSrc.includes("map.setFilter('places-poi-circles', null)"), 'Must reset POI circles filter when closed');
  assert.ok(mapViewerSrc.includes("map.setFilter('places-poi-labels', null)"), 'Must reset POI labels filter when closed');

  // Verify smooth flyTo zoom
  assert.ok(mapViewerSrc.includes('zoom: 17.5'), 'Must zoom to 17.5 when focusing on selected POI');
});

// 9. Test Single POI Category Selection Enforcement & Radio Semantics
test('POI Single Category Selection: MapViewer and LayersPanel enforce single-select behavior', () => {
  const mapViewerPath = path.join(frontendRoot, 'src/components/MapViewer.tsx');
  const mapViewerSrc = fs.readFileSync(mapViewerPath, 'utf8');

  // Verify single-select state update logic in MapViewer
  assert.ok(
    mapViewerSrc.includes('prev.includes(slug) ? [] : [slug]'),
    'MapViewer handleToggleCategory must enforce single-select toggle (prev.includes(slug) ? [] : [slug])'
  );
  assert.ok(
    mapViewerSrc.includes('setSelectedCategories([pData.category.slug])'),
    'MapViewer search selection must set single category array'
  );

  const layersPanelPath = path.join(frontendRoot, 'src/components/LayersPanel.tsx');
  const layersPanelSrc = fs.readFileSync(layersPanelPath, 'utf8');

  // Verify radio button indicator (rounded-full with inner dot) instead of checkbox
  assert.ok(
    layersPanelSrc.includes('rounded-full flex items-center justify-center'),
    'LayersPanel must use rounded-full radio circle indicator'
  );
  assert.ok(
    layersPanelSrc.includes('w-2 h-2 rounded-full bg-[#064239]'),
    'LayersPanel must display inner dot for selected radio item'
  );

  // Verify single-select header labels
  assert.ok(
    layersPanelSrc.includes('اختر تصنيفاً واحداً'),
    'LayersPanel must indicate single selection prompt'
  );
  assert.ok(
    layersPanelSrc.includes('إلغاء التحديد'),
    'LayersPanel must provide clear deselect option'
  );
});

// 11. Test Smart City Interactive Hierarchy: Admin Areas, Neighborhood Drill-Down, and Breadcrumbs
test('Smart City Admin Hierarchy: Interactive polygons, child neighborhoods isolation, and breadcrumbs', async () => {
  const { getFeatureBounds, getChildNeighborhoods, getMunicipalityById } = await import('../src/lib/geo-utils.ts');

  const adminGeoJsonPath = path.join(frontendRoot, 'public/data/damascus_admin_areas.geojson');
  const adminGeoJson = JSON.parse(fs.readFileSync(adminGeoJsonPath, 'utf8'));

  // Verify bounding box calculation
  const sampleMun = adminGeoJson.features.find((f) => f.properties.level === 9);
  const bounds = getFeatureBounds(sampleMun);
  assert.ok(Array.isArray(bounds) && bounds.length === 2, 'getFeatureBounds must return 2 corner points');
  assert.ok(bounds[0][0] < bounds[1][0], 'minLng must be less than maxLng');
  assert.ok(bounds[0][1] < bounds[1][1], 'minLat must be less than maxLat');

  // Verify parent-child neighborhood filtering (دائرة خدمات المهاجرين has 11 neighborhoods)
  const muhajireenId = 357;
  const muhajireenMun = getMunicipalityById(adminGeoJson.features, muhajireenId);
  assert.equal(muhajireenMun.properties.name_ar, 'دائرة خدمات المهاجرين');
  const childNeighborhoods = getChildNeighborhoods(adminGeoJson.features, muhajireenId);
  assert.equal(childNeighborhoods.length, 11, 'دائرة خدمات المهاجرين must contain exactly 11 neighborhoods');

  // Verify MapViewer hierarchy layers and interaction logic
  const mapViewerPath = path.join(frontendRoot, 'src/components/MapViewer.tsx');
  const mapViewerSrc = fs.readFileSync(mapViewerPath, 'utf8');

  assert.ok(mapViewerSrc.includes('admin-municipalities-fill'), 'MapViewer must define admin-municipalities-fill layer');
  assert.ok(mapViewerSrc.includes('admin-neighborhoods-fill'), 'MapViewer must define admin-neighborhoods-fill layer');
  assert.ok(mapViewerSrc.includes('admin-neighborhoods-label'), 'MapViewer must define admin-neighborhoods-label layer');
  assert.ok(mapViewerSrc.includes('admin-neighborhoods-hit'), 'MapViewer must define admin-neighborhoods-hit layer for empty area clicks');
  assert.ok(mapViewerSrc.includes('admin-municipalities-shadow'), 'MapViewer must define admin-municipalities-shadow layer for depth');
  assert.ok(mapViewerSrc.includes('handleSelectMunicipality'), 'MapViewer must implement handleSelectMunicipality');
  assert.ok(mapViewerSrc.includes('handleSelectNeighborhood'), 'MapViewer must implement handleSelectNeighborhood');
  assert.ok(mapViewerSrc.includes('handleToggleAdminAreas'), 'MapViewer must implement handleToggleAdminAreas');
  assert.ok(mapViewerSrc.includes('DAMASCUS_BOUNDS'), 'MapViewer must define full DAMASCUS_BOUNDS');
  assert.ok(mapViewerSrc.includes('hoveredAdminArea'), 'MapViewer must support polygon hover feedback');

  // Verify sovereign Damascene high contrast styling, depth, and clean arrival without lingering polygons
  assert.ok(mapViewerSrc.includes('#064239'), 'Damascus overview must use Sovereign Emerald base fill');
  assert.ok(mapViewerSrc.includes('#c8a76a'), 'Hover must use radiant Damascene gold highlight');
  assert.ok(mapViewerSrc.includes('#dfb76c'), 'Hover outline must use illuminated gold border');
  assert.ok(mapViewerSrc.includes('translate(-50%, -100%)'), 'Hover badge must position precisely above cursor');
  assert.ok(mapViewerSrc.includes("visibility', 'none'"), 'Neighborhood arrival must turn off polygon layers to prevent lingering overlays');
  assert.ok(mapViewerSrc.includes("admin-neighborhoods-hit"), 'Neighborhoods must be clickable on empty areas');

  // Verify robust admin exit, safe layer querying, and clean toggle-off
  assert.ok(mapViewerSrc.includes('handleCloseAdminAreaCard'), 'MapViewer must implement handleCloseAdminAreaCard');
  assert.ok(mapViewerSrc.includes('onClick={handleCloseAdminAreaCard}'), 'Card close button must call handleCloseAdminAreaCard');
  assert.ok(mapViewerSrc.includes('Boolean(map.getLayer(id))'), 'POI layer query must guard against non-existent layers');
  assert.ok(mapViewerSrc.includes('useState(false)'), 'Administrative areas must be disabled by default (clean map view)');
  assert.ok(mapViewerSrc.includes('setShowAdminAreas(false)'), 'Selecting a neighborhood must automatically disable admin areas');
  assert.ok(mapViewerSrc.includes("map.setLayoutProperty('admin-neighborhoods-line', 'visibility', 'visible')"), 'Neighborhood name click must highlight area border');
  assert.ok(mapViewerSrc.includes("map.setLayoutProperty('admin-neighborhoods-line', 'visibility', 'none')"), 'Clicking map or POI must hide highlighted border');
  assert.ok(mapViewerSrc.includes("map.setLayoutProperty('admin-neighborhoods-fill', 'visibility', 'visible')"), 'Neighborhood selection must highlight whole neighborhood polygon');
  assert.ok(mapViewerSrc.includes("map.setLayoutProperty('admin-neighborhoods-fill', 'visibility', 'none')"), 'Clicking map or POI must hide highlighted neighborhood polygon');
  assert.ok(mapViewerSrc.includes("['boolean', ['feature-state', 'selected'], false]"), 'Neighborhood fill must support selected feature state');
  assert.ok(mapViewerSrc.includes('0.15'), 'Neighborhood fill opacity for selected state must be 0.15');
  assert.ok(mapViewerSrc.includes('minzoom: 12.5'), 'Neighborhood layers must have minzoom to prevent clutter when zoomed out');

  // Verify LayersPanel displays smart hierarchy status
  const layersPanelPath = path.join(frontendRoot, 'src/components/LayersPanel.tsx');
  const layersPanelSrc = fs.readFileSync(layersPanelPath, 'utf8');
  assert.ok(layersPanelSrc.includes('selectedMunicipalityName'), 'LayersPanel must support selectedMunicipalityName');
});

test('Public Transit Redesign: Zero-Clutter Route Display, Terminals & Stops', () => {
  // 1. Verify TransitDrawer component exists and has required features
  const transitDrawerPath = path.join(frontendRoot, 'src/components/TransitDrawer.tsx');
  assert.ok(fs.existsSync(transitDrawerPath), 'TransitDrawer.tsx must exist');
  const drawerSrc = fs.readFileSync(transitDrawerPath, 'utf8');
  assert.ok(drawerSrc.includes('TransitLine'), 'TransitDrawer must export TransitLine interface');
  assert.ok(drawerSrc.includes('TransitStop'), 'TransitDrawer must export TransitStop interface');
  assert.ok(drawerSrc.includes('onSelectLine'), 'TransitDrawer must support onSelectLine');
  assert.ok(drawerSrc.includes('onSelectStop'), 'TransitDrawer must support onSelectStop');
  assert.ok(drawerSrc.includes('searchQuery'), 'TransitDrawer must support search filtering');
  assert.ok(drawerSrc.includes('selectedCorridor'), 'TransitDrawer must support corridor filtering');
  assert.ok(drawerSrc.includes('counterpartLine'), 'TransitDrawer must support direction switching');

  // 2. Verify MapViewer Option A (dedicated floating pill) and Option B (zero clutter route rendering)
  const mapViewerPath = path.join(frontendRoot, 'src/components/MapViewer.tsx');
  const mapViewerSrc = fs.readFileSync(mapViewerPath, 'utf8');
  assert.ok(mapViewerSrc.includes('isTransitDrawerOpen'), 'MapViewer must manage isTransitDrawerOpen state');
  assert.ok(mapViewerSrc.includes('selectedTransitLine'), 'MapViewer must manage selectedTransitLine state');
  assert.ok(mapViewerSrc.includes('renderSelectedTransitRoute'), 'MapViewer must implement renderSelectedTransitRoute');
  assert.ok(mapViewerSrc.includes('selected-transit-line'), 'MapViewer must define selected-transit-line layer');
  assert.ok(mapViewerSrc.includes('selected-transit-casing'), 'MapViewer must define selected-transit-casing layer');
  assert.ok(mapViewerSrc.includes('start_terminal'), 'MapViewer must render start terminal marker');
  assert.ok(mapViewerSrc.includes('destination_terminal'), 'MapViewer must render destination terminal marker');
  assert.ok(mapViewerSrc.includes('المواصلات العامة'), 'MapViewer must have dedicated floating Transit button');
});

test('Damascus Governorate Official Logo: Asset existence & MapViewer top-right emblem integration', () => {
  const logoPath = path.join(frontendRoot, 'public/damascus_governorate_logo.png');
  assert.ok(fs.existsSync(logoPath), 'damascus_governorate_logo.png must exist in frontend/public');
  const stats = fs.statSync(logoPath);
  assert.ok(stats.size > 20000, `Logo file too small: ${stats.size} bytes`);

  const mapViewerPath = path.join(frontendRoot, 'src/components/MapViewer.tsx');
  const mapViewerSrc = fs.readFileSync(mapViewerPath, 'utf8');
  assert.ok(mapViewerSrc.includes('damascus_governorate_logo.png'), 'MapViewer must reference damascus_governorate_logo.png');
  assert.ok(mapViewerSrc.includes('شعار محافظة دمشق'), 'MapViewer must include accessible alt text for Damascus logo');
  assert.ok(mapViewerSrc.includes('bg-[#064239]'), 'MapViewer logo button must use primary Syrian visual identity green #064239');
});

test('Permanent Damascus Waypoints & Landmarks: Data Integrity & 3-Tier Cartographic Layer', () => {
  // 1. Check GeoJSON file existence and structure
  const geojsonPath = path.join(frontendRoot, 'public/data/damascus_permanent_landmarks.geojson');
  assert.ok(fs.existsSync(geojsonPath), 'damascus_permanent_landmarks.geojson must exist');
  const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
  assert.equal(data.type, 'FeatureCollection');
  assert.ok(data.features.length >= 40, `Expected >= 40 landmarks, got ${data.features.length}`);

  // 2. Validate landmark tiers and types
  const tier1 = data.features.filter((f) => f.properties.tier === 1);
  const tier2 = data.features.filter((f) => f.properties.tier === 2);
  const tier3 = data.features.filter((f) => f.properties.tier === 3);
  assert.ok(tier1.length >= 8, 'Tier 1 must have at least 8 macro-landmarks');
  assert.ok(tier2.length >= 20, 'Tier 2 must have at least 20 corridor hubs');
  assert.ok(tier3.length >= 5, 'Tier 3 must have at least 5 neighborhood landmarks');

  // Verify coordinates are within Damascus bounding box
  for (const f of data.features) {
    const [lon, lat] = f.geometry.coordinates;
    assert.ok(lon >= 36.15 && lon <= 36.45, `Longitude out of Damascus range: ${lon} for ${f.properties.title}`);
    assert.ok(lat >= 33.40 && lat <= 33.60, `Latitude out of Damascus range: ${lat} for ${f.properties.title}`);
    assert.ok(['square', 'monument', 'park'].includes(f.properties.type), `Invalid type: ${f.properties.type}`);
  }

  // 3. Verify landmarks-layer.ts library and MapViewer integration
  const layerLibPath = path.join(frontendRoot, 'src/lib/landmarks-layer.ts');
  assert.ok(fs.existsSync(layerLibPath), 'landmarks-layer.ts must exist');
  const libSrc = fs.readFileSync(layerLibPath, 'utf8');
  assert.ok(libSrc.includes('setupLandmarkLayers'), 'setupLandmarkLayers must be exported');
  assert.ok(libSrc.includes('landmarks-tier1-badge'), 'Tier 1 badge layer must be defined');
  assert.ok(libSrc.includes('landmarks-tier1-label'), 'Tier 1 label layer must be defined');
  assert.ok(libSrc.includes('text-halo-color'), 'Text halo casing must be present for legibility');

  const mapViewerPath = path.join(frontendRoot, 'src/components/MapViewer.tsx');
  const mapViewerSrc = fs.readFileSync(mapViewerPath, 'utf8');
  assert.ok(mapViewerSrc.includes('setupLandmarkLayers'), 'MapViewer must call setupLandmarkLayers');
  assert.ok(mapViewerSrc.includes('handleSelectLandmark'), 'MapViewer must implement handleSelectLandmark');

  // 4. Verify complete absence of old regime wording in landmarks dataset
  const rawGeoJson = fs.readFileSync(geojsonPath, 'utf8');
  for (const forbidden of ['تشرين', 'الأسد', 'الاسد', 'باسل', 'البعث', '٨ أذار', '8 آذار']) {
    assert.ok(!rawGeoJson.includes(forbidden), `Found forbidden regime wording '${forbidden}' in landmarks GeoJSON`);
  }
});

// 15. Test Category Command Bar & Sovereign Search Stack
test('Category Command Bar & Sovereign Search Stack: Dock above search bar, zero layout shift, subcategory drilldown, and default minimized layers panel', () => {
  const commandBarPath = path.join(frontendRoot, 'src/components/CategoryCommandBar.tsx');
  assert.ok(fs.existsSync(commandBarPath), 'CategoryCommandBar.tsx component must exist');
  const barSrc = fs.readFileSync(commandBarPath, 'utf8');

  // Verify fixed height container preventing cumulative layout shift (CLS = 0)
  assert.ok(barSrc.includes('h-10 sm:h-11'), 'CategoryCommandBar must have fixed h-10 sm:h-11 container');
  assert.ok(barSrc.includes('overflow-x-auto'), 'CategoryCommandBar must support smooth horizontal scrolling');
  assert.ok(barSrc.includes('whitespace-nowrap'), 'CategoryCommandBar must prevent text truncation');
  assert.ok(!barSrc.includes('places_count'), 'CategoryCommandBar must not show number of POIs');

  // Verify concise macro categories including religious
  assert.ok(barSrc.includes('healthcare'), 'CategoryCommandBar must include healthcare');
  assert.ok(barSrc.includes('education'), 'CategoryCommandBar must include education');
  assert.ok(barSrc.includes('government'), 'CategoryCommandBar must include government');
  assert.ok(barSrc.includes('religious'), 'CategoryCommandBar must include religious');
  assert.ok(barSrc.includes('tourism'), 'CategoryCommandBar must include tourism');
  assert.ok(barSrc.includes('transportation'), 'CategoryCommandBar must include transportation');

  // Verify subcategory drill-down and back button
  assert.ok(barSrc.includes('كافة الفئات'), 'CategoryCommandBar must feature back button to return to all categories');
  assert.ok(barSrc.includes('subcategories.map'), 'CategoryCommandBar must render subcategory chips when category is active');

  // Verify MapViewer header integration: CategoryCommandBar is placed above DamasceneSearchBar
  const mapViewerPath = path.join(frontendRoot, 'src/components/MapViewer.tsx');
  const mapViewerSrc = fs.readFileSync(mapViewerPath, 'utf8');
  const commandBarIdx = mapViewerSrc.indexOf('<CategoryCommandBar');
  const searchBarIdx = mapViewerSrc.indexOf('<DamasceneSearchBar');
  assert.ok(commandBarIdx !== -1, 'MapViewer must render CategoryCommandBar');
  assert.ok(searchBarIdx !== -1, 'MapViewer must render DamasceneSearchBar');
  assert.ok(commandBarIdx < searchBarIdx, 'CategoryCommandBar must be placed ABOVE DamasceneSearchBar');

  // Verify LayersPanel is minimized by default
  const layersPath = path.join(frontendRoot, 'src/components/LayersPanel.tsx');
  const layersSrc = fs.readFileSync(layersPath, 'utf8');
  assert.ok(layersSrc.includes('useState(false)'), 'LayersPanel must default isExpanded to false (minimized)');
});

// 16. Test Mobile Responsiveness, Safe Areas & Touch Architecture
test('Mobile Ergonomics: Dynamic Island safe areas, unified search row, touch isolation & zero bottom collisions', () => {
  const cssPath = path.join(frontendRoot, 'src/app/globals.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify safe area insets for notches & Dynamic Island
  assert.ok(css.includes('pt-safe'), 'globals.css must define pt-safe');
  assert.ok(css.includes('pb-safe'), 'globals.css must define pb-safe');
  assert.ok(css.includes('max(2.75rem, env(safe-area-inset-top'), 'pt-safe must reserve >= 2.75rem on mobile for Dynamic Island');

  // Verify CategoryCommandBar touch ergonomics
  const barPath = path.join(frontendRoot, 'src/components/CategoryCommandBar.tsx');
  const barSrc = fs.readFileSync(barPath, 'utf8');
  assert.ok(barSrc.includes('touch-pan-x'), 'CategoryCommandBar must have touch-pan-x to avoid dragging map canvas');
  assert.ok(barSrc.includes('overscroll-x-contain'), 'CategoryCommandBar must isolate horizontal overscroll');
  assert.ok(barSrc.includes('justify-start sm:justify-center'), 'CategoryCommandBar must align start in RTL on mobile to avoid scroll loss');

  // Verify CategoryCommandBar pinned primary actions (كافة الفئات and الكل do not scroll away)
  assert.ok(barSrc.includes('shrink-0 z-10'), 'CategoryCommandBar must pin primary actions so they do not scroll away');
  assert.ok(barSrc.includes('w-max mx-auto'), 'CategoryCommandBar Level 2 must center with w-max mx-auto to prevent lateral pivot');

  // Verify MapViewer mobile layout & bottom stack
  const mapViewerPath = path.join(frontendRoot, 'src/components/MapViewer.tsx');
  const mapViewerSrc = fs.readFileSync(mapViewerPath, 'utf8');
  assert.ok(mapViewerSrc.includes('attributionControl: false'), 'MapViewer must disable default attributionControl to prevent bottom-right button overlap');
  assert.ok(mapViewerSrc.includes('max-w-xl mx-auto flex items-center justify-center gap-2'), 'MapViewer must have unified search row with emblem and theme');
  assert.ok(mapViewerSrc.includes('sm:absolute sm:top-2.5 sm:right-6'), 'MapViewer must pin emblem to top-right on desktop');
  assert.ok(mapViewerSrc.includes('sm:absolute sm:top-2.5 sm:left-6'), 'MapViewer must pin theme menu to top-left on desktop');
  assert.ok(mapViewerSrc.includes('items-start'), 'MapViewer bottom floating stack must use items-start for RTL alignment');
});

// 17. Test Multi-Tiered Urban Search (Municipalities, Neighborhoods & Streets)
test('Multi-Tiered Urban Search: Segmented tabs, street geometry dataset, badges & zero result soup', () => {
  // 1. Verify damascus_streets.geojson data integrity
  const streetsPath = path.join(frontendRoot, 'public/data/damascus_streets.geojson');
  assert.ok(fs.existsSync(streetsPath), 'damascus_streets.geojson must exist in public/data');
  const streetsData = JSON.parse(fs.readFileSync(streetsPath, 'utf8'));
  assert.strictEqual(streetsData.type, 'FeatureCollection', 'Must be a valid GeoJSON FeatureCollection');
  assert.ok(streetsData.features.length >= 500, `Must contain >= 500 streets (found ${streetsData.features.length})`);
  
  const sampleStreet = streetsData.features[0];
  assert.ok(sampleStreet.properties.name_ar, 'Street feature must have name_ar');
  assert.ok(sampleStreet.properties.bbox, 'Street feature must have bbox for map bounds');
  assert.ok(sampleStreet.geometry, 'Street feature must have geometry');

  // 2. Verify DamasceneSearchBar architecture
  const searchBarPath = path.join(frontendRoot, 'src/components/DamasceneSearchBar.tsx');
  const searchBarSrc = fs.readFileSync(searchBarPath, 'utf8');
  assert.ok(searchBarSrc.includes('FilterTabKey'), 'DamasceneSearchBar must define filter tabs');
  assert.ok(searchBarSrc.includes('البلديات والأحياء'), 'DamasceneSearchBar must have admin tab');
  assert.ok(searchBarSrc.includes('الشوارع'), 'DamasceneSearchBar must have streets tab');
  assert.ok(searchBarSrc.includes('renderHighlightedText'), 'DamasceneSearchBar must have substring query highlighter');
  assert.ok(searchBarSrc.includes('ArrowDown'), 'DamasceneSearchBar must support keyboard navigation');

  // 3. Verify MapViewer street vector highlighting and floating card
  const mapViewerPath = path.join(frontendRoot, 'src/components/MapViewer.tsx');
  const mapViewerSrc = fs.readFileSync(mapViewerPath, 'utf8');
  assert.ok(mapViewerSrc.includes('selected-street-source'), 'MapViewer must define selected-street-source');
  assert.ok(mapViewerSrc.includes('selected-street-casing'), 'MapViewer must define glowing casing for street vector');
  assert.ok(mapViewerSrc.includes('selected-street-line'), 'MapViewer must define accent line for street vector');
  assert.ok(mapViewerSrc.includes('selectedStreet'), 'MapViewer must maintain selectedStreet state');
});
