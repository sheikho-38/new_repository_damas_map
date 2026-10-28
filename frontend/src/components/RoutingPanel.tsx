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
  Flame, 
  ArrowRight, 
  Loader2,
  MapPin,
  Route
} from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api-config';

export interface RouteResult {
  mode: 'transit' | 'car' | 'walk';
  mode_title: string;
  summary: string;
  line_name?: string;
  cost_syp: number;
  total_distance_km: number;
  duration_minutes: number;
  calories_burned?: number;
  steps: Array<{
    instruction: string;
    icon: string;
    duration_mins: number;
  }>;
  route_geojson: any;
}

interface RoutingPanelProps {
  destination: {
    lat: number;
    lon: number;
    title: string;
  } | null;
  onClose: () => void;
  onApplyRouteGeoJSON: (geojson: any) => void;
  onClearRoute: () => void;
}

export default function RoutingPanel({
  destination,
  onClose,
  onApplyRouteGeoJSON,
  onClearRoute,
}: RoutingPanelProps) {
  const [mode, setMode] = useState<'transit' | 'car' | 'walk'>('transit');
  const [loading, setLoading] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);

  // نقطة الانطلاق الافتراضية: ساحة المرجة / جسر الحرية (قلب دمشق)
  const [origin, setOrigin] = useState({
    title: 'جسر الحرية / ساحة الأمويين',
    lat: 33.5132,
    lon: 36.2954,
  });

  useEffect(() => {
    if (!destination) return;

    let isMounted = true;
    setLoading(true);

    const fetchRoute = async () => {
      try {
        const url = `${getApiBaseUrl()}/routing/?start_lat=${origin.lat}&start_lon=${origin.lon}&end_lat=${destination.lat}&end_lon=${destination.lon}&mode=${mode}`;
        const res = await fetch(url);
        if (res.ok) {
          const data: RouteResult = await res.json();
          if (isMounted) {
            setRouteResult(data);
            if (data.route_geojson) {
              onApplyRouteGeoJSON(data.route_geojson);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching route:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRoute();

    return () => {
      isMounted = false;
    };
  }, [destination, mode, origin]);

  if (!destination) return null;

  const handleClose = () => {
    onClearRoute();
    onClose();
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
            <span className="font-bold text-white truncate">{origin.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#c8a76a] shrink-0" />
            <span className="text-zinc-300">إلى:</span>
            <span className="font-bold text-white truncate">{destination.title}</span>
          </div>
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
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin text-[#064239]" />
            <span className="text-xs font-bold">جارٍ حساب أفضل مسار عبر شوارع دمشق...</span>
          </div>
        ) : routeResult ? (
          <>
            {/* ملخص إحصائيات الرحلة */}
            <div className="grid grid-cols-3 gap-2 bg-[#f7f4ed] dark:bg-zinc-800/60 p-3 rounded-2xl border border-[#064239]/10 text-center">
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

              <div className="p-1">
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
                ) : mode === 'walk' ? (
                  <>
                    <div className="flex items-center justify-center gap-1 text-amber-600 mb-0.5">
                      <Flame className="w-4 h-4" />
                    </div>
                    <span className="text-base font-black text-amber-700">
                      {routeResult.calories_burned || 80}
                    </span>
                    <span className="text-[10px] text-zinc-500 block font-bold">سعرة حرارية</span>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-1 text-[#3a6962] mb-0.5">
                      <Car className="w-4 h-4" />
                    </div>
                    <span className="text-base font-black text-[#3a6962]">
                      سريع
                    </span>
                    <span className="text-[10px] text-zinc-500 block font-bold">شوارع رئيسية</span>
                  </>
                )}
              </div>
            </div>

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
                </div>
              </div>
            )}

            {/* إرشادات خطوة بخطوة */}
            <div className="space-y-2">
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
            </div>
          </>
        ) : null}
      </div>
    </div>
    </>
  );
}
