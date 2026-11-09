'use client';

import { useState, useEffect } from 'react';
import { 
  Navigation, 
  X, 
  Bus, 
  Car, 
  Footprints, 
  Clock, 
  Coins, 
  ArrowRight, 
  Loader2,
  MapPin,
  Route
} from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api-config';

import { fetchRoutingResult, type RouteResult } from '@/lib/routing-api';
import type { LocationStatus, UserLocation } from './useUserLocation';

interface RoutingPanelProps {
  locationStatus: LocationStatus;
  getCurrentLocation: () => Promise<UserLocation>;
  onSelectDestination: () => void;
  destination: {
    lat: number;
    lon: number;
    title: string;
  } | null;
  onClose: () => void;
  onApplyRouteGeoJSON: (geojson: any, result?: RouteResult) => void;
  onClearRoute: () => void;
}

export default function RoutingPanel({
  destination,
  locationStatus,
  getCurrentLocation,
  onSelectDestination,
  onClose,
  onApplyRouteGeoJSON,
  onClearRoute,
}: RoutingPanelProps) {
  const [mode, setMode] = useState<'transit' | 'car' | 'walk'>('car');
  const [loading, setLoading] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [transitPrimary, setTransitPrimary] = useState<RouteResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!destination) return;

    let isMounted = true;
    const controller = new AbortController();

    const fetchRoute = async () => {
      setRouteResult(null);
      setError('');
      onClearRoute();
      setLoading(true);
      try {
        const current = await getCurrentLocation();
        if (!isMounted) return;
        const origin = { lat: current.lat, lon: current.lon, title: 'موقعي الحالي' };
        const data = await fetchRoutingResult(getApiBaseUrl(), origin, destination, mode, controller.signal);
        if (isMounted) {
          setRouteResult(data);
          setTransitPrimary(mode === 'transit' && data.recommended_mode === 'transit' ? data : null);
          onApplyRouteGeoJSON(data.route_geojson, data);
        }
      } catch (err) {
        if (isMounted && (err as Error).name !== 'AbortError') setError((err as Error).message || 'تعذر الاتصال بخدمة التوجيه.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRoute();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [destination, mode]);

  if (!destination) return null;

  const handleClose = () => {
    onClearRoute();
    onClose();
  };
  const transitUsesBus = mode === 'transit' && routeResult?.recommended_mode === 'transit';
  const originLabel = locationStatus === 'stale' ? 'آخر موقع معروف (غير حديث)'
    : locationStatus === 'denied' ? 'إذن الموقع مرفوض'
    : locationStatus === 'unavailable' ? 'الموقع غير متاح'
    : 'موقعي الحالي';
  const showWalkingAlternative = () => {
    const primary = transitPrimary;
    const alternative = primary?.alternatives?.[0];
    if (!primary || !alternative) return;
    const walking: RouteResult = { ...primary, recommended_mode: 'walk',
      summary: alternative.summary, line_name: undefined, cost_syp: 0,
      total_distance_km: Math.round(alternative.distance_m / 10) / 100,
      duration_minutes: Math.round(alternative.duration_s / 60), steps: [],
      route_legs: alternative.legs, route_geojson: alternative.legs[0].geojson };
    setRouteResult(walking);
    onApplyRouteGeoJSON(walking.route_geojson, walking);
  };

  return (
    <>
      {/* خلفية معتمة للهواتف */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 sm:hidden animate-in fade-in duration-200"
        onClick={handleClose}
      />

      <div 
        className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:top-24 sm:bottom-6 sm:left-4 z-50 w-full sm:w-96 max-h-[75dvh] sm:max-h-[calc(100vh-7.5rem)] bg-[#fdfbf7] dark:bg-zinc-900 shadow-2xl rounded-t-3xl sm:rounded-3xl border-t sm:border border-[#064239]/20 dark:border-white/10 flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-left sm:fade-in duration-300 pb-safe overflow-hidden"
        dir="rtl"
      >
        {/* مقبض سحب بصري للهواتف المحمولة */}
        <div className="sm:hidden absolute top-2 inset-x-0 flex justify-center z-20 pointer-events-none">
          <div className="w-12 h-1.5 rounded-full bg-white/70 shadow-xs" />
        </div>

        {/* الترويسة وأزرار تبديل نمط الوصول (Step 5: Multi-modal Routing) */}
        <div className="p-4 pt-6 sm:pt-4 bg-[#064239] text-[#f7f4ed] space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Route className="w-5 h-5 text-[#c8a76a]" />
              <h3 className="font-extrabold text-base">
                مسار الوصول إلى المكان
              </h3>
            </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* نقاط الانطلاق والوصول */}
        <div className="space-y-1.5 text-xs bg-black/20 p-2.5 rounded-xl border border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-zinc-300">من:</span>
            <span className="font-bold text-white truncate">{originLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#c8a76a] shrink-0" />
            <span className="text-zinc-300">إلى:</span>
            <span className="font-bold text-white truncate">{destination.title}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <button type="button" onClick={onSelectDestination} className="rounded-lg bg-white/15 px-2 py-1">الوجهة من الخريطة</button>
        </div>

        {/* أزرار وسائط النقل الثلاث: باص - سيارة - مشي */}
        <div className="grid grid-cols-3 gap-1.5 bg-black/25 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setMode('transit')}
            className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
              mode === 'transit'
                ? 'bg-white text-[#064239] shadow-sm'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Bus className="w-4 h-4" />
            <span>باص / سرفيس</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('car')}
            className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
              mode === 'car'
                ? 'bg-white text-[#064239] shadow-sm'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>بالسيارة</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('walk')}
            className={`py-2 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
              mode === 'walk'
                ? 'bg-white text-[#064239] shadow-sm'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            <Footprints className="w-4 h-4" />
            <span>مشياً</span>
          </button>
        </div>
      </div>

      {/* تفاصيل المسار والخطوات */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p> : null}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin text-[#064239]" />
            <span className="text-xs font-bold">جارٍ حساب أفضل مسار عبر شوارع دمشق...</span>
          </div>
        ) : routeResult ? (
          <>
            {/* ملخص إحصائيات الرحلة */}
            <div className={`grid ${mode === 'walk' || (mode === 'transit' && !transitUsesBus) ? 'grid-cols-2' : 'grid-cols-3'} gap-2 bg-[#f7f4ed] dark:bg-zinc-800/60 p-3 rounded-2xl border border-[#064239]/10 text-center`}>
              <div className="p-1">
                <div className="flex items-center justify-center gap-1 text-[#064239] dark:text-emerald-400 mb-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <span className="text-base font-black text-[#064239] dark:text-zinc-100">
                  {routeResult.duration_minutes}
                </span>
                <span className="text-[10px] text-zinc-500 block font-bold">دقيقة</span>
              </div>

              <div className="p-1 border-x border-black/5">
                <div className="flex items-center justify-center gap-1 text-[#c8a76a] mb-0.5">
                  <Navigation className="w-4 h-4" />
                </div>
                <span className="text-base font-black text-zinc-800 dark:text-zinc-200">
                  {routeResult.total_distance_km}
                </span>
                <span className="text-[10px] text-zinc-500 block font-bold">كيلومتر</span>
              </div>

              {mode !== 'walk' && (mode !== 'transit' || transitUsesBus) && <div className="p-1">
                {mode === 'transit' ? (
                  <>
                    <div className="flex items-center justify-center gap-1 text-emerald-600 mb-0.5">
                      <Coins className="w-4 h-4" />
                    </div>
                    <span className="text-base font-black text-emerald-700">
                      {routeResult.cost_syp}
                    </span>
                    <span className="text-[10px] text-zinc-500 block font-bold">ل.س (تعرفة)</span>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-1 text-[#3a6962] mb-0.5">
                      <Car className="w-4 h-4" />
                    </div>
                    <span className="text-base font-black text-[#3a6962]">مسار طرق</span>
                    <span className="text-[10px] text-zinc-500 block font-bold">وقت تقديري</span>
                  </>
                )}
              </div>}
            </div>

            {mode === 'transit' && !transitUsesBus && <p className="text-xs font-bold text-[#064239]">المشي هو الخيار الأنسب لهذه الرحلة</p>}
            {transitUsesBus && <p className="text-xs text-amber-700">زمن الانتظار غير متاح، ونقطتا الصعود والنزول مقترحتان وليستا موقفين مؤكدين.</p>}
            {/* تفاصيل مسار الخط إن وجد */}
            {routeResult.line_name && (
              <div className="bg-[#3a6962]/10 dark:bg-teal-950/40 p-3 rounded-xl border border-[#3a6962]/20 dark:border-teal-700/30 flex items-center gap-2.5">
                <Bus className="w-5 h-5 text-[#3a6962] dark:text-teal-400 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-[#064239] dark:text-emerald-300 block">
                    الخط المعتمد: {routeResult.line_name}
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    التعرفة الرسمية المحددة: {routeResult.cost_syp} ليرة سورية
                  </span>
                  {routeResult.direction && <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                    الاتجاه: {routeResult.direction === 'outbound' ? 'ذهاب' : 'إياب'}
                  </span>}
                </div>
              </div>
            )}
            {transitUsesBus && <div className="text-xs text-zinc-600 dark:text-zinc-300">
              المشي: {routeResult.walking_distance_km} كم · الحافلة: {routeResult.bus_distance_km} كم ({routeResult.bus_duration_minutes} دقيقة)
            </div>}
            {mode === 'transit' && transitPrimary?.alternatives?.length ? (
              <button type="button" onClick={transitUsesBus ? showWalkingAlternative : () => {
                setRouteResult(transitPrimary); onApplyRouteGeoJSON(transitPrimary.route_geojson, transitPrimary);
              }} className="rounded-xl border border-[#2684C7]/40 px-3 py-2 text-xs font-bold text-[#2684C7]">
                {transitUsesBus ? 'عرض المشي كبديل' : 'العودة إلى رحلة الباص'}
              </button>
            ) : null}

            {/* إرشادات خطوة بخطوة */}
            {routeResult.steps.length > 0 ? <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                إرشادات الطريق خطوة بخطوة
              </h4>

              <div className="space-y-2">
                {routeResult.steps.map((step, idx) => (
                  <div 
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-zinc-800 border border-black/5"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#064239]/10 text-[#064239] dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 leading-relaxed">
                        {step.instruction}
                      </p>
                      <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                        تقريباً {step.duration_mins} دقيقة
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div> : <p className="text-xs text-zinc-500">تعليمات الانعطاف غير متاحة لهذا المسار.</p>}
          </>
        ) : null}
      </div>
      <button type="button" onClick={handleClose}
        className="mx-4 mb-4 rounded-xl border border-[#064239]/20 px-3 py-2 text-xs font-bold text-[#064239] dark:text-emerald-300">
        إلغاء المسار
      </button>
    </div>
    </>
  );
}
