'use client';

import { useState, useEffect, useRef, useMemo, KeyboardEvent } from 'react';
import { 
  Search, 
  X, 
  MapPin, 
  Building2, 
  Bus, 
  GraduationCap, 
  Hospital, 
  Landmark, 
  Sparkles, 
  Wrench, 
  Shield, 
  Coins, 
  Navigation,
  Loader2,
  Route,
  Home,
  Moon,
  Church
} from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api-config';

export type SearchItemType = 'place' | 'area' | 'municipality' | 'neighborhood' | 'street' | 'bus';

export interface SearchResultItem {
  type: SearchItemType;
  id: number;
  title: string;
  subtitle: string;
  icon?: string;
  coordinates: [number, number];
  category_slug?: string;
  level?: number;
  code?: string;
  boundary?: any;
  bbox?: [number, number, number, number];
  geometry?: any;
  highway_type?: string;
}

interface SearchGroupedData {
  municipalities?: SearchResultItem[];
  neighborhoods?: SearchResultItem[];
  streets?: SearchResultItem[];
  places?: SearchResultItem[];
  buses?: SearchResultItem[];
}

interface SearchCountsData {
  all?: number;
  municipalities?: number;
  neighborhoods?: number;
  streets?: number;
  places?: number;
  buses?: number;
}

interface SearchBarProps {
  onSelectResult: (item: SearchResultItem) => void;
  placeholder?: string;
  activeCategorySlug?: string | null;
}

type FilterTabKey = 'all' | 'admin' | 'streets' | 'places' | 'buses';

const DUAL_JOINING_ARABIC = new Set([
  'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'ي', 'ئ', 'ـ'
]);

const RIGHT_JOINING_ARABIC = new Set([
  'ا', 'أ', 'إ', 'آ', 'ٱ', 'د', 'ذ', 'ر', 'ز', 'و', 'ؤ', 'ى'
]);

function isArabicConnectingPair(c1: string, c2: string): boolean {
  if (!c1 || !c2) return false;
  const c1ConnectsForward = DUAL_JOINING_ARABIC.has(c1);
  const c2ConnectsBackward = DUAL_JOINING_ARABIC.has(c2) || RIGHT_JOINING_ARABIC.has(c2);
  return c1ConnectsForward && c2ConnectsBackward;
}

function normalizeForMatch(s: string): string {
  return s
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();
}

/**
 * دالة ذكية آمنة لإبراز الكلمات دون كسر اتصال الحروف العربية المتصلة (Ligature-Safe Highlighter)
 */
function renderHighlightedText(text: string, query: string) {
  if (!text || !query.trim()) return text;

  const normText = normalizeForMatch(text);
  const normQ = normalizeForMatch(query.trim());

  let index = normText.indexOf(normQ);
  let matchLen = normQ.length;

  if (index === -1) {
    const noSpaceQ = normQ.replace(/\s+/g, '');
    const noSpaceText = normText.replace(/\s+/g, '');
    const nsIdx = noSpaceText.indexOf(noSpaceQ);
    if (nsIdx !== -1) {
      index = 0;
      matchLen = text.length;
    }
  }

  if (index === -1) return text;

  const matchStart = index;
  const matchEnd = Math.min(text.length, index + matchLen);

  const before = text.substring(0, matchStart);
  const match = text.substring(matchStart, matchEnd);
  const after = text.substring(matchEnd);

  const connectsLeft = matchStart > 0 && isArabicConnectingPair(text[matchStart - 1], text[matchStart]);
  const connectsRight = matchEnd < text.length && isArabicConnectingPair(text[matchEnd - 1], text[matchEnd]);
  const isMidWord = connectsLeft || connectsRight;

  return (
    <>
      {before}
      {connectsLeft ? '\u200D' : ''}
      <span
        className={`text-[#064239] dark:text-emerald-300 font-extrabold bg-[#c8a76a]/25 dark:bg-amber-900/40 rounded-xs ${
          isMidWord ? 'px-0 mx-0 inline' : 'px-0.5'
        }`}
      >
        {connectsLeft ? '\u200D' : ''}
        {match}
        {connectsRight ? '\u200D' : ''}
      </span>
      {connectsRight ? '\u200D' : ''}
      {after}
    </>
  );
}

export default function DamasceneSearchBar({ 
  onSelectResult,
  placeholder,
  activeCategorySlug
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [grouped, setGrouped] = useState<SearchGroupedData>({});
  const [counts, setCounts] = useState<SearchCountsData>({ all: 0 });
  const [activeTab, setActiveTab] = useState<FilterTabKey>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // بحث فوري متجاوب مع تأخير خفيف (Debounce 220ms)
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setGrouped({});
      setCounts({ all: 0 });
      setLoading(false);
      setSelectedIndex(-1);
      return;
    }

    setLoading(true);
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const catQuery = activeCategorySlug ? `&category=${encodeURIComponent(activeCategorySlug)}` : '';
        const res = await fetch(`${getApiBaseUrl()}/search/?q=${encodeURIComponent(query.trim())}${catQuery}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setGrouped(data.grouped || {});
          setCounts(data.counts || { all: (data.results || []).length });
          setSelectedIndex(-1);
          setIsOpen(true);
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error('Search request failed:', e);
        }
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, activeCategorySlug]);

  // تصفية النتائج بحسب التبويب النشط
  const filteredResults = useMemo(() => {
    if (activeTab === 'all') return results;
    if (activeTab === 'admin') {
      return [
        ...(grouped.municipalities || []),
        ...(grouped.neighborhoods || [])
      ];
    }
    if (activeTab === 'streets') return grouped.streets || [];
    if (activeTab === 'places') return grouped.places || [];
    if (activeTab === 'buses') return grouped.buses || [];
    return results;
  }, [activeTab, results, grouped]);

  const handleSelect = (item: SearchResultItem) => {
    setIsOpen(false);
    onSelectResult(item);
  };

  // التحكم عبر لوحة المفاتيح
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredResults.length) {
        handleSelect(filteredResults[selectedIndex]);
      } else if (filteredResults.length > 0) {
        handleSelect(filteredResults[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const getIcon = (item: SearchResultItem) => {
    if (item.type === 'municipality') {
      return <Landmark className="w-4 h-4 text-[#c8a76a]" />;
    }
    if (item.type === 'neighborhood') {
      return <Home className="w-4 h-4 text-[#3a6962]" />;
    }
    if (item.type === 'street') {
      return <Route className="w-4 h-4 text-[#4338ca] dark:text-indigo-400" />;
    }
    if (item.type === 'area') {
      return <MapPin className="w-4 h-4 text-[#c8a76a]" />;
    }
    if (item.type === 'bus') {
      return <Bus className="w-4 h-4 text-[#3a6962]" />;
    }
    
    switch (item.category_slug) {
      case 'healthcare':
        return <Hospital className="w-4 h-4 text-[#e63946]" />;
      case 'education':
        return <GraduationCap className="w-4 h-4 text-[#1d3557]" />;
      case 'government':
        return <Landmark className="w-4 h-4 text-[#064239] dark:text-emerald-400" />;
      case 'religious':
        return <Moon className="w-4 h-4 text-[#0d9488]" />;
      case 'tourism':
        return <Sparkles className="w-4 h-4 text-[#c8a76a]" />;
      case 'public-services':
        return <Wrench className="w-4 h-4 text-[#457b9d]" />;
      case 'security':
        return <Shield className="w-4 h-4 text-[#04352e] dark:text-emerald-400" />;
      case 'economy':
        return <Coins className="w-4 h-4 text-[#2d6a4f]" />;
      default:
        return <Building2 className="w-4 h-4 text-[#064239] dark:text-emerald-400" />;
    }
  };

  const getBadge = (item: SearchResultItem) => {
    if (item.type === 'municipality') {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#c8a76a]/20 text-[#8a6827] dark:bg-amber-950/60 dark:text-amber-300 border border-[#c8a76a]/30">
          بلدية
        </span>
      );
    }
    if (item.type === 'neighborhood') {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#3a6962]/20 text-[#29514b] dark:bg-teal-950/60 dark:text-teal-300 border border-[#3a6962]/30">
          حي
        </span>
      );
    }
    if (item.type === 'street') {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-500/25">
          شارع
        </span>
      );
    }
    if (item.type === 'bus') {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#3a6962]/15 text-[#3a6962] dark:bg-teal-950/50 dark:text-teal-300 border border-[#3a6962]/20">
          خط باص
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#064239]/10 text-[#064239] dark:bg-emerald-950/50 dark:text-emerald-300 border border-[#064239]/15">
        منشأة
      </span>
    );
  };

  const adminCount = (counts.municipalities || 0) + (counts.neighborhoods || 0);

  return (
    <div ref={searchContainerRef} className="relative w-full max-w-lg z-30">
      {/* شريط الإدخال الرئيسي */}
      <div className="relative flex items-center bg-[#fdfbf7]/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-[#064239]/20 hover:border-[#064239]/40 focus-within:ring-2 focus-within:ring-[#064239]/20 focus-within:border-[#064239]/50 transition-all duration-200">
        <div className="pr-4 pl-2 text-[#064239] dark:text-emerald-400">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#064239] dark:text-emerald-400" />
          ) : (
            <Search className="w-5 h-5 text-[#064239] dark:text-emerald-400" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder || "ابحث عن بلدية، حي، شارع، منشأة، أو خط باص..."}
          aria-label="البحث في بلديات وأحياء وشوارع ومعالم دمشق"
          className="w-full py-2.5 sm:py-3.5 bg-transparent text-sm font-semibold text-[#064239] dark:text-zinc-100 placeholder:text-zinc-500/80 focus:outline-none text-right"
          dir="rtl"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setGrouped({});
              setCounts({ all: 0 });
              setActiveTab('all');
              setSelectedIndex(-1);
              setIsOpen(false);
            }}
            aria-label="مسح نص البحث"
            className="w-8 h-8 mx-1 text-zinc-400 hover:text-zinc-700 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* القائمة المنسدلة للنتائج المقترحة المنظمة */}
      {isOpen && results.length > 0 && (
        <div 
          className="absolute top-full mt-1.5 sm:mt-2 w-full bg-[#fdfbf7] dark:bg-zinc-900 rounded-2xl shadow-2xl border border-[#064239]/15 overflow-hidden max-h-[60vh] sm:max-h-[70vh] flex flex-col animate-in fade-in slide-in-from-top-2 duration-150"
          dir="rtl"
        >
          {/* تبويبات التصفية السريعة (Segmented Filter Tabs) لمنع فوضى النتائج */}
          <div className="flex items-center gap-1.5 p-2 border-b border-[#064239]/10 bg-[#f4eee1]/80 dark:bg-zinc-800/80 backdrop-blur-xs overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => { setActiveTab('all'); setSelectedIndex(-1); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-[#064239] text-white shadow-xs'
                  : 'bg-white/60 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700'
              }`}
            >
              الكل ({results.length})
            </button>

            {adminCount > 0 && (
              <button
                type="button"
                onClick={() => { setActiveTab('admin'); setSelectedIndex(-1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'admin'
                    ? 'bg-[#064239] text-white shadow-xs'
                    : 'bg-white/60 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700'
                }`}
              >
                البلديات والأحياء ({adminCount})
              </button>
            )}

            {(counts.streets || 0) > 0 && (
              <button
                type="button"
                onClick={() => { setActiveTab('streets'); setSelectedIndex(-1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'streets'
                    ? 'bg-[#064239] text-white shadow-xs'
                    : 'bg-white/60 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700'
                }`}
              >
                الشوارع ({counts.streets})
              </button>
            )}

            {(counts.places || 0) > 0 && (
              <button
                type="button"
                onClick={() => { setActiveTab('places'); setSelectedIndex(-1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'places'
                    ? 'bg-[#064239] text-white shadow-xs'
                    : 'bg-white/60 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700'
                }`}
              >
                المنشآت ({counts.places})
              </button>
            )}

            {(counts.buses || 0) > 0 && (
              <button
                type="button"
                onClick={() => { setActiveTab('buses'); setSelectedIndex(-1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'buses'
                    ? 'bg-[#064239] text-white shadow-xs'
                    : 'bg-white/60 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700'
                }`}
              >
                خطوط الباص ({counts.buses})
              </button>
            )}
          </div>

          {/* قائمة النتائج المصنفة */}
          <div className="p-1.5 sm:p-2 space-y-1 overflow-y-auto overscroll-contain flex-1">
            {filteredResults.map((item, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <button
                  key={`${item.type}-${item.id}-${idx}`}
                  type="button"
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-xl transition-all text-right cursor-pointer group min-h-[44px] ${
                    isSelected 
                      ? 'bg-[#ede5d3] dark:bg-zinc-800 shadow-xs ring-1 ring-[#064239]/20' 
                      : 'hover:bg-[#f3eddf]/70 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white dark:bg-zinc-800 border border-black/5 flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                      {getIcon(item)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-extrabold text-[#064239] dark:text-zinc-100 group-hover:text-[#04352e] dark:group-hover:text-emerald-300 truncate">
                        {renderHighlightedText(item.title, query)}
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pr-2">
                    {getBadge(item)}
                    <Navigation className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-[#064239] dark:group-hover:text-emerald-400 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* حالة لا توجد نتائج */}
      {isOpen && query.trim().length >= 2 && results.length === 0 && !loading && (
        <div 
          className="absolute top-full mt-2 w-full bg-[#fdfbf7] dark:bg-zinc-900 rounded-2xl shadow-xl border border-[#064239]/15 p-4 text-center text-sm font-medium text-zinc-500"
          dir="rtl"
        >
          لم يتم العثور على نتائج تطابق &quot;{query}&quot; في دمشق
        </div>
      )}
    </div>
  );
}
