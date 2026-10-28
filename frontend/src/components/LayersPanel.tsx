'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  Hospital, 
  GraduationCap, 
  Landmark, 
  Sparkles, 
  Wrench, 
  Shield, 
  Coins, 
  Bus, 
  Eye, 
  EyeOff,
  X,
  Moon,
  Church
} from 'lucide-react';

export interface SubcategoryInfo {
  id: number;
  slug: string;
  name_ar: string;
  name_en?: string;
  icon?: string;
  is_private?: boolean;
}

export interface CategoryInfo {
  id: number;
  slug: string;
  name_ar: string;
  name_en: string;
  icon: string;
  sort_order: number;
  places_count: number;
  subcategories?: SubcategoryInfo[];
}

interface LayersPanelProps {
  categories: CategoryInfo[];
  selectedCategories: string[];
  onToggleCategory: (slug: string) => void;
  onToggleAll: (selectAll: boolean) => void;
  showAdminAreas: boolean;
  onToggleAdminAreas: () => void;
  adminLevelFilter?: 'all' | '9' | '10';
  onChangeAdminLevel?: (lvl: 'all' | '9' | '10') => void;
  selectedMunicipalityName?: string;
  selectedNeighborhoodName?: string;
  onResetAdminHierarchy?: () => void;
  showTransitLines: boolean;
  onToggleTransitLines: () => void;
}

export default function LayersPanel({
  categories,
  selectedCategories,
  onToggleCategory,
  onToggleAll,
  showAdminAreas,
  onToggleAdminAreas,
  adminLevelFilter = 'all',
  onChangeAdminLevel,
  selectedMunicipalityName,
  selectedNeighborhoodName,
  onResetAdminHierarchy,
  showTransitLines,
  onToggleTransitLines,
}: LayersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getCategoryIcon = (slug: string) => {
    switch (slug) {
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
      case 'transportation':
        return <Bus className="w-4 h-4 text-[#3a6962]" />;
      default:
        return <Layers className="w-4 h-4 text-[#064239] dark:text-emerald-400" />;
    }
  }; 

  const renderSections = () => (
    <>
      {/* قسم 1: التقسيمات الإدارية */}
      <div className="bg-[#f7f4ed] dark:bg-zinc-800/60 p-3 rounded-xl border border-black/5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#064239] dark:text-emerald-400">
            التقسيمات الإدارية الرسمية
          </span>
          <button
            type="button"
            onClick={onToggleAdminAreas}
            className={`text-[11px] px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer min-h-[32px] ${
              showAdminAreas 
                ? 'bg-[#064239] text-white shadow-xs' 
                : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
            }`}
          >
            {showAdminAreas ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showAdminAreas ? 'ظاهرة' : 'مخفية'}</span>
          </button>
        </div>

        {showAdminAreas && (
          <div className="text-[11px] p-2.5 rounded-xl bg-white/80 dark:bg-zinc-900/60 border border-black/5 dark:border-white/5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#064239] dark:text-emerald-300">
                {selectedMunicipalityName ? selectedMunicipalityName : 'مستوى بلديات دمشق (16)'}
              </span>
              {selectedMunicipalityName && onResetAdminHierarchy && (
                <button
                  type="button"
                  onClick={onResetAdminHierarchy}
                  className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline font-bold cursor-pointer"
                >
                  العودة للبلديات
                </button>
              )}
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {selectedNeighborhoodName 
                ? `الحي النشط: ${selectedNeighborhoodName}`
                : selectedMunicipalityName
                  ? 'انقر على أي حي لتقريب الخريطة إليه'
                  : 'انقر على أي بلدية في الخريطة لفتح أحيائها وعزلها'}
            </p>
          </div>
        )}
      </div>

      {/* قسم 2: مسارات النقل والباصات */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-[#f7f4ed] dark:bg-zinc-800/60 border border-black/5">
        <div className="flex items-center gap-2.5">
          <Bus className="w-4 h-4 text-[#064239] dark:text-emerald-400" />
          <div>
            <span className="text-xs font-bold text-[#064239] dark:text-zinc-200 block">
              شبكة باصات وسرافيس دمشق
            </span>
            <span className="text-[10px] text-zinc-400 block mt-0.5">
              11 خطاً ومحاور دمشق المعتمدة
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onToggleTransitLines();
            setIsMobileOpen(false);
          }}
          className={`text-[11px] px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer min-h-[32px] ${
            showTransitLines 
              ? 'bg-[#064239] text-white shadow-xs' 
              : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
          }`}
        >
          <Bus className="w-3.5 h-3.5" />
          <span>{showTransitLines ? 'مفتوحة' : 'استعراض'}</span>
        </button>
      </div>

      {/* قسم 3: طبقات المنشآت والـ POIs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-zinc-500">
            منشآت ونقاط الاهتمام
          </span>
          {selectedCategories.length > 0 ? (
            <button 
              type="button" 
              onClick={() => onToggleAll(false)}
              className="text-[11px] text-[#064239] dark:text-emerald-400 font-bold hover:underline cursor-pointer"
            >
              إلغاء التحديد
            </button>
          ) : (
            <span className="text-[10px] text-zinc-400">
              اختر تصنيفاً واحداً
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          {categories.map((cat) => {
            const isSelected = selectedCategories.includes(cat.slug);
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => onToggleCategory(cat.slug)}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer text-right min-h-[44px] ${
                  isSelected 
                    ? 'bg-white dark:bg-zinc-800 shadow-xs border border-black/5 dark:border-white/10' 
                    : 'hover:bg-black/5 dark:hover:bg-zinc-800/60 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                    style={{ 
                      backgroundColor: isSelected ? '#06423918' : '#e4e4e7',
                    }}
                  >
                    {getCategoryIcon(cat.slug)}
                  </div>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    {cat.name_ar}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                    isSelected 
                      ? 'border-2 border-[#064239] dark:border-emerald-400 bg-transparent' 
                      : 'border border-zinc-300 dark:border-zinc-600'
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-[#064239] dark:bg-emerald-400" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* زر عائم مخصص للهواتف المحمولة (Mobile Floating Pill Trigger) */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="sm:hidden flex items-center gap-2 px-3.5 py-2.5 bg-[#fdfbf7]/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-[#064239]/20 text-xs font-bold text-[#064239] dark:text-zinc-200 active:scale-95 transition-all cursor-pointer"
        title="فتح طبقات الخريطة"
      >
        <div className="w-6 h-6 rounded-lg bg-[#064239] text-[#f7f4ed] flex items-center justify-center shadow-xs">
          <Layers className="w-3.5 h-3.5" />
        </div>
        <span>طبقات الخريطة</span>
        {(selectedCategories.length > 0 || showAdminAreas) && (
          <span className="w-2 h-2 rounded-full bg-[#c8a76a] animate-pulse" />
        )}
      </button>

      {/* النافذة السفلية للهواتف المحمولة (Mobile Bottom Sheet) - Portaled to document.body */}
      {isMobileOpen && mounted && typeof document !== 'undefined' && createPortal(
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 sm:hidden animate-in fade-in duration-200"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
          <div 
            className="fixed inset-x-0 bottom-0 z-50 max-h-[72dvh] sm:max-h-[75dvh] bg-[#fdfbf7] dark:bg-zinc-900 rounded-t-3xl shadow-2xl border-t border-[#064239]/20 flex flex-col pb-safe overflow-hidden animate-in slide-in-from-bottom duration-300 sm:hidden"
            dir="rtl"
          >
            {/* مقبض السحب */}
            <div className="w-12 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto my-3 shrink-0" />
            
            {/* الترويسة */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5 bg-[#fdfbf7] dark:bg-zinc-900 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#064239] text-[#f7f4ed] flex items-center justify-center shadow-xs">
                  <Layers className="w-4 h-4 text-[#c8a76a]" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#064239] dark:text-zinc-100">
                    طبقات الخريطة الذكية
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    {selectedCategories.length === 0
                      ? 'الخريطة نقية • اختر أي قطاع لعرضه'
                      : `معروض: ${categories.find((c) => c.slug === selectedCategories[0])?.name_ar || 'قطاع محدد'}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center text-zinc-600 dark:text-zinc-300 cursor-pointer transition-colors"
                title="إغلاق اللوحة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* محتوى اللوحة التفاعلي */}
            <div className="overflow-y-auto p-4 space-y-4 overscroll-contain">
              {renderSections()}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* لوحة سطح المكتب الكلاسيكية (Desktop Sidebar Card) */}
      <div 
        className="hidden sm:block bg-[#fdfbf7]/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-3xl shadow-2xl border border-[#064239]/20 dark:border-white/10 w-80 overflow-hidden transition-all duration-200"
        dir="rtl"
      >
        {/* ترويسة اللوحة */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 select-none border-b border-black/5 dark:border-white/5"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#064239] text-[#f7f4ed] flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#064239] dark:text-zinc-100">
                طبقات الخريطة الذكية
              </h3>
              <p className="text-[11px] text-zinc-500 font-medium">
                {selectedCategories.length === 0
                  ? 'الخريطة نقية • اختر أي قطاع لعرضه'
                  : `معروض: ${categories.find((c) => c.slug === selectedCategories[0])?.name_ar || 'قطاع محدد'}`}
              </p>
            </div>
          </div>

          <button type="button" className="text-zinc-400 p-1 cursor-pointer">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* محتوى اللوحة القابل للطي */}
        {isExpanded && (
          <div className="p-3 space-y-4 max-h-[65vh] overflow-y-auto">
            {renderSections()}
          </div>
        )}
      </div>
    </>
  );
}
