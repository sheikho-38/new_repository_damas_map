'use client';

import React, { useState, useMemo } from 'react';
import { 
  Bus, 
  X, 
  Search, 
  ArrowLeftRight, 
  Clock, 
  Coins, 
  Route, 
  MapPin, 
  Navigation,
  ChevronLeft,
  EyeOff,
  Compass
} from 'lucide-react';

export interface TransitStop {
  id: number;
  name: string;
  coordinates: [number, number]; // [lon, lat]
  is_start?: boolean;
  is_destination?: boolean;
}

export interface TransitLine {
  id: number;
  route_id: number;
  name: string;
  name_en?: string;
  code: string;
  color: string;
  group_id: string;
  group_title: string;
  corridor: string;
  corridor_slug: string;
  direction: 'outbound' | 'inbound';
  direction_name: string;
  start_terminal: {
    name: string;
    coordinates: [number, number];
  };
  destination_terminal: {
    name: string;
    coordinates: [number, number];
  };
  stops: TransitStop[];
  stops_count: number;
  cost: number;
  length_km: number;
  trip_time_mins: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

interface TransitDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lines: TransitLine[];
  selectedLine: TransitLine | null;
  onSelectLine: (line: TransitLine | null) => void;
  onSelectStop: (stop: TransitStop) => void;
}

export default function TransitDrawer({
  isOpen,
  onClose,
  lines,
  selectedLine,
  onSelectLine,
  onSelectStop,
}: TransitDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCorridor, setSelectedCorridor] = useState<string>('all');

  // استخراج المحاور الفريدة للفلترة
  const corridors = useMemo(() => {
    const map = new Map<string, string>();
    lines.forEach((l) => {
      if (l.corridor_slug && l.corridor) {
        map.set(l.corridor_slug, l.corridor);
      }
    });
    return Array.from(map.entries()).map(([slug, label]) => ({ slug, label }));
  }, [lines]);

  // فلترة الخطوط حسب البحث والمحور
  const filteredLines = useMemo(() => {
    return lines.filter((line) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        line.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        line.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        line.start_terminal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        line.destination_terminal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        line.stops.some((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCorridor =
        selectedCorridor === 'all' || line.corridor_slug === selectedCorridor;

      return matchSearch && matchCorridor;
    });
  }, [lines, searchQuery, selectedCorridor]);

  // العثور على الخط العكسي (الاتجاه المقابل) لنفس المسار إن وجد
  const counterpartLine = useMemo(() => {
    if (!selectedLine) return null;
    return lines.find(
      (l) => l.group_id === selectedLine.group_id && l.direction !== selectedLine.direction
    );
  }, [lines, selectedLine]);

  if (!isOpen) return null;

  return (
    <>
      {/* خلفية التعتيم للهواتف المحمولة */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 sm:hidden animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* لوحة مستكشف النقل العام (Desktop: كارت عائم على اليمين | Mobile: درج سفلي كامل) */}
      <div
        className="fixed sm:absolute bottom-0 sm:bottom-auto sm:top-20 inset-x-0 sm:inset-x-auto sm:right-4 z-50 sm:w-96 bg-[#fdfbf7] dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#064239]/20 dark:border-white/10 flex flex-col max-h-[75dvh] sm:max-h-[calc(100vh-6.5rem)] pb-safe sm:pb-0 overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom sm:slide-in-from-right"
        dir="rtl"
      >
        {/* ترويسة اللوحة العلوية */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-black/5 dark:border-white/5 bg-[#064239]/5 dark:bg-white/5 select-none shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#064239] text-[#ecc988] flex items-center justify-center shadow-xs">
              <Bus className="w-5 h-5 text-[#c8a76a]" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#064239] dark:text-zinc-100 flex items-center gap-1.5">
                <span>شبكة باصات وسرافيس دمشق</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h2>
              <p className="text-[11px] text-zinc-500 font-semibold">
                {selectedLine ? 'استعراض المسار والمحطات بالتفصيل' : 'اختر خطاً لعرض مساره ومواقفه'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors cursor-pointer"
            title="إغلاق لوحة المواصلات"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* جسم اللوحة: إما وضع تفاصيل الخط المختار أو وضع قائمة تصفح الخطوط */}
        {selectedLine ? (
          /* ============================================================== */
          /* وضع تفاصيل الخط المختار (Selected Route Focus View) */
          /* ============================================================== */
          <div className="overflow-y-auto p-4 space-y-4 flex-1">
            {/* زر العودة لقائمة الخطوط مع إمكانية مسح التحديد */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onSelectLine(null)}
                className="flex items-center gap-1 text-xs font-bold text-[#064239] dark:text-emerald-400 hover:underline cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 rotate-180" />
                <span>العودة لكافة خطوط دمشق</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectLine(null)}
                className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-800/40 cursor-pointer transition-colors"
                title="إخفاء الخط من الخريطة"
              >
                <EyeOff className="w-3 h-3" />
                <span>إخفاء المسار</span>
              </button>
            </div>

            {/* بطاقة هوية الخط الرئيسي */}
            <div 
              className="p-3.5 rounded-2xl bg-white dark:bg-zinc-800 border shadow-xs relative overflow-hidden"
              style={{ borderColor: `${selectedLine.color}40` }}
            >
              <div 
                className="absolute top-0 right-0 w-1.5 inset-y-0"
                style={{ backgroundColor: selectedLine.color }}
              />
              <div className="flex items-start justify-between gap-2 mr-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span 
                      className="px-2 py-0.5 rounded-md text-[10px] font-black text-white"
                      style={{ backgroundColor: selectedLine.color }}
                    >
                      {selectedLine.code}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#064239]/10 text-[#064239] dark:text-emerald-300">
                      {selectedLine.corridor}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white mt-1.5">
                    {selectedLine.name}
                    <span className="block text-xs font-semibold mt-1">{selectedLine.direction_name}</span>
                  </h3>
                </div>
              </div>

              {/* شريط الإحصائيات السريعة للخط */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-black/5 dark:border-white/5 text-center">
                <div className="bg-[#f7f4ed] dark:bg-zinc-900/60 p-2 rounded-xl">
                  <div className="flex items-center justify-center gap-1 text-zinc-400 text-[10px]">
                    <Coins className="w-3 h-3 text-[#c8a76a]" />
                    <span>التعرفة</span>
                  </div>
                  <span className="text-xs font-black text-[#064239] dark:text-emerald-400">
                    {selectedLine.cost} ل.س
                  </span>
                </div>
                <div className="bg-[#f7f4ed] dark:bg-zinc-900/60 p-2 rounded-xl">
                  <div className="flex items-center justify-center gap-1 text-zinc-400 text-[10px]">
                    <Clock className="w-3 h-3 text-sky-500" />
                    <span>الزمن</span>
                  </div>
                  <span className="text-xs font-black text-zinc-700 dark:text-zinc-200">
                    ~{selectedLine.trip_time_mins} د
                  </span>
                </div>
                <div className="bg-[#f7f4ed] dark:bg-zinc-900/60 p-2 rounded-xl">
                  <div className="flex items-center justify-center gap-1 text-zinc-400 text-[10px]">
                    <Route className="w-3 h-3 text-emerald-500" />
                    <span>المسافة</span>
                  </div>
                  <span className="text-xs font-black text-zinc-700 dark:text-zinc-200">
                    {Math.round(selectedLine.length_km)} كم
                  </span>
                </div>
              </div>
            </div>

            {/* زر تبديل الاتجاه (ذهاب ⇄ إياب) إن وجد مسار مقابل */}
            {counterpartLine && (
              <button
                type="button"
                onClick={() => onSelectLine(counterpartLine)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-l from-[#064239]/10 to-[#c8a76a]/15 hover:from-[#064239]/20 hover:to-[#c8a76a]/25 text-[#064239] dark:text-emerald-300 font-bold text-xs border border-[#064239]/20 transition-all cursor-pointer active:scale-98"
              >
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-[#c8a76a]" />
                  <span>عكس اتجاه الرحلة ({counterpartLine.direction === 'outbound' ? 'ذهاب' : 'إياب'})</span>
                </div>
                <span className="text-[11px] font-mono text-zinc-500">
                  {counterpartLine.code}
                </span>
              </button>
            )}
            {counterpartLine && <p className="text-[11px] text-zinc-500">المسار المحدد بخط متصل، والاتجاه المقابل بخط متقطع.</p>}

            {/* المخطط الزمني لمحطات ومواقف الخط (Stop-by-Stop Timeline) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-500 px-1">
                <span>المسار والمواقف ({selectedLine.stops.length})</span>
                <span className="text-[10px] text-zinc-400">انقر على الموقف للتحليق إليه</span>
              </div>

              <div className="relative pl-1 pr-2 py-1 space-y-3 before:absolute before:right-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-black/10 dark:before:bg-white/10">
                {selectedLine.stops.map((stop, idx) => {
                  const isStart = idx === 0;
                  const isEnd = idx === selectedLine.stops.length - 1;

                  return (
                    <div
                      key={stop.id || idx}
                      onClick={() => onSelectStop(stop)}
                      className="relative flex items-center gap-3 pr-6 group cursor-pointer"
                    >
                      {/* الدائرة الدلالية للموقف */}
                      <div
                        className={`absolute right-2.5 w-3.5 h-3.5 rounded-full border-2 transition-all group-hover:scale-125 z-10 flex items-center justify-center ${
                          isStart
                            ? 'bg-emerald-500 border-white ring-2 ring-emerald-500/30'
                            : isEnd
                            ? 'bg-[#c8a76a] border-white ring-2 ring-[#c8a76a]/30'
                            : 'bg-white dark:bg-zinc-800 border-[#064239] dark:border-emerald-400'
                        }`}
                      >
                        {isStart && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        {isEnd && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                      </div>

                      {/* بطاقة الموقف */}
                      <div className="flex-1 p-2 rounded-xl bg-white/70 dark:bg-zinc-800/70 border border-black/5 dark:border-white/5 group-hover:bg-[#f7f4ed] dark:group-hover:bg-zinc-800 group-hover:border-[#064239]/30 transition-all flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-zinc-400 w-4">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
                              {stop.name}
                            </span>
                            {isStart && (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block">
                                نقطة الانطلاق الأولى
                              </span>
                            )}
                            {isEnd && (
                              <span className="text-[10px] font-bold text-[#b45309] dark:text-[#c8a76a] block">
                                محطة الوصول النهائية
                              </span>
                            )}
                          </div>
                        </div>
                        <Navigation className="w-3.5 h-3.5 text-zinc-300 group-hover:text-[#064239] dark:group-hover:text-emerald-400 transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* وضع استعراض وتصفية الخطوط (Line List & Corridor Filters) */
          /* ============================================================== */
          <div className="overflow-y-auto p-4 space-y-3.5 flex-1">
            {/* حقل البحث السريع */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الخط، المحور، أو المحطة..."
                className="w-full pl-3 pr-9 py-2 text-xs rounded-xl bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#064239] dark:focus:ring-emerald-400 text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400"
              />
              <Search className="w-4 h-4 text-zinc-400 absolute right-3 top-2.5" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-2.5 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* أزرار تصفية المحاور الجغرافية (Corridors Pills) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setSelectedCorridor('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedCorridor === 'all'
                    ? 'bg-[#064239] text-white shadow-xs'
                    : 'bg-black/5 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 hover:bg-black/10'
                }`}
              >
                كافة المحاور ({lines.length})
              </button>
              {corridors.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setSelectedCorridor(c.slug)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedCorridor === c.slug
                      ? 'bg-[#064239] text-white shadow-xs'
                      : 'bg-black/5 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 hover:bg-black/10'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* قائمة بطاقات الخطوط */}
            <div className="space-y-2 pt-1">
              {filteredLines.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-xs">
                  لا توجد خطوط مطابقة لمعايير البحث
                </div>
              ) : (
                filteredLines.map((line) => (
                  <div
                    key={line.route_id}
                    onClick={() => onSelectLine(line)}
                    className="p-3 rounded-2xl bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/5 hover:border-[#064239]/40 hover:shadow-md transition-all cursor-pointer group active:scale-98 relative overflow-hidden"
                  >
                    <div 
                      className="absolute top-0 right-0 w-1.5 inset-y-0"
                      style={{ backgroundColor: line.color }}
                    />
                    <div className="mr-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span 
                            className="px-2 py-0.5 rounded-md text-[10px] font-black text-white"
                            style={{ backgroundColor: line.color }}
                          >
                            {line.code}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-400">
                            {line.corridor}
                          </span>
                        </div>
                        <span className="text-[11px] font-black text-[#064239] dark:text-emerald-400 font-mono">
                          {line.cost} ل.س
                        </span>
                      </div>

                      <h4 className="text-xs font-black text-zinc-800 dark:text-zinc-100 mt-1.5 group-hover:text-[#064239] dark:group-hover:text-emerald-400 transition-colors">
                        {line.name}
                        <span className="mr-2 text-[#064239]">{line.direction_name}</span>
                      </h4>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5 dark:border-white/5 text-[10px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-600" />
                          <span>{line.start_terminal.name.split('/')[0]}</span>
                          <span className="text-zinc-300">⬅</span>
                          <span>{line.destination_terminal.name.split('/')[0]}</span>
                        </span>
                        <span className="font-mono text-zinc-400">
                          {line.stops_count} مواقف
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
