'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ThemeKey, THEMES, applyThemeToMap } from '@/lib/map-themes';
import DamasceneSearchBar, { SearchResultItem } from './DamasceneSearchBar';
import CategoryCommandBar from './CategoryCommandBar';
import type { CategoryInfo } from './LayersPanel';
import PlaceDetailDrawer, { PlaceDetailData } from './PlaceDetailDrawer';
import { createPlacePreview } from '@/lib/place-preview';
import { watchPlaces } from '@/lib/places-refresh';
import { useDatabaseMapData } from '@/lib/database-map-style';
import UserLocationButton from './UserLocationButton';
import { PLATFORM_CATEGORIES, mergePlatformCategories } from '@/lib/platform-categories';
import RoutingPanel from './RoutingPanel';
import TransitDrawer, { TransitLine, TransitStop } from './TransitDrawer';
import { getApiBaseUrl, getAssetUrl, getAssetPath } from '@/lib/api-config';
import { getFeatureBounds, getChildNeighborhoods } from '@/lib/geo-utils';
import { setupLandmarkLayers, LandmarkSelectPayload } from '@/lib/landmarks-layer';
import { getPoiPinImageId, getSubcategoryPinIcon, registerPoiPinIcons } from '@/lib/poi-marker-icons';
import { 
  Palette, 
  ChevronDown, 
  ChevronLeft,
  Check, 
  EyeOff,
  Hospital,
  GraduationCap,
  Landmark,
  Sparkles,
  Wrench,
  Shield,
  Coins,
  Bus,
  MapPin,
  Layers,
  Route,
  X,
  Moon,
  Church,
  Box
} from 'lucide-react';

interface MapViewerProps {
  initialCenter?: [number, number];
  initialZoom?: number;
}

interface AdminAreaProperties {
  id: number;
  name_ar: string;
  name_en: string;
  code: string;
  level: number;
  level_name: string;
  parent_id?: number;
  parent_name_ar?: string;
}

// ثوابت مستقرة في الذاكرة لمنع إعادة بناء الخريطة وتفادي الوميض (Anti-Flash Architecture)
const DAMASCUS_BOUNDS: [[number, number], [number, number]] = [
  [36.175, 33.445],
  [36.370, 33.580]
];
const DEFAULT_CENTER: [number, number] = [36.273, 33.512]; // المركز الجغرافي الشامل لمحافظة دمشق
const DEFAULT_ZOOM = 11.2; // مستوى التقريب الأولي لكشف دمشق كاملة ببلدياتها الـ 16
const DAMASCUS_OVERVIEW_CENTER: [number, number] = [36.273, 33.512];
const DAMASCUS_OVERVIEW_ZOOM = 11.2;

export default function MapViewer({
  initialCenter = DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
}: MapViewerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const poiRequestRef = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTheme, setActiveTheme] = useState<ThemeKey>('governorate');
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isThreeDNoticeOpen, setIsThreeDNoticeOpen] = useState(false);
  const [mapViewMode, setMapViewMode] = useState<'2d' | '3d'>('2d');
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // 1. بيانات الطبقات والتصنيفات (المعالم مخفية افتراضياً عند الإقلاع الأول)
  const [categories, setCategories] = useState<CategoryInfo[]>(PLATFORM_CATEGORIES);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const selectedCategoriesRef = useRef<string[]>([]);
  selectedCategoriesRef.current = selectedCategories;
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const selectedSubcategoryRef = useRef<string | null>(null);
  selectedSubcategoryRef.current = selectedSubcategory;
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const selectedSectorRef = useRef<string | null>(null);
  selectedSectorRef.current = selectedSector;
  const [availableSectors, setAvailableSectors] = useState<Array<{ slug: string; label: string }>>([]);

  // 2. حالة طبقة التقسيمات الإدارية والتسلسل الهرمي الذكي (البلديات والأحياء)
  const [showAdminAreas, setShowAdminAreas] = useState(false);
  const showAdminAreasRef = useRef(showAdminAreas);
  showAdminAreasRef.current = showAdminAreas;
  const [selectedArea, setSelectedArea] = useState<AdminAreaProperties | null>(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState<AdminAreaProperties | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<AdminAreaProperties | null>(null);
  const [hoveredAdminArea, setHoveredAdminArea] = useState<{
    name_ar: string;
    level: number;
    parent_name_ar?: string;
    neighborhoods_count?: number;
    point?: { x: number; y: number };
  } | null>(null);
  const [selectedStreet, setSelectedStreet] = useState<SearchResultItem | null>(null);

  const [adminFeatures, setAdminFeatures] = useState<any[]>([]);
  const adminGeoJsonRef = useRef<any>(null);
  const hoveredMunIdRef = useRef<number | null>(null);
  const hoveredNeighIdRef = useRef<number | null>(null);
  const selectedMunIdRef = useRef<number | null>(null);
  const selectedNeighIdRef = useRef<number | null>(null);
  const maplibreglRef = useRef<any>(null);
  const handleSelectLandmarkRef = useRef<(item: LandmarkSelectPayload) => void>(() => {});

  // استخراج قائمة الأحياء التابعة للبلدية المختارة
  const childNeighborhoods = useMemo(() => {
    if (!selectedMunicipality || adminFeatures.length === 0) return [];
    return getChildNeighborhoods(adminFeatures, selectedMunicipality.id).map((f) => f.properties);
  }, [selectedMunicipality, adminFeatures]);

  // تحميل الحدود الإدارية من قاعدة البيانات عبر API للخريطة وقوائم الأحياء
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${getApiBaseUrl()}/admin-areas/`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Admin areas request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        adminGeoJsonRef.current = data;
        if (data && Array.isArray(data.features)) {
          setAdminFeatures(data.features);
          const source = mapInstanceRef.current?.getSource('admin-boundaries');
          if (source && 'setData' in source) source.setData(data);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('Failed to load admin GeoJSON:', err);
      });
    return () => controller.abort();
  }, []);

  // 3. حالة شبكة المواصلات العامة
  const [showTransitLines, setShowTransitLines] = useState(false);
  const [isTransitDrawerOpen, setIsTransitDrawerOpen] = useState(false);
  const [transitLines, setTransitLines] = useState<TransitLine[]>([]);
  const [selectedTransitLine, setSelectedTransitLine] = useState<TransitLine | null>(null);
  const transitMarkersRef = useRef<any[]>([]);

  // تحميل خطوط المواصلات العامة عند بدء التطبيق
  useEffect(() => {
    fetch(`${getApiBaseUrl()}/transit/lines/`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.results) {
          setTransitLines(data.results.flatMap((line: TransitLine & { routes: Partial<TransitLine>[] }) =>
            line.routes.filter(route => route.geometry?.coordinates?.length).map(route => ({
              ...line, ...route, name: line.name,
            }))
          ));
        }
      })
      .catch((err) => console.warn('Failed to load transit lines:', err));
  }, []);

  // 4. حالة بطاقة تفاصيل المكان (Market Card Drawer)
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetailData | null>(null);
  const selectedPlaceRef = useRef<PlaceDetailData | null>(null);
  selectedPlaceRef.current = selectedPlace;
  const placeCameraRef = useRef<any>(null);
  const focusedPlaceRef = useRef<number | null>(null);
  const closePlace = useCallback(() => {
    const camera = placeCameraRef.current;
    placeCameraRef.current = null;
    focusedPlaceRef.current = null;
    setSelectedPlace(null);
    if (camera && mapInstanceRef.current) {
      mapInstanceRef.current.stop();
      mapInstanceRef.current.flyTo({ ...camera, duration: 800 });
    }
  }, []);

  // عند اختيار معلم (POI): التقريب التلقائي عليه وإخفاء كافة المعالم الأخرى، واستعادتها عند الإغلاق
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const pinLayer = map.getLayer('places-poi-pins');
    const labelLayer = map.getLayer('places-poi-labels');

    if (selectedPlace && selectedPlace.location) {
      const lon = selectedPlace.location.longitude;
      const lat = selectedPlace.location.latitude;
      if (typeof lon === 'number' && typeof lat === 'number' && focusedPlaceRef.current !== selectedPlace.id) {
        if (!placeCameraRef.current) {
          map.stop();
          placeCameraRef.current = {
            center: map.getCenter().toArray(), zoom: map.getZoom(),
            bearing: map.getBearing(), pitch: map.getPitch(), padding: { ...map.getPadding() },
          };
        }
        focusedPlaceRef.current = selectedPlace.id;
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 640;
        map.flyTo({
          center: [lon, lat],
          zoom: 17.5,
          essential: true,
          duration: 1200,
          padding: { left: isDesktop ? 370 : Math.min(300, window.innerWidth - 64), right: 0, top: 0, bottom: 0 },
        });
      }

      // التأكد من وجود النقطة في مصدر البيانات إذا أتى المعلم من شريط البحث
      const source = map.getSource('places-poi-source');
      if (source) {
        const currentData = (source as any)._data;
        if (currentData && Array.isArray(currentData.features)) {
          const exists = currentData.features.some((f: any) => Number(f.properties?.id) === Number(selectedPlace.id));
          const subcategory = categories.find(c => c.slug === selectedPlace.category?.slug)?.subcategories
            ?.find(s => s.name_ar === selectedPlace.sub_category?.name_ar);
          const subcategoryIcon = getSubcategoryPinIcon(subcategory?.slug, selectedPlace.sub_category?.icon, selectedPlace.category?.icon);
          const pinId = getPoiPinImageId(subcategoryIcon);
          if (!exists || (selectedPlace.sub_category?.name_ar && currentData.features.some((f: any) =>
            Number(f.properties?.id) === Number(selectedPlace.id) && f.properties?.poi_pin !== pinId))) {
            const newFeature = {
              type: 'Feature',
              id: selectedPlace.id,
              geometry: {
                type: 'Point',
                coordinates: [lon, lat],
              },
              properties: {
                id: selectedPlace.id,
                title: selectedPlace.title,
                category_slug: selectedPlace.category?.slug || '',
                sub_category_icon: subcategoryIcon,
                poi_pin: pinId,
              },
            };
            void registerPoiPinIcons(map, [subcategoryIcon]).then(() => {
              if (mapInstanceRef.current !== map || selectedPlaceRef.current !== selectedPlace) return;
              const latest = (map.getSource('places-poi-source') as any)?._data;
              if (!latest) return;
              map.getSource('places-poi-source').setData({ type: 'FeatureCollection', features: [newFeature, ...latest.features.filter((feature: any) => Number(feature.properties?.id) !== Number(selectedPlace.id))] });
            }).catch(error => console.warn('Could not render place marker icon:', error));
          }
        }
      }

      // إخفاء كافة المعالم الأخرى وإبقاء المعلم المختار فقط
      const placeId = Number(selectedPlace.id);
      const filter = ['==', ['to-number', ['get', 'id']], placeId];
      if (pinLayer) map.setFilter('places-poi-pins', filter);
      if (labelLayer) map.setFilter('places-poi-labels', filter);
    } else {
      // عند إغلاق بطاقة المعلم: إعادة إظهار كافة المعالم التابعة للتصنيفات النشطة
      placeCameraRef.current = null;
      focusedPlaceRef.current = null;
      if (pinLayer) map.setFilter('places-poi-pins', null);
      if (labelLayer) map.setFilter('places-poi-labels', null);
    }
  }, [selectedPlace, categories]);

  // 5. حالة لوحة التوجيه والوصول (Multi-modal Routing - Step 5)
  const [routingDestination, setRoutingDestination] = useState<{
    lat: number;
    lon: number;
    title: string;
  } | null>(null);

  // إغلاق قائمة الهوية البصرية عند النقر خارجها
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // جلب التصنيفات وأعداد الأماكن من Django API لمرة واحدة
  useEffect(() => {
    fetch(`${getApiBaseUrl()}/categories/`)
      .then((res) => res.json())
      .then((data) => {
        if (data.results) {
          setCategories(mergePlatformCategories(data.results));
        }
      })
      .catch((err) => console.warn('Categories fetch notice:', err));
  }, []);

  // تحديث نقاط الـ POIs على الخريطة عند الطلب حصراً بدون أي وميض
  const refreshPoiLayer = useCallback(async (map: any, catSlugs: string[]) => {
    if (!map || !map.isStyleLoaded()) return;

    let source = map.getSource('places-poi-source');

    // إنشاء مصدر البيانات والطبقات لمرة واحدة فقط
    if (!source) {
      map.addSource('places-poi-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: false,
      });

      // دبابيس الأماكن بأيقونة التصنيف الفرعي
      map.addLayer({
        id: 'places-poi-pins',
        type: 'symbol',
        source: 'places-poi-source',
        layout: {
          'icon-image': ['get', 'poi_pin'],
          'icon-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11, 0.72,
            14, 0.9,
            17, 1,
          ],
          'icon-anchor': 'bottom',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-padding': 1,
        },
      });

      // تسميات الأماكن باللغة العربية
      map.addLayer({
        id: 'places-poi-labels',
        type: 'symbol',
        source: 'places-poi-source',
        minzoom: 14.0,
        layout: {
          'text-field': ['get', 'title'],
          'text-font': ['Klokantech Noto Sans Regular'],
          'text-size': 11.5,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#064239',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2.0,
        },
      });

      // حدث النقر على المنشأة أو تسميتها
      const handlePoiClick = async (e: any) => {
        if (e.originalEvent) {
          (e.originalEvent as any)._handledByLayer = true;
        }

        // إزالة إطار حدود الحي ومضلعه وبطاقته فوراً عند النقر على أي معلم POI
        if (selectedNeighIdRef.current !== null) {
          map.setFeatureState({ source: 'admin-boundaries', id: selectedNeighIdRef.current }, { selected: false });
          selectedNeighIdRef.current = null;
        }
        if (map.getLayer('admin-neighborhoods-fill')) {
          map.setLayoutProperty('admin-neighborhoods-fill', 'visibility', 'none');
        }
        if (map.getLayer('admin-neighborhoods-line')) {
          map.setLayoutProperty('admin-neighborhoods-line', 'visibility', 'none');
        }
        if (map.getLayer('admin-neighborhoods-shadow')) {
          map.setLayoutProperty('admin-neighborhoods-shadow', 'visibility', 'none');
        }

        if (e.features && e.features[0]) {
          const placeId = e.features[0].properties.id;
          const preview = createPlacePreview(e.features[0].properties, e.features[0].geometry.coordinates);
          setSelectedPlace(preview);
          setSelectedArea(null);
          setSelectedMunicipality(null);
          setSelectedNeighborhood(null);
          setRoutingDestination(null);
          try {
            const pRes = await fetch(`${getApiBaseUrl()}/places/${placeId}/`);
            if (pRes.ok) {
              const pData = await pRes.json();
              setSelectedPlace(current => current === preview ? pData : current);
            }
          } catch (err) {
            console.error('Error fetching place detail:', err);
          }
        }
      };

      map.on('click', 'places-poi-pins', handlePoiClick);
      map.on('click', 'places-poi-labels', handlePoiClick);

      map.on('mouseenter', 'places-poi-pins', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'places-poi-pins', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'places-poi-labels', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'places-poi-labels', () => {
        map.getCanvas().style.cursor = '';
      });

      source = map.getSource('places-poi-source');
    }

    // Abort older category/viewport requests so late responses never replace newer data.
    poiRequestRef.current?.abort();
    const controller = new AbortController();
    poiRequestRef.current = controller;
    const selectedId = selectedPlaceRef.current?.id;
    if (selectedId) {
      try {
        const detail = await fetch(`${getApiBaseUrl()}/places/${selectedId}/`, { signal: controller.signal, cache: 'no-store' });
        if (controller.signal.aborted) return;
        if (selectedPlaceRef.current?.id === selectedId) {
          if (detail.status === 404) closePlace();
          else if (detail.ok) {
            const updated = await detail.json();
            if (controller.signal.aborted) return;
            if (selectedPlaceRef.current?.id === selectedId && JSON.stringify(updated) !== JSON.stringify(selectedPlaceRef.current)) {
              if (updated.location.latitude !== selectedPlaceRef.current.location.latitude || updated.location.longitude !== selectedPlaceRef.current.location.longitude) focusedPlaceRef.current = null;
              setSelectedPlace(updated);
            }
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn('Place detail refresh failed:', error);
      }
    }
    // إذا لم يكن هناك أي تصنيف محدد، نفرغ المصدر بصمت دون أي وميض
    if (!catSlugs || catSlugs.length === 0) {
      if (source) {
        source.setData({ type: 'FeatureCollection', features: [] });
      }
      return;
    }

    // جلب نقاط التصنيفات المحددة فقط عند الطلب
    try {
      const bounds = map.getBounds();
      const query = new URLSearchParams({ categories: catSlugs.join(','), limit: '5000', bbox: [Math.max(-180, bounds.getWest()), Math.max(-90, bounds.getSouth()), Math.min(180, bounds.getEast()), Math.min(90, bounds.getNorth())].join(',') });
      if (selectedSubcategoryRef.current) query.set('subcategories', selectedSubcategoryRef.current);
      const res = await fetch(`${getApiBaseUrl()}/places/geojson/?${query}`, { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) return;
      const geojson = await res.json();
      if (controller.signal.aborted || mapInstanceRef.current !== map) return;
      if (source) {
        const iconNames = geojson.features.map((feature: any) => getSubcategoryPinIcon(feature.properties?.sub_category_slug, feature.properties?.sub_category_icon, feature.properties?.category_icon));
        await registerPoiPinIcons(map, iconNames);
        if (controller.signal.aborted || mapInstanceRef.current !== map) return;
        geojson.features = geojson.features.map((feature: any) => ({
          ...feature,
          properties: { ...feature.properties, poi_pin: getPoiPinImageId(getSubcategoryPinIcon(feature.properties?.sub_category_slug, feature.properties?.sub_category_icon, feature.properties?.category_icon)) },
        }));
        source.setData(geojson);
        if (selectedPlaceRef.current) {
          const filter = ['==', ['to-number', ['get', 'id']], Number(selectedPlaceRef.current.id)];
          map.setFilter('places-poi-pins', filter);
          map.setFilter('places-poi-labels', filter);
        } else if (selectedSectorRef.current) {
          const filter = ['==', ['get', 'sector'], selectedSectorRef.current];
          map.setFilter('places-poi-pins', filter);
          map.setFilter('places-poi-labels', filter);
        } else if (selectedSubcategoryRef.current) {
          const filter = ['==', ['get', 'sub_category_slug'], selectedSubcategoryRef.current];
          map.setFilter('places-poi-pins', filter);
          map.setFilter('places-poi-labels', filter);
        } else {
          map.setFilter('places-poi-pins', null);
          map.setFilter('places-poi-labels', null);
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) console.warn('Error refreshing POI layers:', e);
    }
  }, [closePlace]);

  useEffect(() => {
    const stop = watchPlaces(async () => {
      const map = mapInstanceRef.current;
      if (map?.isStyleLoaded() && (selectedCategoriesRef.current.length || selectedPlaceRef.current)) await refreshPoiLayer(map, selectedCategoriesRef.current);
    });
    return () => { stop(); poiRequestRef.current?.abort(); };
  }, [refreshPoiLayer]);

  useEffect(() => {
    if (loading) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    const moved = () => { if (selectedCategoriesRef.current.length) void refreshPoiLayer(map, selectedCategoriesRef.current); };
    map.on('moveend', moved);
    return () => map.off('moveend', moved);
  }, [loading, refreshPoiLayer]);

  // عرض مسار الخط المختار حصراً ومحطاته بدقة (Option B - Zero Clutter)
  const renderSelectedTransitRoute = useCallback((map: any, line: TransitLine | null) => {
    if (!map || !map.isStyleLoaded()) return;

    transitMarkersRef.current.forEach((m) => m.remove());
    transitMarkersRef.current = [];

    const maplibregl = maplibreglRef.current;

    if (!line) {
      ['selected-transit-line', 'selected-transit-return', 'selected-transit-casing', 'selected-transit-shadow'].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
      });
      return;
    }

    const counterpart = transitLines.find(item => item.id === line.id && item.direction !== line.direction);
    const displayedRoutes = counterpart ? [line, counterpart] : [line];
    const geojsonData = {
      type: 'FeatureCollection',
      features: displayedRoutes.map(item => ({
        type: 'Feature', geometry: item.geometry,
        properties: { color: item.color, code: item.code, name: item.name, selected: item.route_id === line.route_id },
      })),
    };

    if (map.getSource('selected-transit-source')) {
      map.getSource('selected-transit-source').setData(geojsonData);
    } else {
      map.addSource('selected-transit-source', { type: 'geojson', data: geojsonData });
      map.addLayer({
        id: 'selected-transit-shadow',
        type: 'line',
        source: 'selected-transit-source',
        paint: { 'line-color': '#032d27', 'line-width': 12.0, 'line-opacity': 0.35, 'line-blur': 3.5 },
      });
      map.addLayer({
        id: 'selected-transit-casing',
        type: 'line',
        source: 'selected-transit-source',
        paint: { 'line-color': '#ffffff', 'line-width': 8.5, 'line-opacity': 0.98 },
      });
      map.addLayer({
        id: 'selected-transit-line',
        type: 'line',
        source: 'selected-transit-source',
        filter: ['==', ['get', 'selected'], true],
        paint: { 'line-color': ['get', 'color'], 'line-width': 5.5, 'line-opacity': 1.0 },
      });
      map.addLayer({
        id: 'selected-transit-return', type: 'line', source: 'selected-transit-source',
        filter: ['==', ['get', 'selected'], false],
        paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.8, 'line-dasharray': [2, 2] },
      });
    }

    ['selected-transit-shadow', 'selected-transit-casing', 'selected-transit-line', 'selected-transit-return'].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
    });
    map.setPaintProperty('selected-transit-line', 'line-color', line.color);

    if (maplibregl) {
      const startEl = document.createElement('div');
      startEl.className = 'pointer-events-auto cursor-pointer';
      startEl.innerHTML = `<div class="transition-transform duration-200 hover:scale-110" style="display:flex;flex-direction:column;align-items:center;"><div style="background-color:#10b981;color:#fff;border:2px solid #fff;box-shadow:0 8px 25px rgba(0,0,0,0.4);border-radius:9999px;padding:4px 10px;font-size:11px;font-weight:900;display:flex;align-items:center;gap:6px;white-space:nowrap;direction:rtl;"><span style="width:8px;height:8px;border-radius:50%;background-color:#fff;display:inline-block;"></span><span>انطلاق: ${line.start_terminal.name.split('/')[0]}</span></div><div style="width:2px;height:6px;background-color:#10b981;"></div><div style="width:12px;height:12px;border-radius:50%;background-color:#10b981;border:2.5px solid #fff;box-shadow:0 0 10px #10b981;"></div></div>`;
      transitMarkersRef.current.push(new maplibregl.Marker({ element: startEl, anchor: 'bottom' }).setLngLat(line.start_terminal.coordinates).addTo(map));

      const destEl = document.createElement('div');
      destEl.className = 'pointer-events-auto cursor-pointer';
      destEl.innerHTML = `<div class="transition-transform duration-200 hover:scale-110" style="display:flex;flex-direction:column;align-items:center;"><div style="background-color:#ea580c;color:#fff;border:2px solid #fff;box-shadow:0 8px 25px rgba(0,0,0,0.4);border-radius:9999px;padding:4px 10px;font-size:11px;font-weight:900;display:flex;align-items:center;gap:6px;white-space:nowrap;direction:rtl;"><span>🏁</span><span>وصول: ${line.destination_terminal.name.split('/')[0]}</span></div><div style="width:2px;height:6px;background-color:#ea580c;"></div><div style="width:12px;height:12px;border-radius:50%;background-color:#ea580c;border:2.5px solid #fff;box-shadow:0 0 10px #ea580c;"></div></div>`;
      transitMarkersRef.current.push(new maplibregl.Marker({ element: destEl, anchor: 'bottom' }).setLngLat(line.destination_terminal.coordinates).addTo(map));

      line.stops.forEach((stop, idx) => {
        if (idx === 0 || idx === line.stops.length - 1) return;
        const stopEl = document.createElement('div');
        stopEl.className = 'pointer-events-auto cursor-pointer';
        stopEl.title = `موقف ${idx + 1}: ${stop.name}`;
        stopEl.innerHTML = `<div class="transition-transform duration-150 hover:scale-125" style="width:24px;height:24px;border-radius:50%;background-color:#fff;color:#18181b;border:3px solid ${line.color};box-shadow:0 3px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;font-family:monospace;transform-origin:center center;">${idx + 1}</div>`;
        stopEl.addEventListener('click', (e) => { e.stopPropagation(); map.flyTo({ center: stop.coordinates, zoom: 16, duration: 600 }); });
        transitMarkersRef.current.push(new maplibregl.Marker({ element: stopEl, anchor: 'center' }).setLngLat(stop.coordinates).addTo(map));
      });

      if (line.geometry?.coordinates?.length) {
        const bounds = new maplibregl.LngLatBounds();
        displayedRoutes.forEach(item => item.geometry.coordinates.forEach((pt: [number, number]) => bounds.extend(pt)));
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
        map.fitBounds(bounds, { padding: isMobile ? { top: 90, bottom: 280, left: 30, right: 30 } : { top: 90, bottom: 90, left: 400, right: 90 }, maxZoom: 15.5, duration: 1000 });
      }
    }
  }, [transitLines]);

  const handleSelectTransitStop = useCallback((stop: TransitStop) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo({ center: stop.coordinates, zoom: 16, duration: 800, essential: true });
  }, []);

  // اختيار بلدية معينة (Level 9): عزل حدودها، إظهار أحيائها التابعة، والتقريب الذكي عليها
  const handleSelectMunicipality = useCallback((props: AdminAreaProperties, feature?: any) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setShowAdminAreas(true);

    if (selectedMunIdRef.current !== null && selectedMunIdRef.current !== props.id) {
      map.setFeatureState({ source: 'admin-boundaries', id: selectedMunIdRef.current }, { selected: false });
    }
    if (selectedNeighIdRef.current !== null) {
      map.setFeatureState({ source: 'admin-boundaries', id: selectedNeighIdRef.current }, { selected: false });
      selectedNeighIdRef.current = null;
    }

    selectedMunIdRef.current = props.id;
    map.setFeatureState({ source: 'admin-boundaries', id: props.id }, { selected: true });

    setSelectedMunicipality(props);
    setSelectedNeighborhood(null);
    setSelectedArea(props);
    setSelectedPlace(null);
    setRoutingDestination(null);

    const feat = feature || (adminGeoJsonRef.current?.features?.find((f: any) => Number(f.properties?.id) === Number(props.id)));
    if (feat) {
      const bounds = getFeatureBounds(feat);
      if (bounds) {
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 640;
        map.fitBounds(bounds, {
          padding: isDesktop
            ? { top: 90, bottom: 90, left: 360, right: 90 }
            : { top: 80, bottom: 180, left: 24, right: 24 },
          duration: 1200,
          maxZoom: 15.5,
        });
      }
    }

    if (map.getLayer('admin-municipalities-fill')) {
      if (map.getLayer('admin-municipalities-shadow')) map.setFilter('admin-municipalities-shadow', ['==', ['get', 'id'], props.id]);
      map.setFilter('admin-municipalities-fill', ['==', ['get', 'id'], props.id]);
      map.setFilter('admin-municipalities-line', ['==', ['get', 'id'], props.id]);
      if (map.getLayer('admin-municipalities-label')) map.setLayoutProperty('admin-municipalities-label', 'visibility', 'none');
    }
    if (map.getLayer('admin-neighborhoods-fill')) {
      const neighFilter = ['all', ['==', ['get', 'level'], 10], ['==', ['get', 'parent_id'], props.id]];
      ['admin-neighborhoods-shadow', 'admin-neighborhoods-fill', 'admin-neighborhoods-line', 'admin-neighborhoods-label'].forEach((id) => {
        if (map.getLayer(id)) {
          map.setFilter(id, neighFilter);
          map.setLayoutProperty(id, 'visibility', 'visible');
        }
      });
    }
  }, []);

  // اختيار حي سكني معين (Level 10): تقريب الخريطة عليه وإخفاء المضلعات لتفادي حجب الرؤية مع الإبقاء على الأسماء وطبقة النقر
  const handleSelectNeighborhood = useCallback((props: AdminAreaProperties, feature?: any) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // عند النقر على أي حي: تعطيل طبقة التقسيمات الإدارية تلقائياً لمنع حجب الرؤية والتركيز على الحي
    if (showAdminAreasRef.current) {
      setShowAdminAreas(false);
    }

    if (selectedNeighIdRef.current !== null && selectedNeighIdRef.current !== props.id) {
      map.setFeatureState({ source: 'admin-boundaries', id: selectedNeighIdRef.current }, { selected: false });
    }
    selectedNeighIdRef.current = props.id;
    map.setFeatureState({ source: 'admin-boundaries', id: props.id }, { selected: true });

    // تعيين البلدية الحاضنة تلقائياً عند النقر المباشر على أي حي
    const parentId = props.parent_id;
    if (parentId) {
      const parentMun = adminFeatures.find((f) => Number(f.properties?.id) === Number(parentId))
        || adminGeoJsonRef.current?.features?.find((f: any) => Number(f.properties?.id) === Number(parentId));
      if (parentMun) {
        setSelectedMunicipality(parentMun.properties);
        selectedMunIdRef.current = parentMun.properties.id;
      }
    }

    setSelectedNeighborhood(props);
    setSelectedArea(props);
    setSelectedPlace(null);
    setRoutingDestination(null);

    // إبراز كامل مضلع الحي المختار بصبغة لونية راقية متناسقة مع الهوية وإطار حدود ذهبي واضح
    const neighId = Number(props.id);
    if (map.getLayer('admin-neighborhoods-fill')) {
      map.setLayoutProperty('admin-neighborhoods-fill', 'visibility', 'visible');
      map.setFilter('admin-neighborhoods-fill', ['==', ['to-number', ['get', 'id']], neighId]);
    }
    if (map.getLayer('admin-neighborhoods-line')) {
      map.setLayoutProperty('admin-neighborhoods-line', 'visibility', 'visible');
      map.setFilter('admin-neighborhoods-line', ['==', ['to-number', ['get', 'id']], neighId]);
    }
    if (map.getLayer('admin-neighborhoods-shadow')) {
      map.setLayoutProperty('admin-neighborhoods-shadow', 'visibility', 'visible');
      map.setFilter('admin-neighborhoods-shadow', ['==', ['to-number', ['get', 'id']], neighId]);
    }

    // إخفاء مضلعات البلديات وطبقة النقر لكامل المساحة
    const polygonVisualLayers = [
      'admin-municipalities-shadow',
      'admin-municipalities-fill',
      'admin-municipalities-line',
      'admin-municipalities-label',
      'admin-neighborhoods-hit',
    ];
    polygonVisualLayers.forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
    });

    if (map.getLayer('admin-neighborhoods-label')) {
      map.setLayoutProperty('admin-neighborhoods-label', 'visibility', 'visible');
      map.setFilter('admin-neighborhoods-label', ['==', ['get', 'level'], 10]);
    }

    const feat = feature || (adminGeoJsonRef.current?.features?.find((f: any) => Number(f.properties?.id) === Number(props.id)));
    if (feat) {
      const bounds = getFeatureBounds(feat);
      if (bounds) {
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 640;
        map.fitBounds(bounds, {
          padding: isDesktop
            ? { top: 90, bottom: 90, left: 360, right: 90 }
            : { top: 80, bottom: 180, left: 24, right: 24 },
          duration: 1000,
          maxZoom: 17,
        });
      }
    }
  }, [adminFeatures]);

  // العودة من استعراض حي إلى استعراض البلدية الحاضنة مع إعادة إظهار مضلعاتها
  const handleResetToMunicipality = useCallback(() => {
    if (!selectedMunicipality) return;
    const map = mapInstanceRef.current;
    if (map && selectedNeighIdRef.current !== null) {
      map.setFeatureState({ source: 'admin-boundaries', id: selectedNeighIdRef.current }, { selected: false });
      selectedNeighIdRef.current = null;
    }

    setShowAdminAreas(true);
    setSelectedNeighborhood(null);
    setSelectedArea(selectedMunicipality);

    if (map) {
      // إعادة إظهار مضلع البلدية وأحيائها التابعة
      ['admin-municipalities-shadow', 'admin-municipalities-fill', 'admin-municipalities-line'].forEach((id) => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', 'visible');
          map.setFilter(id, ['==', ['get', 'id'], selectedMunicipality.id]);
        }
      });
      if (map.getLayer('admin-municipalities-label')) {
        map.setLayoutProperty('admin-municipalities-label', 'visibility', 'none');
      }

      const neighFilter = ['all', ['==', ['get', 'level'], 10], ['==', ['get', 'parent_id'], selectedMunicipality.id]];
      ['admin-neighborhoods-shadow', 'admin-neighborhoods-fill', 'admin-neighborhoods-line'].forEach((id) => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', 'visible');
          map.setFilter(id, neighFilter);
        }
      });
      if (map.getLayer('admin-neighborhoods-label')) {
        map.setLayoutProperty('admin-neighborhoods-label', 'visibility', 'visible');
        map.setFilter('admin-neighborhoods-label', ['==', ['get', 'level'], 10]);
      }
      if (map.getLayer('admin-neighborhoods-hit')) {
        map.setLayoutProperty('admin-neighborhoods-hit', 'visibility', 'visible');
        map.setFilter('admin-neighborhoods-hit', ['==', ['get', 'level'], 10]);
      }

      const feat = adminGeoJsonRef.current?.features?.find((f: any) => Number(f.properties?.id) === Number(selectedMunicipality.id));
      if (feat) {
        const bounds = getFeatureBounds(feat);
        if (bounds) {
          const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 640;
          map.fitBounds(bounds, {
            padding: isDesktop
              ? { top: 90, bottom: 90, left: 360, right: 90 }
              : { top: 80, bottom: 180, left: 24, right: 24 },
            duration: 1000,
            maxZoom: 15.5,
          });
        }
      }
    }
  }, [selectedMunicipality]);

  // العودة لعرض كافة بلديات دمشق الـ 16 وإخفاء مضلعات الأحياء مع ملاءمة كامل حدود دمشق
  const handleResetToAllMunicipalities = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map) {
      if (selectedMunIdRef.current !== null) {
        map.setFeatureState({ source: 'admin-boundaries', id: selectedMunIdRef.current }, { selected: false });
        selectedMunIdRef.current = null;
      }
      if (selectedNeighIdRef.current !== null) {
        map.setFeatureState({ source: 'admin-boundaries', id: selectedNeighIdRef.current }, { selected: false });
        selectedNeighIdRef.current = null;
      }

      const munLayers = ['admin-municipalities-shadow', 'admin-municipalities-fill', 'admin-municipalities-line', 'admin-municipalities-label'];
      const neighAllLayers = [
        'admin-neighborhoods-shadow', 'admin-neighborhoods-fill', 'admin-neighborhoods-line',
        'admin-neighborhoods-label', 'admin-neighborhoods-hit'
      ];

      munLayers.forEach((id) => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', 'visible');
          map.setFilter(id, ['==', ['get', 'level'], 9]);
        }
      });
      neighAllLayers.forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
      });

      map.fitBounds(DAMASCUS_BOUNDS, {
        padding: { top: 60, bottom: 60, left: 60, right: 60 },
        duration: 1200,
        maxZoom: 11.6,
      });
    }

    setSelectedMunicipality(null);
    setSelectedNeighborhood(null);
    setSelectedArea(null);
  }, []);

  // إغلاق بطاقة المنطقة الإدارية المختارة
  const handleCloseAdminAreaCard = useCallback(() => {
    setSelectedMunicipality(null);
    setSelectedNeighborhood(null);
    setSelectedArea(null);
    setHoveredAdminArea(null);

    const map = mapInstanceRef.current;
    if (map) {
      if (selectedMunIdRef.current !== null) {
        map.setFeatureState({ source: 'admin-boundaries', id: selectedMunIdRef.current }, { selected: false });
        selectedMunIdRef.current = null;
      }
      if (selectedNeighIdRef.current !== null) {
        map.setFeatureState({ source: 'admin-boundaries', id: selectedNeighIdRef.current }, { selected: false });
        selectedNeighIdRef.current = null;
      }
      if (hoveredMunIdRef.current !== null) {
        map.setFeatureState({ source: 'admin-boundaries', id: hoveredMunIdRef.current }, { hover: false });
        hoveredMunIdRef.current = null;
      }
      if (hoveredNeighIdRef.current !== null) {
        map.setFeatureState({ source: 'admin-boundaries', id: hoveredNeighIdRef.current }, { hover: false });
        hoveredNeighIdRef.current = null;
      }
      map.getCanvas().style.cursor = '';

      // إخفاء إطار حدود الحي المختار والصبغة اللونية فوراً
      if (map.getLayer('admin-neighborhoods-fill')) {
        map.setLayoutProperty('admin-neighborhoods-fill', 'visibility', 'none');
      }
      if (map.getLayer('admin-neighborhoods-line')) {
        map.setLayoutProperty('admin-neighborhoods-line', 'visibility', 'none');
      }
      if (map.getLayer('admin-neighborhoods-shadow')) {
        map.setLayoutProperty('admin-neighborhoods-shadow', 'visibility', 'none');
      }

      // إبقاء أسماء الأحياء ظاهرة على الخريطة
      if (map.getLayer('admin-neighborhoods-label')) {
        map.setLayoutProperty('admin-neighborhoods-label', 'visibility', 'visible');
        map.setFilter('admin-neighborhoods-label', ['==', ['get', 'level'], 10]);
      }

      // إذا كانت التقسيمات الإدارية مفعّلة، نعيد إظهار بلديات دمشق الـ 16
      if (showAdminAreasRef.current) {
        const munLayers = ['admin-municipalities-shadow', 'admin-municipalities-fill', 'admin-municipalities-line', 'admin-municipalities-label'];
        const neighVisualLayers = ['admin-neighborhoods-shadow', 'admin-neighborhoods-fill', 'admin-neighborhoods-line'];

        munLayers.forEach((id) => {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, 'visibility', 'visible');
            map.setFilter(id, ['==', ['get', 'level'], 9]);
          }
        });
        neighVisualLayers.forEach((id) => {
          if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
        });
      }
    }
  }, []);

  // تفعيل/إلغاء تفعيل التقسيمات الإدارية: عند النقر، التراجع للخلف لكامل دمشق وإبرازها بالكامل أو إخفائها فوراً
  const handleToggleAdminAreas = useCallback(() => {
    const nextState = !showAdminAreas;
    setShowAdminAreas(nextState);

    const map = mapInstanceRef.current;
    if (map) {
      if (selectedMunIdRef.current !== null) {
        map.setFeatureState({ source: 'admin-boundaries', id: selectedMunIdRef.current }, { selected: false });
        selectedMunIdRef.current = null;
      }
      if (selectedNeighIdRef.current !== null) {
        map.setFeatureState({ source: 'admin-boundaries', id: selectedNeighIdRef.current }, { selected: false });
        selectedNeighIdRef.current = null;
      }
      if (hoveredMunIdRef.current !== null) {
        map.setFeatureState({ source: 'admin-boundaries', id: hoveredMunIdRef.current }, { hover: false });
        hoveredMunIdRef.current = null;
      }
      if (hoveredNeighIdRef.current !== null) {
        map.setFeatureState({ source: 'admin-boundaries', id: hoveredNeighIdRef.current }, { hover: false });
        hoveredNeighIdRef.current = null;
      }
      map.getCanvas().style.cursor = '';
    }

    setSelectedMunicipality(null);
    setSelectedNeighborhood(null);
    setSelectedArea(null);
    setHoveredAdminArea(null);

    if (nextState) {
      if (map) {
        map.fitBounds(DAMASCUS_BOUNDS, {
          padding: { top: 60, bottom: 60, left: 60, right: 60 },
          duration: 1200,
          maxZoom: 11.6,
        });

        const munLayers = ['admin-municipalities-shadow', 'admin-municipalities-fill', 'admin-municipalities-line', 'admin-municipalities-label'];
        const neighAllLayers = [
          'admin-neighborhoods-shadow', 'admin-neighborhoods-fill', 'admin-neighborhoods-line',
          'admin-neighborhoods-label', 'admin-neighborhoods-hit'
        ];

        munLayers.forEach((id) => {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, 'visibility', 'visible');
            map.setFilter(id, ['==', ['get', 'level'], 9]);
          }
        });
        neighAllLayers.forEach((id) => {
          if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
        });
      }
    } else {
      if (map) {
        const macroAdminLayers = [
          'admin-municipalities-shadow', 'admin-municipalities-fill', 'admin-municipalities-line', 'admin-municipalities-label',
          'admin-neighborhoods-shadow', 'admin-neighborhoods-fill', 'admin-neighborhoods-line',
        ];
        macroAdminLayers.forEach((id) => {
          if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
        });

        // إبقاء أسماء الأحياء وطبقة النقر ظاهرة دائماً حتى لو عُطّلت التقسيمات
        ['admin-neighborhoods-label', 'admin-neighborhoods-hit'].forEach((id) => {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, 'visibility', 'visible');
            map.setFilter(id, ['==', ['get', 'level'], 10]);
          }
        });
      }
    }
  }, [showAdminAreas]);

  // إعداد وتشغيل الخريطة المتجهة لمرة واحدة فقط عند التركيب (Strictly Once on Mount)
  useEffect(() => {
    let isMounted = true;
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    import('maplibre-gl').then(async (maplibregl) => {
      if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return;
      maplibreglRef.current = maplibregl;

      // معالج الخريطة بالخلفية
      if (typeof maplibregl.setWorkerUrl === 'function') {
        maplibregl.setWorkerUrl(getAssetUrl('/maplibre-gl-worker.mjs'));
      }

      // تشكيل الخط العربي
      if (
        typeof maplibregl.setRTLTextPlugin === 'function' &&
        typeof maplibregl.getRTLTextPluginStatus === 'function'
      ) {
        if (maplibregl.getRTLTextPluginStatus() === 'unavailable') {
          try {
            await maplibregl.setRTLTextPlugin(
              getAssetUrl('/mapbox-gl-rtl-text.min.js'),
              false
            );
          } catch (e) {
            console.warn('RTL plugin notice:', e);
          }
        }
      }

      try {
        const res = await fetch(getAssetUrl('/damascus-clean-style.json?v=2'));
        const style = useDatabaseMapData(await res.json(), getApiBaseUrl());

        if (style.sources.openmaptiles?.type === 'vector') {
          style.sources.openmaptiles.tiles = [
            getAssetUrl('/vector-tiles/{z}/{x}/{y}.pbf'),
          ];
        }
        style.glyphs = `${getApiBaseUrl()}/fonts/{fontstack}/{range}.pbf?v=2`;
        style.sprite = getAssetUrl('/sprites/ofm');

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: style,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: 10,
          maxZoom: 20.0,
          attributionControl: false,
          maxBounds: [
            [36.10, 33.35],
            [36.48, 33.65],
          ],
        });

        // أدوات التحكم بالخريطة في الزاوية السفلية اليسارية لتفادي تداخلها مع لوحة الطبقات في اليمين
        map.addControl(
          new maplibregl.NavigationControl({ visualizePitch: true }),
          'bottom-left'
        );
        map.addControl(
          new maplibregl.ScaleControl({ unit: 'metric' }),
          'bottom-left'
        );
        map.addControl(
          new maplibregl.AttributionControl({ compact: true }),
          'bottom-left'
        );

        // إعداد طبقات التقسيمات الإدارية الذكية (التسلسل الهرمي: بلديات ثم أحياء)
        const setupAdminLayers = () => {
          if (map.getSource('admin-boundaries')) return;

          map.addSource('admin-boundaries', {
            type: 'geojson',
            data: adminGeoJsonRef.current || { type: 'FeatureCollection', features: [] },
            promoteId: 'id',
          });

          // 1. طبقة الظل العميق لحدود البلديات (Level 9 Drop Shadow) لرفع الخريطة وإعطائها عمقاً وتمايزاً
          map.addLayer({
            id: 'admin-municipalities-shadow',
            type: 'line',
            source: 'admin-boundaries',
            filter: ['==', ['get', 'level'], 9],
            layout: {
              visibility: 'none',
            },
            paint: {
              'line-color': '#032d27',
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                8.0,
                5.0
              ],
              'line-blur': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                5.0,
                3.5
              ],
              'line-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                0.40,
                0.28
              ],
            },
          });

          // 2. ملء البلديات (Level 9) - تظليل دمشق باللون الأخضر السيادي وتحويم ذهبي متوهج عالي التباين
          map.addLayer({
            id: 'admin-municipalities-fill',
            type: 'fill',
            source: 'admin-boundaries',
            filter: ['==', ['get', 'level'], 9],
            layout: {
              visibility: 'none',
            },
            paint: {
              'fill-color': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                '#c8a76a', // اللون الذهبي المتوهج عالي التباين عند التحويم المتناسق مع الهوية
                '#064239'  // اللون الأساسي السيادي لكامل دمشق
              ],
              'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                0.28, // شفافية ذهبية واضحة وبارزة جداً تعطي تبايناً جذاباً وفورياً
                ['boolean', ['feature-state', 'selected'], false],
                0.14,
                0.11 // شفافية خضراء سيادية راقية تبرز دمشق بالكامل دون حجب معالم الشوارع
              ],
            },
          });

          // 3. حدود البلديات (Level 9)
          map.addLayer({
            id: 'admin-municipalities-line',
            type: 'line',
            source: 'admin-boundaries',
            filter: ['==', ['get', 'level'], 9],
            layout: {
              visibility: 'none',
            },
            paint: {
              'line-color': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                '#dfb76c', // إطار ذهبي مشرق متوهج عند التحويم
                ['boolean', ['feature-state', 'selected'], false],
                '#c8a76a',
                '#064239'  // اللون الأساسي السيادي لإطار البلديات
              ],
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                3.5, // سماكة واضحة تبرز البلدية المختارة
                ['boolean', ['feature-state', 'selected'], false],
                2.8,
                2.0
              ],
              'line-opacity': 0.88,
            },
          });

          // 3. أسماء البلديات (Level 9)
          map.addLayer({
            id: 'admin-municipalities-label',
            type: 'symbol',
            source: 'admin-boundaries',
            filter: ['==', ['get', 'level'], 9],
            maxzoom: 14.5,
            layout: {
              visibility: 'none',
              'text-field': ['get', 'name_ar'],
              'text-font': ['Klokantech Noto Sans Regular'],
              'text-size': [
                'interpolate', ['linear'], ['zoom'],
                11, 11.5,
                14, 14.5
              ],
              'text-allow-overlap': false,
            },
            paint: {
              'text-color': '#064239',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2.0,
            },
          });

          // 4. ظل حدود الأحياء (Level 10 Drop Shadow)
          map.addLayer({
            id: 'admin-neighborhoods-shadow',
            type: 'line',
            source: 'admin-boundaries',
            filter: ['==', ['get', 'id'], -1],
            layout: {
              visibility: 'none',
            },
            paint: {
              'line-color': '#032d27',
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                6.0,
                4.0
              ],
              'line-blur': 3.0,
              'line-opacity': 0.25,
            },
          });

          // 5. ملء الأحياء (Level 10) - تظهر فقط عند اختيار بلدية
          map.addLayer({
            id: 'admin-neighborhoods-fill',
            type: 'fill',
            source: 'admin-boundaries',
            filter: ['==', ['get', 'id'], -1],
            layout: {
              visibility: 'none',
            },
            paint: {
              'fill-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                '#c8a76a', // صبغة ذهبية دمشقية متناسقة للمنطقة المختارة
                ['boolean', ['feature-state', 'hover'], false],
                '#c8a76a', // تحويم ذهبي مشرق
                '#064239'  // أخضر سيادي متناسق
              ],
              'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                0.15, // صبغة متناسقة وأنيقة تبرز كامل مضلع الحي بوضوح تام دون حجب الشوارع
                ['boolean', ['feature-state', 'hover'], false],
                0.28,
                0.10
              ],
            },
          });

          // 6. حدود الأحياء (Level 10)
          map.addLayer({
            id: 'admin-neighborhoods-line',
            type: 'line',
            source: 'admin-boundaries',
            filter: ['==', ['get', 'id'], -1],
            layout: {
              visibility: 'none',
            },
            paint: {
              'line-color': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                '#dfb76c', // إطار ذهبي مضيء
                '#064239'  // إطار أخضر سيادي متناسق
              ],
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                3.0,
                1.6
              ],
              'line-dasharray': [2, 1],
              'line-opacity': 0.88,
            },
          });

          // 7. طبقة الاستشعار التفاعلية لكافة الأحياء (Clickable Hit Area) لضمان إمكانية النقر في أي مساحة فارغة
          map.addLayer({
            id: 'admin-neighborhoods-hit',
            type: 'fill',
            source: 'admin-boundaries',
            minzoom: 12.5,
            filter: ['==', ['get', 'level'], 10],
            layout: {
              visibility: 'none',
            },
            paint: {
              'fill-color': '#000000',
              'fill-opacity': 0.0001, // شفاف للعين ومستجيب 100% لنقرات الفأرة في أي مساحة فارغة من الحي
            },
          });

          // 8. أسماء الأحياء (Level 10) - تظهر بشكل طبيعي عند التقريب لمنع الازدحام عند التراجع
          map.addLayer({
            id: 'admin-neighborhoods-label',
            type: 'symbol',
            source: 'admin-boundaries',
            minzoom: 12.0,
            filter: ['==', ['get', 'level'], 10],
            layout: {
              visibility: 'visible',
              'text-field': ['get', 'name_ar'],
              'text-font': ['Klokantech Noto Sans Regular'],
              'text-size': [
                'interpolate', ['linear'], ['zoom'],
                12.0, 11,
                14, 12.5,
                16, 14.5
              ],
              'text-allow-overlap': false,
              'text-padding': 4,
            },
            paint: {
              'text-color': '#064239',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2.2,
              'text-halo-blur': 0.5,
            },
          });

          // أحداث التفاعل مع البلديات (Hover & Click)
          map.on('mousemove', 'admin-municipalities-fill', (e) => {
            if (!showAdminAreasRef.current) return;
            if (e.features && e.features[0]) {
              const feat = e.features[0];
              const id = Number(feat.id);
              if (hoveredMunIdRef.current !== null && hoveredMunIdRef.current !== id) {
                map.setFeatureState({ source: 'admin-boundaries', id: hoveredMunIdRef.current }, { hover: false });
              }
              hoveredMunIdRef.current = id;
              map.setFeatureState({ source: 'admin-boundaries', id }, { hover: true });
              map.getCanvas().style.cursor = 'pointer';

              const p = feat.properties as AdminAreaProperties;
              const childCount = adminGeoJsonRef.current 
                ? adminGeoJsonRef.current.features.filter((f: any) => Number(f.properties?.level) === 10 && Number(f.properties?.parent_id) === id).length 
                : undefined;
              setHoveredAdminArea({
                name_ar: p.name_ar,
                level: 9,
                neighborhoods_count: childCount,
                point: { x: e.point.x, y: e.point.y },
              });
            }
          });

          map.on('mouseleave', 'admin-municipalities-fill', () => {
            if (hoveredMunIdRef.current !== null) {
              map.setFeatureState({ source: 'admin-boundaries', id: hoveredMunIdRef.current }, { hover: false });
              hoveredMunIdRef.current = null;
            }
            map.getCanvas().style.cursor = '';
            setHoveredAdminArea(null);
          });

          map.on('click', 'admin-municipalities-fill', (e) => {
            if (!showAdminAreasRef.current) return;
            setHoveredAdminArea(null);
            if (e.features && e.features[0]) {
              const feat = e.features[0];
              const props = feat.properties as AdminAreaProperties;
              handleSelectMunicipality(props, feat);
            }
          });

          // أحداث التفاعل والنقر على الأحياء
          const handleNeighClick = (e: any) => {
            if (e.originalEvent) {
              (e.originalEvent as any)._handledByLayer = true;
            }

            const poiLayers = ['places-poi-pins', 'places-poi-labels'].filter((id) => Boolean(map.getLayer(id)));
            const poiHits = poiLayers.length > 0 ? map.queryRenderedFeatures(e.point, { layers: poiLayers }) : [];
            if (poiHits && poiHits.length > 0) return;

            setHoveredAdminArea(null);
            if (e.features && e.features[0]) {
              const feat = e.features[0];
              const props = feat.properties as AdminAreaProperties;
              handleSelectNeighborhood(props, feat);
            }
          };

          const handleNeighMove = (e: any) => {
            if (e.features && e.features[0]) {
              const isLabel = e.features[0].layer?.id === 'admin-neighborhoods-label';
              if (showAdminAreasRef.current || isLabel) {
                map.getCanvas().style.cursor = 'pointer';
              }

              // إظهار شارة وتأثير تحويم الحي فقط عند تفعيل طبقة التقسيمات الإدارية لتفادي التشويش
              if (showAdminAreasRef.current) {
                const feat = e.features[0];
                const id = Number(feat.id);
                if (hoveredNeighIdRef.current !== null && hoveredNeighIdRef.current !== id) {
                  map.setFeatureState({ source: 'admin-boundaries', id: hoveredNeighIdRef.current }, { hover: false });
                }
                hoveredNeighIdRef.current = id;
                map.setFeatureState({ source: 'admin-boundaries', id }, { hover: true });

                const p = feat.properties as AdminAreaProperties;
                setHoveredAdminArea({
                  name_ar: p.name_ar,
                  level: 10,
                  parent_name_ar: p.parent_name_ar,
                  point: { x: e.point.x, y: e.point.y },
                });
              }
            }
          };

          const handleNeighLeave = () => {
            if (hoveredNeighIdRef.current !== null) {
              map.setFeatureState({ source: 'admin-boundaries', id: hoveredNeighIdRef.current }, { hover: false });
              hoveredNeighIdRef.current = null;
            }
            map.getCanvas().style.cursor = '';
            setHoveredAdminArea(null);
          };

          // تسجيل النقر على اسم الحي
          map.on('click', 'admin-neighborhoods-label', handleNeighClick);
          map.on('mousemove', 'admin-neighborhoods-label', handleNeighMove);
          map.on('mouseleave', 'admin-neighborhoods-label', handleNeighLeave);

          // النقر على مضلع الحي
          map.on('click', 'admin-neighborhoods-fill', (e: any) => {
            if (e.originalEvent && (e.originalEvent as any)._handledByLayer) return;
            if (e.originalEvent) {
              (e.originalEvent as any)._handledByLayer = true;
            }

            if (showAdminAreasRef.current) {
              handleNeighClick(e);
            } else {
              // عند عدم تفعيل التقسيمات: النقر على أي نقطة داخل الحي (على المضلع) يزيل الصبغة والإطار فوراً
              if (selectedNeighIdRef.current !== null) {
                map.setFeatureState({ source: 'admin-boundaries', id: selectedNeighIdRef.current }, { selected: false });
                selectedNeighIdRef.current = null;
              }
              if (map.getLayer('admin-neighborhoods-fill')) {
                map.setLayoutProperty('admin-neighborhoods-fill', 'visibility', 'none');
              }
              if (map.getLayer('admin-neighborhoods-line')) {
                map.setLayoutProperty('admin-neighborhoods-line', 'visibility', 'none');
              }
              if (map.getLayer('admin-neighborhoods-shadow')) {
                map.setLayoutProperty('admin-neighborhoods-shadow', 'visibility', 'none');
              }
              setSelectedNeighborhood(null);
              setSelectedArea(null);
            }
          });
          map.on('mousemove', 'admin-neighborhoods-fill', handleNeighMove);
          map.on('mouseleave', 'admin-neighborhoods-fill', handleNeighLeave);

          // النقر على الخريطة أو أي نقطة داخل/خارج الحي يزيل التحديد والصبغة والإطار المتوهج فوراً
          map.on('click', (e: any) => {
            if (e.originalEvent && (e.originalEvent as any)._handledByLayer) return;

            // التحقق إن كانت النقرة على تسمية حي أو بلدية أو معلم POI
            const interactiveLayers = ['admin-neighborhoods-label', 'places-poi-pins', 'places-poi-labels',
              'landmarks-tier1-label', 'landmarks-tier2-label', 'landmarks-tier3-label'];
            if (showAdminAreasRef.current) {
              interactiveLayers.push('admin-municipalities-fill', 'admin-neighborhoods-fill');
            }
            const activeLayers = interactiveLayers.filter((id) => Boolean(map.getLayer(id)));
            const hits = activeLayers.length > 0 ? map.queryRenderedFeatures(e.point, { layers: activeLayers }) : [];
            if (hits && hits.length > 0) return;
            if (selectedPlaceRef.current) closePlace();

            // إزالة مضلع الحي وحدوده وبطاقته فوراً عند النقر على أي نقطة على الخريطة
            if (selectedNeighIdRef.current !== null) {
              map.setFeatureState({ source: 'admin-boundaries', id: selectedNeighIdRef.current }, { selected: false });
              selectedNeighIdRef.current = null;
            }
            if (map.getLayer('admin-neighborhoods-fill')) {
              map.setLayoutProperty('admin-neighborhoods-fill', 'visibility', 'none');
            }
            if (map.getLayer('admin-neighborhoods-line')) {
              map.setLayoutProperty('admin-neighborhoods-line', 'visibility', 'none');
            }
            if (map.getLayer('admin-neighborhoods-shadow')) {
              map.setLayoutProperty('admin-neighborhoods-shadow', 'visibility', 'none');
            }

            setSelectedNeighborhood(null);
            setSelectedArea(null);
          });
        };

        // استدعاء التهيئة لمرة واحدة بدقة وتفادي أي وميض
        let isReadyFired = false;
        let safetyTimer: any = null;

        const onReady = () => {
          if (!isMounted || isReadyFired) return;
          isReadyFired = true;
          if (safetyTimer) clearTimeout(safetyTimer);

          applyThemeToMap(map, 'governorate');
          setupAdminLayers();
          if (map.getLayer('admin-neighborhoods-label')) {
            map.setLayoutProperty('admin-neighborhoods-label', 'visibility', 'visible');
            map.setFilter('admin-neighborhoods-label', ['==', ['get', 'level'], 10]);
          }
          setupLandmarkLayers(map, getAssetUrl, (item) => handleSelectLandmarkRef.current?.(item));
          refreshPoiLayer(map, selectedCategoriesRef.current);
          setLoading(false);

          // إظهار كامل محافظة دمشق ببلدياتها الـ 16 من البداية دون قص أي بلدية
          map.fitBounds(DAMASCUS_BOUNDS, {
            padding: { top: 60, bottom: 60, left: 60, right: 60 },
            duration: 0,
            maxZoom: 11.6,
          });
        };

        map.once('load', onReady);
        map.once('idle', onReady);
        safetyTimer = setTimeout(onReady, 1200);

        mapInstanceRef.current = map;
      } catch (err) {
        console.error('Error initializing map:', err);
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // مصفوفة فارغة لضمان عدم إعادة إنشاء الخريطة نهائياً عند تغيير أي حالة

  // التبديل اللحظي للنمط اللوني عند طلب المستخدم حصراً
  const handleSelectTheme = (themeKey: ThemeKey) => {
    setActiveTheme(themeKey);
    if (mapInstanceRef.current && mapInstanceRef.current.isStyleLoaded()) {
      applyThemeToMap(mapInstanceRef.current, themeKey);
    }
  };

  // التحكم بظهور وفلترة طبقات التقسيمات الإدارية الذكية وفق التسلسل الهرمي
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const munLayers = ['admin-municipalities-shadow', 'admin-municipalities-fill', 'admin-municipalities-line', 'admin-municipalities-label'];
    const neighVisualLayers = ['admin-neighborhoods-shadow', 'admin-neighborhoods-fill', 'admin-neighborhoods-line'];
    const neighInteractiveLayers = ['admin-neighborhoods-label', 'admin-neighborhoods-hit'];

    if (!showAdminAreas) {
      // 1. التقسيمات الإدارية معطلة: إخفاء مضلعات وظلال البلديات وطبقة النقر لكامل المساحة
      ['admin-municipalities-shadow', 'admin-municipalities-fill', 'admin-municipalities-line', 'admin-municipalities-label', 'admin-neighborhoods-hit'].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
      });

      // إبقاء أسماء الأحياء ظاهرة (تظهر عند التقريب بفضل minzoom: 12.5)
      if (map.getLayer('admin-neighborhoods-label')) {
        map.setLayoutProperty('admin-neighborhoods-label', 'visibility', 'visible');
        map.setFilter('admin-neighborhoods-label', ['==', ['get', 'level'], 10]);
      }

      // إذا كان هناك حي مختار: إبراز كامل مضلعه بصبغة لونية راقية وإطار حدوده
      if (selectedNeighborhood) {
        const neighId = Number(selectedNeighborhood.id);
        if (map.getLayer('admin-neighborhoods-fill')) {
          map.setLayoutProperty('admin-neighborhoods-fill', 'visibility', 'visible');
          map.setFilter('admin-neighborhoods-fill', ['==', ['to-number', ['get', 'id']], neighId]);
        }
        if (map.getLayer('admin-neighborhoods-line')) {
          map.setLayoutProperty('admin-neighborhoods-line', 'visibility', 'visible');
          map.setFilter('admin-neighborhoods-line', ['==', ['to-number', ['get', 'id']], neighId]);
        }
        if (map.getLayer('admin-neighborhoods-shadow')) {
          map.setLayoutProperty('admin-neighborhoods-shadow', 'visibility', 'visible');
          map.setFilter('admin-neighborhoods-shadow', ['==', ['to-number', ['get', 'id']], neighId]);
        }
      } else {
        // عند عدم اختيار أي حي: إخفاء مضلع الملء وإطار الحدود فوراً
        if (map.getLayer('admin-neighborhoods-fill')) {
          map.setLayoutProperty('admin-neighborhoods-fill', 'visibility', 'none');
        }
        if (map.getLayer('admin-neighborhoods-line')) {
          map.setLayoutProperty('admin-neighborhoods-line', 'visibility', 'none');
        }
        if (map.getLayer('admin-neighborhoods-shadow')) {
          map.setLayoutProperty('admin-neighborhoods-shadow', 'visibility', 'none');
        }
      }

      if (selectedMunIdRef.current !== null) {
        map.setFeatureState({ source: 'admin-boundaries', id: selectedMunIdRef.current }, { selected: false });
        selectedMunIdRef.current = null;
      }
      if (hoveredMunIdRef.current !== null) {
        map.setFeatureState({ source: 'admin-boundaries', id: hoveredMunIdRef.current }, { hover: false });
        hoveredMunIdRef.current = null;
      }
      map.getCanvas().style.cursor = '';
    } else {
      // 2. التقسيمات الإدارية الرسمية مفعلة
      if (selectedNeighborhood) {
        // حالة اختيار حي: إخفاء المضلعات والظلال المرئية لمنع حجب معالم الحي
        [...munLayers, ...neighVisualLayers].forEach((id) => {
          if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
        });
        neighInteractiveLayers.forEach((id) => {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, 'visibility', 'visible');
            map.setFilter(id, ['==', ['get', 'level'], 10]);
          }
        });
      } else if (selectedMunicipality) {
        // حالة اختيار بلدية معينة: إظهار حدودها وعزل أحيائها التابعة فقط
        ['admin-municipalities-shadow', 'admin-municipalities-fill', 'admin-municipalities-line'].forEach((id) => {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, 'visibility', 'visible');
            map.setFilter(id, ['==', ['get', 'id'], selectedMunicipality.id]);
          }
        });
        if (map.getLayer('admin-municipalities-label')) {
          map.setLayoutProperty('admin-municipalities-label', 'visibility', 'none');
        }

        const neighFilter = ['all', ['==', ['get', 'level'], 10], ['==', ['get', 'parent_id'], selectedMunicipality.id]];
        [...neighVisualLayers, ...neighInteractiveLayers].forEach((id) => {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, 'visibility', 'visible');
            map.setFilter(id, neighFilter);
          }
        });
      } else {
        // حالة البداية عند تفعيل التقسيمات (Macro Overview): بلديات دمشق الـ 16 فقط!
        munLayers.forEach((id) => {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, 'visibility', 'visible');
            map.setFilter(id, ['==', ['get', 'level'], 9]);
          }
        });
        // إخفاء جميع طبقات وتسميات ونقرات الأحياء لتفادي الاصطدام والتداخل التفاعلي
        [...neighVisualLayers, ...neighInteractiveLayers].forEach((id) => {
          if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
        });
      }
    }
  }, [showAdminAreas, selectedMunicipality, selectedNeighborhood]);

  // عرض مسار الخط المختار بدقة أو مسحه (Option B - Zero Clutter)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map) {
      renderSelectedTransitRoute(map, selectedTransitLine);
    }
  }, [selectedTransitLine, renderSelectedTransitRoute]);

  // تحديث طبقات الـ POIs عند تغيير التحديد فقط وبدون وميض الخريطة
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && map.isStyleLoaded()) {
      refreshPoiLayer(map, selectedCategories);
    }
  }, [selectedCategories, selectedSubcategory, selectedSector, refreshPoiLayer]);

  // فلترة المعالم فورياً حسب التصنيف الفرعي المختار دون وميض أو تأخير
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (!map.getLayer('places-poi-pins')) return;

    if (selectedPlaceRef.current) {
      const filter = ['==', ['to-number', ['get', 'id']], Number(selectedPlaceRef.current.id)];
      map.setFilter('places-poi-pins', filter);
      if (map.getLayer('places-poi-labels')) map.setFilter('places-poi-labels', filter);
      return;
    }

    if (selectedSubcategory) {
      const filter = ['==', ['get', 'sub_category_slug'], selectedSubcategory];
      map.setFilter('places-poi-pins', filter);
      if (map.getLayer('places-poi-labels')) map.setFilter('places-poi-labels', filter);
    } else {
      map.setFilter('places-poi-pins', null);
      if (map.getLayer('places-poi-labels')) map.setFilter('places-poi-labels', null);
    }
  }, [selectedSubcategory, selectedSector]);

  useEffect(() => {
    if (!selectedSubcategory) {
      setAvailableSectors([]);
      return;
    }

    const controller = new AbortController();
    const category = selectedCategories[0];
    const query = new URLSearchParams({ subcategory: selectedSubcategory });
    if (category) query.set('category', category);
    fetch(`${getApiBaseUrl()}/places/sectors/?${query.toString()}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Sector request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setAvailableSectors(Array.isArray(data.results) && data.results.length > 0 ? data.results : []);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.warn('Sector fetch notice:', err);
        setAvailableSectors([]);
      });

    return () => controller.abort();
  }, [selectedSubcategory, selectedCategories]);

  const handleSelectCommandCategory = (slug: string | null) => {
    if (slug === null) {
      setSelectedCategories([]);
      setSelectedSubcategory(null);
      setSelectedSector(null);
    } else {
      setSelectedCategories([slug]);
      setSelectedSubcategory(null);
      setSelectedSector(null);
      setSelectedPlace(null);
      placeCameraRef.current = null;
      focusedPlaceRef.current = null;
      mapInstanceRef.current?.fitBounds(DAMASCUS_BOUNDS, {
        padding: { top: 60, bottom: 60, left: 60, right: 60 },
        duration: 1200,
        maxZoom: 11.6,
      });
    }
  };

  const handleSelectCommandSubcategory = (subSlug: string | null) => {
    setSelectedSubcategory(subSlug);
    setSelectedSector(null);
  };

  const handleSelectCommandSector = (sectorSlug: string | null) => {
    setSelectedSector(sectorSlug);
  };

  // إعادة تمركز الخريطة إلى كامل دمشق
  const handleResetView = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setSelectedStreet(null);
    if (map.getLayer('selected-street-casing')) map.setLayoutProperty('selected-street-casing', 'visibility', 'none');
    if (map.getLayer('selected-street-line')) map.setLayoutProperty('selected-street-line', 'visibility', 'none');
    map.fitBounds(DAMASCUS_BOUNDS, {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      duration: 1200,
      maxZoom: 11.6,
    });
  };

  // التفاعل مع النقر على معالم الاستدلال الثابتة (Landmark Click Handler)
  const handleSelectLandmark = useCallback(async (item: LandmarkSelectPayload) => {
    const preview = createPlacePreview({ ...item }, item.coordinates);
    setSelectedPlace(preview);
    setSelectedArea(null);
    setSelectedMunicipality(null);
    setSelectedNeighborhood(null);
    setRoutingDestination(null);

    if (item.id) {
      try {
        const res = await fetch(`${getApiBaseUrl()}/places/${item.id}/`);
        if (res.ok) {
          const pData = await res.json();
          setSelectedPlace(current => current === preview ? {
            ...pData,
            location: {
              ...pData.location,
              longitude: item.coordinates[0],
              latitude: item.coordinates[1],
            },
          } : current);
        }
      } catch (err) {
        console.error('Error fetching landmark detail:', err);
      }
    }
  }, []);

  useEffect(() => {
    handleSelectLandmarkRef.current = handleSelectLandmark;
  }, [handleSelectLandmark]);

  // إبراز مسار الشارع المحدد على الخريطة
  const handleHighlightStreet = (street: SearchResultItem) => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    setSelectedStreet(street);
    setSelectedPlace(null);
    setSelectedArea(null);

    const geojsonData = {
      type: 'Feature',
      properties: { title: street.title },
      geometry: street.geometry,
    };

    const source = map.getSource('selected-street-source') as any;
    if (source) {
      source.setData(geojsonData);
    } else {
      map.addSource('selected-street-source', {
        type: 'geojson',
        data: geojsonData as any,
      });

      map.addLayer({
        id: 'selected-street-casing',
        type: 'line',
        source: 'selected-street-source',
        paint: {
          'line-color': '#064239',
          'line-width': 8.0,
          'line-opacity': 0.85,
        },
      });

      map.addLayer({
        id: 'selected-street-line',
        type: 'line',
        source: 'selected-street-source',
        paint: {
          'line-color': '#c8a76a',
          'line-width': 4.5,
          'line-opacity': 0.95,
        },
      });
    }

    if (map.getLayer('selected-street-casing')) {
      map.setLayoutProperty('selected-street-casing', 'visibility', 'visible');
    }
    if (map.getLayer('selected-street-line')) {
      map.setLayoutProperty('selected-street-line', 'visibility', 'visible');
    }

    if (street.bbox && Array.isArray(street.bbox) && street.bbox.length === 4) {
      const [minX, minY, maxX, maxY] = street.bbox;
      map.fitBounds([[minX, minY], [maxX, maxY]], {
        padding: { top: 90, bottom: 90, left: 60, right: 60 },
        maxZoom: 16.5,
        duration: 1400,
      });
    } else if (street.coordinates) {
      map.flyTo({ center: street.coordinates, zoom: 16.5, duration: 1200 });
    }
  };

  // التفاعل مع اختيار عنصر من شريط البحث
  const handleSelectSearchResult = async (item: SearchResultItem) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (item.type === 'street') {
      handleHighlightStreet(item);
      return;
    }

    if (item.type === 'municipality' || (item.type === 'area' && (item.level === 9 || item.title.startsWith('دائرة') || item.title.startsWith('بلدية')))) {
      setShowAdminAreas(true);
      const feat = adminFeatures.find((f) => Number(f.properties?.id) === Number(item.id)) 
        || adminGeoJsonRef.current?.features?.find((f: any) => Number(f.properties?.id) === Number(item.id));
      const props: AdminAreaProperties = feat?.properties || {
        id: item.id,
        name_ar: item.title,
        name_en: '',
        code: item.code || '',
        level: 9,
        level_name: 'بلدية',
      };
      handleSelectMunicipality(props, feat);
      return;
    }

    if (item.type === 'neighborhood' || (item.type === 'area' && item.level === 10)) {
      setShowAdminAreas(true);
      const feat = adminFeatures.find((f) => Number(f.properties?.id) === Number(item.id)) 
        || adminGeoJsonRef.current?.features?.find((f: any) => Number(f.properties?.id) === Number(item.id));
      const parentId = feat?.properties?.parent_id;
      const parentMun = parentId ? adminFeatures.find((f) => Number(f.properties?.id) === Number(parentId)) : null;
      if (parentMun) {
        setSelectedMunicipality(parentMun.properties);
        selectedMunIdRef.current = parentMun.properties.id;
      }
      const props: AdminAreaProperties = feat?.properties || {
        id: item.id,
        name_ar: item.title,
        name_en: '',
        code: item.code || '',
        level: 10,
        level_name: 'حي',
        parent_id: parentId,
        parent_name_ar: parentMun?.properties?.name_ar,
      };
      handleSelectNeighborhood(props, feat);
      return;
    }

    if (item.type !== 'place') map.flyTo({
      center: item.coordinates,
      zoom: 16.5,
      essential: true,
      duration: 1800,
    });

    if (item.type === 'place') {
      const preview = createPlacePreview({ ...item }, item.coordinates);
      setSelectedPlace(preview);
      setSelectedArea(null);
      setRoutingDestination(null);
      try {
        const res = await fetch(`${getApiBaseUrl()}/places/${item.id}/`);
        if (res.ok) {
          const pData = await res.json();
          setSelectedPlace(current => current === preview ? pData : current);
          setSelectedArea(null);
          setRoutingDestination(null);

          // إظهار التصنيف التابع له المكان تلقائياً كالتصنيف الوحيد النشط
          if (pData.category && pData.category.slug) {
            setSelectedCategories([pData.category.slug]);
          }
        }
      } catch (err) {
        console.error('Error fetching searched place detail:', err);
      }
    } else if (item.type === 'bus') {
      setIsTransitDrawerOpen(true);
      const matched = transitLines.find((l) => l.id === item.id);
      if (matched) {
        setSelectedTransitLine(matched);
      }
    }
  };

  // تطبيق مسار التوجيه الجغرافي على الخريطة (Step 5)
  const handleApplyRouteGeoJSON = (geojson: any) => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('routing-path-source');
    if (source) {
      source.setData(geojson);
    } else {
      map.addSource('routing-path-source', {
        type: 'geojson',
        data: geojson,
      });

      // غلاف المسار الأبيض المتوهج
      map.addLayer({
        id: 'routing-path-casing',
        type: 'line',
        source: 'routing-path-source',
        paint: {
          'line-color': '#ffffff',
          'line-width': 7.0,
          'line-opacity': 0.85,
        },
      });

      // مسار الطريق الأساسي
      map.addLayer({
        id: 'routing-path-line',
        type: 'line',
        source: 'routing-path-source',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4.5,
          'line-opacity': 0.95,
        },
      });
    }

    if (map.getLayer('routing-path-casing')) {
      map.setLayoutProperty('routing-path-casing', 'visibility', 'visible');
    }
    if (map.getLayer('routing-path-line')) {
      map.setLayoutProperty('routing-path-line', 'visibility', 'visible');
    }

    // ملاءمة حدود الخريطة مع كامل مسار الرحلة
    if (geojson.geometry && geojson.geometry.coordinates) {
      const coords = geojson.geometry.coordinates;
      let minX = 999, minY = 999, maxX = -999, maxY = -999;
      coords.forEach((pt: [number, number]) => {
        if (pt[0] < minX) minX = pt[0];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[1] > maxY) maxY = pt[1];
      });
      map.fitBounds([[minX, minY], [maxX, maxY]], {
        padding: { top: 120, bottom: 90, left: 380, right: 90 },
        duration: 1600,
      });
    }
  };

  const handleClearRoute = () => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer('routing-path-casing')) {
      map.setLayoutProperty('routing-path-casing', 'visibility', 'none');
    }
    if (map.getLayer('routing-path-line')) {
      map.setLayoutProperty('routing-path-line', 'visibility', 'none');
    }
    setRoutingDestination(null);
  };

  const handleZoomToPlace = (lat: number, lon: number) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 640;
    map.flyTo({
      center: [lon, lat],
      zoom: 17.5,
      essential: true,
      duration: 1400,
      padding: isDesktop ? { left: 240, right: 0, top: 0, bottom: 0 } : { left: 0, right: 0, top: 0, bottom: 180 },
    });
  };

  const getCategoryIcon = (slug: string) => {
    switch (slug) {
      case 'healthcare': return <Hospital className="w-3.5 h-3.5 text-[#e63946]" />;
      case 'education': return <GraduationCap className="w-3.5 h-3.5 text-[#1d3557]" />;
      case 'government': return <Landmark className="w-3.5 h-3.5 text-[#064239] dark:text-emerald-400" />;
      case 'religious': return <Moon className="w-3.5 h-3.5 text-[#0d9488]" />;
      case 'tourism': return <Sparkles className="w-3.5 h-3.5 text-[#c8a76a]" />;
      case 'public-services': return <Wrench className="w-3.5 h-3.5 text-[#457b9d]" />;
      case 'security': return <Shield className="w-3.5 h-3.5 text-[#04352e] dark:text-emerald-400" />;
      case 'economy': return <Coins className="w-3.5 h-3.5 text-[#2d6a4f]" />;
      case 'transportation': return <Bus className="w-3.5 h-3.5 text-[#3a6962]" />;
      default: return <MapPin className="w-3.5 h-3.5 text-[#064239] dark:text-emerald-400" />;
    }
  };

  const handleSelectNeighborhoodByName = (neighName: string) => {
    if (!adminGeoJsonRef.current) return;
    const cleanName = neighName.replace(/^حي\s*/, '').trim();
    const feat = adminGeoJsonRef.current.features.find((f: any) => 
      f.properties.level === 10 && (
        f.properties.name_ar === cleanName || 
        f.properties.name_ar.includes(cleanName) || 
        cleanName.includes(f.properties.name_ar)
      )
    );
    if (feat) {
      handleSelectNeighborhood(feat.properties, feat);
    }
  };

  const currentTheme = THEMES[activeTheme];

  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{ backgroundColor: '#f7f4ed' }}
    >
      {/* 1. حاوية الخريطة بملء الشاشة */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* 2. مؤشر التحميل الأولي */}
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#f8f6f1]/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 bg-[#fdfbf7] text-[#064239] px-6 py-3.5 rounded-2xl shadow-2xl border border-[#064239]/15 text-sm font-bold">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#064239] border-t-transparent" />
            <span>جارٍ تحميل خريطة دمشق والتقسيمات الرسمية...</span>
          </div>
        </div>
      )}

      {/* 3. شريط الرأس الموحد الأنيق (Unified Floating Navigation Header) */}
      <header className="map-topbar" dir="rtl">
      <div className="map-glass-header">
        {/* السطر الأول: شريط الفئات العائم فوق شريط البحث (Category Command Dock) بكامل العرض */}
        <div className="map-header-categories">
          <CategoryCommandBar
            categories={categories}
            selectedCategorySlug={selectedCategories[0] || null}
            selectedSubcategorySlug={selectedSubcategory}
            selectedSectorSlug={selectedSector}
            sectors={availableSectors}
            onSelectCategory={handleSelectCommandCategory}
            onSelectSubcategory={handleSelectCommandSubcategory}
            onSelectSector={handleSelectCommandSector}
          />
        </div>

        {/* السطر الثاني: شريط التحكم والبحث الموحد (Official Emblem + Search Bar + Theme Selector) */}
          {/* اليمين: الشعار الرسمي لمحافظة دمشق (Official Damascus Governorate Emblem) */}
          <button
            type="button"
            onClick={handleResetView}
            className="map-header-logo group"
            title="محافظة دمشق - إعادة التمركز إلى وسط العاصمة"
            aria-label="شعار محافظة دمشق - إعادة التمركز إلى وسط العاصمة"
          >
            <img
              src={getAssetPath('/damascus_governorate_logo.png')}
              alt="شعار محافظة دمشق"
              className="h-16 sm:h-24 w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
            />
          </button>

      </div>
          {/* الوسط: شريط البحث الذكي المستقر تماماً (Rock-Solid Fixed Search Bar) */}
          <div className="map-header-search min-w-0">
            <DamasceneSearchBar 
              onSelectResult={handleSelectSearchResult}
              activeCategorySlug={selectedCategories[0] || null}
              placeholder={
                selectedCategories[0]
                  ? `ابحث داخل ${categories.find(c => c.slug === selectedCategories[0])?.name_ar || 'الفئة المحددة'}...`
                  : "ابحث عن مشفى، مدرسة، دائرة، حي، أو خط باص..."
              }
            />
          </div>
      </header>

          {/* اليسار: قائمة منسدلة أنيقة للهوية البصرية (Popover Menu) */}
          <div ref={themeMenuRef} className="map-header-theme z-30 flex flex-col items-start gap-2" dir="rtl">
            <button
              type="button"
              onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-3 sm:py-2.5 bg-[#fdfbf7] shadow-lg rounded-2xl border border-[#064239]/10 hover:bg-white text-xs font-bold text-[#064239] transition-all cursor-pointer active:scale-95 h-11"
              aria-label="تغيير الهوية البصرية للخريطة"
              aria-expanded={isThemeMenuOpen}
              title="تغيير الهوية البصرية للخريطة"
            >
              <Palette className="w-4 h-4 text-[#c8a76a]" />
              <span className="hidden md:inline text-[11px] text-zinc-500">الهوية:</span>
              <span className="flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block shadow-xs border border-black/15"
                  style={{ backgroundColor: currentTheme?.dotColor || '#3a6962' }}
                />
                <span className="font-extrabold text-xs hidden md:inline">{activeTheme === 'governorate' ? currentTheme.label : currentTheme?.label.split(' ')[1] || 'الأخضر'}</span>
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${isThemeMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            <div
              className="flex items-center gap-1 rounded-2xl border border-[#064239]/10 bg-[#fdfbf7]/90 p-1 shadow-lg"
              role="group"
              aria-label="اختيار نمط عرض الخريطة"
            >
              <Box className="mx-1 h-4 w-4 text-[#c8a76a]" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setMapViewMode('2d')}
                className={`rounded-xl px-2.5 py-1.5 text-[11px] font-black transition-all cursor-pointer active:scale-95 ${
                  mapViewMode === '2d'
                    ? 'bg-[#064239] text-white shadow-sm'
                    : 'text-[#064239] hover:bg-[#f3eddf]'
                }`}
                aria-pressed={mapViewMode === '2d'}
                title="العرض ثنائي الأبعاد"
              >
                2D
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapViewMode('2d');
                  setIsThreeDNoticeOpen(true);
                }}
                className={`rounded-xl px-2.5 py-1.5 text-[11px] font-black transition-all cursor-pointer active:scale-95 ${
                  mapViewMode === '3d'
                    ? 'bg-[#c8a76a] text-[#064239] shadow-sm'
                    : 'text-[#064239] hover:bg-[#f3eddf]'
                }`}
                aria-pressed={mapViewMode === '3d'}
                title="العرض ثلاثي الأبعاد"
              >
                3D
              </button>
            </div>

            {/* القائمة المنبثقة للهويات */}
            {isThemeMenuOpen && (
              <div 
                className="absolute left-0 bottom-full mb-2 w-56 sm:w-64 max-h-[65vh] overflow-y-auto bg-[#fdfbf7] dark:bg-zinc-900 rounded-2xl shadow-2xl border border-[#064239]/15 p-2 space-y-1 z-50 animate-in fade-in duration-150"
                dir="rtl"
              >
                <div className="px-3 py-1.5 border-b border-black/5 text-[11px] font-bold text-zinc-400">
                  الهوية البصرية المعتمدة
                </div>
                {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
                  const item = THEMES[key];
                  const isActive = activeTheme === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        handleSelectTheme(key);
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#064239] text-white shadow-xs'
                          : 'hover:bg-[#f3eddf]/70 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: item.dotColor }}
                        />
                        <span>{item.label}</span>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-[#c8a76a]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {isThreeDNoticeOpen && (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-[#064239]/20 p-4 backdrop-blur-sm"
              onClick={() => setIsThreeDNoticeOpen(false)}
              role="presentation"
            >
              <div
                className="w-full max-w-sm rounded-3xl border border-white/60 bg-white/35 p-6 text-center shadow-2xl backdrop-blur-xl dark:border-white/20 dark:bg-zinc-900/35"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="three-d-notice-title"
                dir="rtl"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/60 bg-white/35 text-[#064239] shadow-lg dark:border-white/20 dark:bg-white/10 dark:text-emerald-300">
                  <Box className="h-6 w-6" />
                </div>
                <h2 id="three-d-notice-title" className="text-base font-black text-[#064239] dark:text-white">
                  العرض ثلاثي الأبعاد
                </h2>
                <p className="mt-2 text-sm font-medium leading-relaxed text-[#31534d] dark:text-zinc-200">
                  هذه الميزة ستتوفر قريباً.
                </p>
                <button
                  type="button"
                  onClick={() => setIsThreeDNoticeOpen(false)}
                  className="mt-5 w-full rounded-2xl border border-white/60 bg-white/45 px-4 py-2.5 text-xs font-black text-[#064239] shadow-lg transition-all hover:bg-white/65 active:scale-95 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                >
                  حسناً
                </button>
              </div>
            </div>
          )}

      {/* شريط المسار الهرمي الذكي (Smart City Hierarchy Breadcrumb) */}
      {selectedMunicipality && showAdminAreas && (
        <div 
          className="map-header-breadcrumb fixed sm:absolute right-3 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-20 flex items-center gap-1.5 px-3.5 py-1.5 bg-[#fdfbf7]/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-[#064239]/20 dark:border-white/10 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200" 
          dir="rtl"
        >
          <button
            type="button"
            onClick={handleResetToAllMunicipalities}
            className="flex items-center gap-1 text-zinc-500 hover:text-[#064239] dark:hover:text-emerald-400 cursor-pointer transition-colors"
            title="العودة لعرض كافة بلديات دمشق"
          >
            <Layers className="w-3.5 h-3.5 text-[#064239] dark:text-emerald-400" />
            <span>بلديات دمشق (16)</span>
          </button>
          <ChevronLeft className="w-3.5 h-3.5 text-zinc-400" />
          <button
            type="button"
            onClick={handleResetToMunicipality}
            className={`flex items-center gap-1 cursor-pointer transition-colors ${
              selectedNeighborhood ? 'text-zinc-500 hover:text-[#064239] dark:hover:text-emerald-400' : 'text-[#064239] dark:text-emerald-400 font-extrabold'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>{selectedMunicipality.name_ar}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#064239]/10 dark:bg-white/10">
              {childNeighborhoods.length}
            </span>
          </button>
          {selectedNeighborhood && (
            <>
              <ChevronLeft className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[#c8a76a] dark:text-amber-300 font-extrabold flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{selectedNeighborhood.name_ar}</span>
              </span>
            </>
          )}
          <button
            type="button"
            onClick={handleResetToAllMunicipalities}
            className="mr-2 pr-2 border-r border-black/10 dark:border-white/10 text-[11px] font-extrabold text-rose-600 hover:text-rose-700 cursor-pointer"
            title="إلغاء التحديد وعرض دمشق كاملة"
          >
            إلغاء
          </button>
        </div>
      )}

      {/* شارة التحويم التفاعلية الدقيقة المتناسقة مع الهوية البصرية فوق مؤشر الفأرة مباشرة */}
      {hoveredAdminArea && showAdminAreas && !selectedNeighborhood && (
        <div 
          className="pointer-events-none absolute z-30 select-none animate-in fade-in duration-100"
          style={
            hoveredAdminArea.point 
              ? { 
                  left: hoveredAdminArea.point.x, 
                  top: hoveredAdminArea.point.y,
                  transform: 'translate(-50%, -100%) translateY(-14px)',
                }
              : {
                  left: '50%',
                  bottom: '24px',
                  transform: 'translateX(-50%)',
                }
          }
          dir="rtl"
        >
          <div className="flex flex-col items-center justify-center px-4 py-2 bg-[#fdfbf7]/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-[#064239]/20 dark:border-white/10 text-center min-w-32 whitespace-nowrap">
            <span className="font-bold text-xs text-[#064239] dark:text-emerald-300">
              {hoveredAdminArea.name_ar}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold text-[#c8a76a]">
                {hoveredAdminArea.level === 9 ? 'بلدية رسمية' : 'حي سكني'}
              </span>
              {hoveredAdminArea.neighborhoods_count !== undefined && (
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                  • {hoveredAdminArea.neighborhoods_count} أحياء
                </span>
              )}
            </div>
          </div>
          {/* مؤشر السهم الأنيق */}
          <div className="w-2.5 h-2.5 bg-[#fdfbf7]/95 dark:bg-zinc-900/95 border-b border-r border-[#064239]/20 dark:border-white/10 transform rotate-45 mx-auto -mt-1.5 shadow-2xs" />
        </div>
      )}

      {/* 4. عناصر التحكم العائمة السفلية (المواصلات العامة والطبقات) في مكدس متناسق */}
      <div className="fixed sm:absolute bottom-3 sm:bottom-6 right-3 sm:right-4 z-20 flex flex-col items-start gap-2 sm:gap-2.5 pb-safe pointer-events-none" dir="rtl">
        <UserLocationButton map={loading ? null : mapInstanceRef.current} />
        {/* زر المواصلات العامة العائم المخصص */}
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsTransitDrawerOpen(!isTransitDrawerOpen)}
            className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-2xl shadow-xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
              isTransitDrawerOpen || selectedTransitLine
                ? 'bg-[#064239] text-[#f7f4ed] border-[#c8a76a] ring-2 ring-[#c8a76a]/40 shadow-[#064239]/20'
                : 'bg-[#fdfbf7]/95 dark:bg-zinc-900/95 text-[#064239] dark:text-zinc-200 border-[#064239]/20 hover:border-[#064239]/40 hover:bg-[#f3eddf]'
            }`}
            title="استعراض شبكة المواصلات العامة وباصات دمشق"
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
              isTransitDrawerOpen || selectedTransitLine ? 'bg-[#c8a76a] text-[#064239]' : 'bg-[#064239] text-[#ecc988]'
            }`}>
              <Bus className="w-3.5 h-3.5" />
            </div>
            <span>المواصلات العامة</span>
            {selectedTransitLine && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* إظهار الحدود الإدارية وإخفاؤها مباشرة */}
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={handleToggleAdminAreas}
            aria-pressed={showAdminAreas}
            title={showAdminAreas ? 'إخفاء الحدود الإدارية' : 'إظهار الحدود الإدارية'}
            className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-2xl shadow-xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
              showAdminAreas
                ? 'bg-[#064239] text-[#f7f4ed] border-[#c8a76a]'
                : 'bg-[#fdfbf7] text-[#064239] border-[#064239]/20 hover:bg-[#f3eddf]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{showAdminAreas ? 'إخفاء الحدود الإدارية' : 'إظهار الحدود الإدارية'}</span>
          </button>
        </div>
      </div>

      {/* 5. بطاقة معلومات المنطقة الإدارية المختارة (عند النقر على أي حي أو بلدية - وسط اليسار كبطاقة عائمة) */}
      {selectedArea && !selectedPlace && !routingDestination && (
        <div 
          className="fixed sm:absolute top-1/2 -translate-y-1/2 inset-x-3 sm:inset-x-auto sm:left-4 z-20 sm:w-84 max-h-[80vh] overflow-y-auto bg-[#fdfbf7]/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-2xl border border-[#064239]/20 dark:border-white/10 animate-in fade-in duration-200 pb-safe"
          dir="rtl"
        >
          <div className="flex items-start justify-between gap-3 border-b border-black/5 dark:border-white/5 pb-3 mb-3.5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#064239] text-[#f7f4ed] flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                <Landmark className="w-5 h-5 text-[#c8a76a]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#064239]/10 text-[#064239] dark:bg-emerald-950/60 dark:text-emerald-300">
                    {selectedArea.level === 9 ? 'بلدية / دائرة خدمية' : 'حي سكني'}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    #{selectedArea.code}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-[#064239] dark:text-emerald-400 mt-1">
                  {selectedArea.name_ar}
                </h3>
                {selectedArea.name_en && (
                  <p className="text-xs text-zinc-500 font-medium">
                    {selectedArea.name_en}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseAdminAreaCard}
              className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center text-zinc-500 dark:text-zinc-300 transition-colors cursor-pointer shrink-0"
              title="إغلاق بطاقة المنطقة"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 text-xs bg-[#f7f4ed] dark:bg-zinc-800/60 p-3 rounded-2xl border border-[#064239]/10 text-zinc-600 dark:text-zinc-300">
            {selectedArea.level === 10 && selectedArea.parent_name_ar && (
              <div className="flex items-center justify-between py-1 border-b border-black/5 dark:border-white/5">
                <span className="text-zinc-500 dark:text-zinc-400">البلدية التابع لها:</span>
                <button
                  type="button"
                  onClick={handleResetToMunicipality}
                  className="font-bold text-[#064239] dark:text-emerald-300 hover:underline cursor-pointer"
                >
                  {selectedArea.parent_name_ar}
                </button>
              </div>
            )}
            <div className="flex items-center justify-between py-1 border-b border-black/5 dark:border-white/5">
              <span className="text-zinc-500 dark:text-zinc-400">المحافظة:</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">محافظة دمشق</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-zinc-500 dark:text-zinc-400">حالة التوثيق:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                معتمد رسمياً
              </span>
            </div>

            {/* في حال اختيار بلدية: عرض أحيائها كأزرار تفاعلية سريعة */}
            {selectedArea.level === 9 && childNeighborhoods.length > 0 && (
              <div className="pt-2 border-t border-black/5 dark:border-white/5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                  <span>الأحياء التابعة ({childNeighborhoods.length}):</span>
                  <span className="text-[10px] text-[#064239] dark:text-emerald-400 font-normal">انقر للتقريب</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar py-0.5">
                  {childNeighborhoods.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        const feat = adminFeatures.find((f) => Number(f.properties?.id) === Number(n.id));
                        handleSelectNeighborhood(n, feat);
                      }}
                      className="px-2 py-0.5 text-[11px] rounded-lg bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 hover:border-[#064239] dark:hover:border-emerald-400 hover:text-[#064239] dark:hover:text-emerald-300 font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                    >
                      {n.name_ar}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* في حال اختيار حي: زر العودة السريعة للبلدية الحاضنة */}
            {selectedArea.level === 10 && (
              <div className="pt-2 border-t border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={handleResetToMunicipality}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#064239]/10 hover:bg-[#064239]/20 text-[#064239] dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 font-bold text-xs transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>العودة لكافة أحياء {selectedArea.parent_name_ar || 'البلدية'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. بطاقة تفاصيل المكان (Market Card Drawer) */}
      <PlaceDetailDrawer
        place={selectedPlace}
        onClose={closePlace}
        onStartRouting={(dest) => {
          setSelectedPlace(null);
          setRoutingDestination(dest);
        }}
        onZoomToPlace={handleZoomToPlace}
        onSelectNeighborhood={handleSelectNeighborhoodByName}
      />

      {/* 7. لوحة التوجيه والوصول إلى المكان (Routing Panel) */}
      <RoutingPanel
        destination={routingDestination}
        onClose={() => setRoutingDestination(null)}
        onApplyRouteGeoJSON={handleApplyRouteGeoJSON}
        onClearRoute={handleClearRoute}
      />

      {/* 8. مستكشف شبكة المواصلات العامة وباصات دمشق */}
      <TransitDrawer
        isOpen={isTransitDrawerOpen}
        onClose={() => setIsTransitDrawerOpen(false)}
        lines={transitLines}
        selectedLine={selectedTransitLine}
        onSelectLine={setSelectedTransitLine}
        onSelectStop={handleSelectTransitStop}
      />

      {/* 9. بطاقة الشارع المختار (Floating Street Banner) */}
      {selectedStreet && (
        <div 
          className="pointer-events-auto fixed bottom-5 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-md w-[calc(100%-2rem)] sm:w-auto bg-[#fdfbf7]/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-[#c8a76a]/40 p-3.5 sm:p-4 animate-in fade-in slide-in-from-bottom-4 duration-200"
          dir="rtl"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#064239] text-[#c8a76a] flex items-center justify-center shrink-0 shadow-md">
                <Route className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-extrabold text-[#064239] dark:text-zinc-100 truncate">
                    {selectedStreet.title}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-500/25">
                    شارع
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                  {selectedStreet.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedStreet(null);
                  const map = mapInstanceRef.current;
                  if (map) {
                    if (map.getLayer('selected-street-casing')) map.setLayoutProperty('selected-street-casing', 'visibility', 'none');
                    if (map.getLayer('selected-street-line')) map.setLayoutProperty('selected-street-line', 'visibility', 'none');
                  }
                }}
                className="w-8 h-8 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-zinc-500 dark:text-zinc-300 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="إغلاق بطاقة الشارع"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
