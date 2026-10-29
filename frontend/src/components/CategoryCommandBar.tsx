'use client';

import React, { useRef } from 'react';
import { 
  Hospital, 
  GraduationCap, 
  Landmark, 
  Sparkles, 
  Wrench, 
  Shield, 
  Coins, 
  Bus, 
  MapPin, 
  ChevronRight,
  Check,
  Moon,
  Trees
} from 'lucide-react';
import { CategoryInfo, SubcategoryInfo } from './LayersPanel';

interface CategoryCommandBarProps {
  categories: CategoryInfo[];
  selectedCategorySlug: string | null;
  selectedSubcategorySlug: string | null;
  selectedSectorSlug: string | null;
  sectors: Array<{ slug: string; label: string }>;
  onSelectCategory: (slug: string | null) => void;
  onSelectSubcategory: (subSlug: string | null) => void;
  onSelectSector: (sectorSlug: string | null) => void;
}

export default function CategoryCommandBar({
  categories,
  selectedCategorySlug,
  selectedSubcategorySlug,
  selectedSectorSlug,
  sectors,
  onSelectCategory,
  onSelectSubcategory,
  onSelectSector,
}: CategoryCommandBarProps) {
  const displayCategories = categories;
  const activeCategory = categories.find((c) => c.slug === selectedCategorySlug);
  const subScrollRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  const getCategoryIcon = (slug: string, className = "w-3.5 h-3.5") => {
    switch (slug) {
      case 'culture': return <Landmark className={className} />;
      case 'public-facilities': return <Trees className={className} />;
      case 'healthcare': return <Hospital className={className} />;
      case 'education': return <GraduationCap className={className} />;
      case 'government': return <Landmark className={className} />;
      case 'religious': return <Moon className={className} />;
      case 'tourism': return <Sparkles className={className} />;
      case 'transportation': return <Bus className={className} />;
      case 'public-services': return <Wrench className={className} />;
      case 'security': return <Shield className={className} />;
      case 'economy': return <Coins className={className} />;
      default: return <MapPin className={className} />;
    }
  };

  return (
    <div className="w-full h-10 sm:h-11 flex items-center justify-center relative select-none">
      {/* المستوى 2: تفريعات التصنيف النشط (Subcategories Drill-Down) — أزرار ثابتة + تفريعات متمركزة تماماً فوق البحث */}
      {activeCategory ? (
        <div className="flex items-center gap-1.5 sm:gap-2 px-1 max-w-full w-max mx-auto h-full select-none" dir="rtl">
          {/* زر العودة ثابت أثناء تمرير الفئات الفرعية */}
          <div className="flex items-center gap-1.5 shrink-0 z-10">
            {/* زر العودة لكافة الفئات الرئيسية */}
            <button
              type="button"
              onClick={() => {
                onSelectCategory(null);
                onSelectSubcategory(null);
              }}
              className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-[#c8a76a] hover:bg-[#c8a76a]/10 flex items-center justify-center cursor-pointer active:scale-95 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c8a76a]"
              title="العودة لعرض كافة الفئات"
              aria-label="العودة لعرض كافة الفئات"
            >
              <ChevronRight className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>

          {/* فاصل رأسي أنيق بين الأزرار الثابتة وقائمة التمرير */}
          <div className="h-5 w-px bg-[#064239]/15 dark:bg-white/10 shrink-0" />

          {/* شريط التصنيفات الفرعية القابل للتمرير بأريحية تامة دون إخفاء الأزرار الثابتة */}
          <div 
            ref={subScrollRef}
            onWheel={(e) => {
              if (e.deltaY !== 0 && subScrollRef.current) {
                subScrollRef.current.scrollLeft += e.deltaY;
              }
            }}
            className="flex-1 min-w-0 h-full flex items-center overflow-x-auto no-scrollbar scroll-smooth overscroll-x-contain touch-pan-x"
            dir="rtl"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 px-1 min-w-max justify-start py-0.5">
              {selectedSubcategorySlug && sectors.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => onSelectSector(null)}
                    aria-pressed={selectedSectorSlug === null}
                    className={`shrink-0 h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                      selectedSectorSlug === null
                        ? 'bg-[#064239] text-[#f7f4ed] ring-2 ring-[#c8a76a] scale-[1.02]'
                        : 'bg-[#fdfbf7]/95 dark:bg-zinc-900/95 text-zinc-700 dark:text-zinc-200 border border-[#064239]/15 hover:bg-[#edebe0] hover:text-[#064239]'
                    }`}
                  >
                    {selectedSectorSlug === null && <Check className="w-3.5 h-3.5 text-[#ecc988]" />}
                    <span>كل القطاعات</span>
                  </button>
                  {sectors.map((sector) => {
                    const isSectorSelected = selectedSectorSlug === sector.slug;
                    return (
                      <button
                        key={sector.slug}
                        type="button"
                        aria-pressed={isSectorSelected}
                        onClick={() => onSelectSector(isSectorSelected ? null : sector.slug)}
                        className={`shrink-0 h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                          isSectorSelected
                            ? 'bg-[#064239] text-[#f7f4ed] ring-2 ring-[#c8a76a] scale-[1.02]'
                            : 'bg-[#fdfbf7]/95 dark:bg-zinc-900/95 text-zinc-700 dark:text-zinc-200 border border-[#064239]/15 hover:bg-[#edebe0] hover:text-[#064239]'
                        }`}
                      >
                        {isSectorSelected && <Check className="w-3.5 h-3.5 text-[#ecc988]" />}
                        <span>{sector.label}</span>
                      </button>
                    );
                  })}
                </>
              ) : <button
                type="button"
                onClick={() => onSelectSubcategory(null)}
                aria-pressed={selectedSubcategorySlug === null}
                className={`shrink-0 h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  selectedSubcategorySlug === null
                    ? 'bg-[#064239] text-[#f7f4ed] ring-2 ring-[#c8a76a] scale-[1.02]'
                    : 'bg-[#fdfbf7]/95 dark:bg-zinc-900/95 text-zinc-700 dark:text-zinc-200 border border-[#064239]/15 hover:bg-[#edebe0] hover:text-[#064239]'
                }`}
              >
                {selectedSubcategorySlug === null && <Check className="w-3.5 h-3.5 text-[#ecc988]" />}
                <span>الكل</span>
              </button>}
              {(!selectedSubcategorySlug || sectors.length === 0) && activeCategory.subcategories && activeCategory.subcategories.map((sub: SubcategoryInfo) => {
                const isSubSelected = selectedSubcategorySlug === sub.slug;
                return (
                  <button
                    key={sub.slug}
                    type="button"
                    aria-pressed={isSubSelected}
                    onClick={() => onSelectSubcategory(isSubSelected ? null : sub.slug)}
                    className={`shrink-0 h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                      isSubSelected
                        ? 'bg-[#064239] text-[#f7f4ed] ring-2 ring-[#c8a76a] scale-[1.02]'
                        : 'bg-[#fdfbf7]/95 dark:bg-zinc-900/95 text-zinc-700 dark:text-zinc-200 border border-[#064239]/15 hover:bg-[#edebe0] hover:text-[#064239]'
                    }`}
                  >
                    {isSubSelected && <Check className="w-3.5 h-3.5 text-[#ecc988]" />}
                    <span>{sub.name_ar}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* المستوى 1: الفئات الثمانية الرئيسية — متمركزة تماماً فوق البحث بدون أي انزياح */
        <div 
          ref={mainScrollRef}
          onWheel={(e) => {
            if (e.deltaY !== 0 && mainScrollRef.current) {
              mainScrollRef.current.scrollLeft += e.deltaY;
            }
          }}
          className="w-full h-full flex items-center overflow-x-auto no-scrollbar scroll-smooth px-1 overscroll-x-contain touch-pan-x"
          dir="rtl"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 px-1 sm:px-2 min-w-max justify-start sm:justify-center sm:mx-auto py-0.5">
            {displayCategories.map((cat) => {
              const shortName = cat.name_ar;
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => onSelectCategory(cat.slug)}
                  className="shrink-0 h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl bg-white/35 text-[#064239] border border-transparent hover:border-white hover:bg-white/80 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 group whitespace-nowrap"
                  title={cat.name_ar}
                >
                  <span className="text-[#064239] group-hover:scale-110 transition-transform">
                    {getCategoryIcon(cat.slug, "w-3.5 h-3.5 sm:w-4 sm:h-4")}
                  </span>
                  <span className="text-xs font-extrabold whitespace-nowrap">
                    {shortName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
