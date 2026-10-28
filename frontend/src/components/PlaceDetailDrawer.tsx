'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Phone, 
  Smartphone,
  Hash,
  MessageCircle,
  Mail,
  Globe, 
  Clock, 
  Navigation, 
  CheckCircle2, 
  Share2, 
  Send,
  Building2,
  Hospital,
  GraduationCap,
  Landmark,
  Sparkles,
  Wrench,
  Shield,
  Coins,
  Bus,
  ExternalLink,
  Info,
  ChevronDown,
  Video,
  ImageIcon,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Moon,
  Church
} from 'lucide-react';
import { getAssetPath } from '@/lib/api-config';

export interface PlaceDetailData {
  id: number;
  title: string;
  title_en?: string;
  description?: string;
  sector?: 'public' | 'private' | 'joint' | string;
  sector_label?: string;
  category: {
    id: number;
    name_ar: string;
    slug: string;
    icon: string;
  };
  sub_category?: {
    name_ar: string;
    icon?: string;
    is_private: boolean;
  };
  location: {
    latitude: number;
    longitude: number;
    address_text: string;
    neighborhood: string;
    municipality: string;
  };
  contact: {
    phone?: string;
    mobile?: string;
    short_number?: string;
    whatsapp?: string;
    email?: string;
    website?: string;
    social_media?: Record<string, string>;
    opening_hours?: any;
  };
  is_verified: boolean;
  media: Array<{
    id: number;
    url: string;
    type: string;
    caption?: string;
    is_cover: boolean;
  }>;
}

interface PlaceDetailDrawerProps {
  place: PlaceDetailData | null;
  onClose: () => void;
  onStartRouting: (destination: { lat: number; lon: number; title: string }) => void;
  onZoomToPlace: (lat: number, lon: number) => void;
  onSelectNeighborhood?: (neighborhoodName: string) => void;
}

const DEFAULT_PLACEHOLDERS: Record<string, string> = {
  healthcare: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=800&q=80',
  education: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=800&q=80',
  government: getAssetPath('/damascus_government_cover.png'),
  religious: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Umayyad_Mosque%2C_Damascus.jpg',
  tourism: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=800&q=80',
  'public-services': 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
  security: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=800&q=80',
  economy: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80',
  transportation: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=800&q=80',
  default: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Umayyad_Mosque%2C_Damascus.jpg',
};

function translateHoursString(raw: string): string {
  let s = raw.trim();
  if (s === '24/7' || s.toLowerCase() === '24 hours') {
    return 'مفتوح على مدار 24 ساعة (طيلة أيام الأسبوع)';
  }
  const dayMap: Record<string, string> = {
    'Mo-Su': 'طيلة أيام الأسبوع',
    'Sa-Th': 'من السبت إلى الخميس',
    'Su-Th': 'من الأحد إلى الخميس',
    'Mo-Sa': 'من الإثنين إلى السبت',
    'Mo-Fr': 'من الإثنين إلى الجمعة',
    'Sa-Fr': 'طيلة أيام الأسبوع',
    'Sa': 'السبت', 'Su': 'الأحد', 'Mo': 'الإثنين', 'Tu': 'الثلاثاء',
    'We': 'الأربعاء', 'Th': 'الخميس', 'Fr': 'الجمعة',
  };
  for (const [en, ar] of Object.entries(dayMap)) {
    s = s.replace(new RegExp(`\\b${en}\\b`, 'g'), ar);
  }
  s = s.replace(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g, (_, h1, m1, h2, m2) => {
    const parseHour = (h: string, m: string) => {
      const num = parseInt(h, 10);
      const period = num >= 12 ? 'مساءً' : 'صباحاً';
      const formattedNum = num > 12 ? num - 12 : num === 0 ? 12 : num;
      const minStr = m === '00' ? '' : `:${m}`;
      return `${formattedNum}${minStr} ${period}`;
    };
    return `من ${parseHour(h1, m1)} حتى ${parseHour(h2, m2)}`;
  });
  return s;
}

function formatOpeningHours(hours: any): string | null {
  if (!hours) return null;
  if (typeof hours === 'string') {
    const trimmed = hours.trim();
    return trimmed && trimmed !== '{}' ? translateHoursString(trimmed) : null;
  }
  if (typeof hours === 'object') {
    if (Object.keys(hours).length === 0) return null;
    if (hours.description && typeof hours.description === 'string' && hours.description.trim()) {
      return hours.description.trim();
    }
    if (hours.regular && typeof hours.regular === 'string' && hours.regular.trim()) {
      return translateHoursString(hours.regular.trim());
    }
    if (hours.hours && typeof hours.hours === 'string' && hours.hours.trim()) {
      return translateHoursString(hours.hours.trim());
    }
    const values = Object.values(hours).filter(v => typeof v === 'string' && (v as string).trim().length > 0) as string[];
    return values.length > 0 ? values.map(translateHoursString).join(' | ') : null;
  }
  return null;
}

function getEmbedVideoUrl(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&rel=0`;
  }
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  return null;
}

function getVideoThumbnail(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  }
  return null;
}

function formatWhatsAppUrl(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.startsWith('09') && digits.length === 10) {
    return `https://wa.me/963${digits.slice(1)}`;
  }
  return `https://wa.me/${digits}`;
}

function formatWebsiteUrl(raw: string): string {
  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function PlaceDetailDrawer({
  place,
  onClose,
  onStartRouting,
  onZoomToPlace,
  onSelectNeighborhood,
}: PlaceDetailDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const mediaCount = place?.media && place.media.length > 0 ? place.media.length : 1;

  useEffect(() => {
    if (lightboxIndex === null || !place) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : mediaCount - 1));
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev !== null && prev < mediaCount - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, place, mediaCount]);

  useEffect(() => {
    setActiveMediaIndex(0);
    setLightboxIndex(null);
    setIsScrolled(false);
  }, [place?.id]);

  if (!place) return null;

  const handleShare = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsShareOpen(true);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(locationShareUrl);
    setCopied(true);
    setIsShareOpen(false);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryIcon = (slug: string) => {
    switch (slug) {
      case 'healthcare': return <Hospital className="w-4 h-4 text-white" />;
      case 'education': return <GraduationCap className="w-4 h-4 text-white" />;
      case 'government': return <Landmark className="w-4 h-4 text-white" />;
      case 'religious': return <Moon className="w-4 h-4 text-white" />;
      case 'tourism': return <Sparkles className="w-4 h-4 text-white" />;
      case 'public-services': return <Wrench className="w-4 h-4 text-white" />;
      case 'security': return <Shield className="w-4 h-4 text-white" />;
      case 'economy': return <Coins className="w-4 h-4 text-white" />;
      case 'transportation': return <Bus className="w-4 h-4 text-white" />;
      default: return <Building2 className="w-4 h-4 text-white" />;
    }
  };

  const activeMedia = place.media && place.media.length > 0 ? place.media[activeMediaIndex] : null;
  const displayImage = activeMedia?.url || place.media.find(m => m.is_cover)?.url || DEFAULT_PLACEHOLDERS[place.category.slug] || DEFAULT_PLACEHOLDERS.default;

  const allMedia = place.media && place.media.length > 0
    ? place.media
    : [{ id: 0, url: displayImage, type: 'image', caption: place.title, is_cover: true }];

  const cleanMunicipality = (place.location?.municipality || '').replace(/^(بلدية|دائرة خدمات)\s+/, '').trim();
  const cleanNeighborhood = (place.location?.neighborhood || '').replace(/^حي\s+/, '').trim();

  const formatCleanAddress = (loc: PlaceDetailData['location'], title: string) => {
    if (!loc?.address_text) return '';
    const cleaned = loc.address_text
      .replace(/^دمشق\s*[-–—:,]\s*/i, '')
      .replace(new RegExp(`^${title}\\s*[-–—:,]?\\s*`, 'i'), '')
      .replace(new RegExp(`[-–—:,]?\\s*${title}$`, 'i'), '')
      .trim();
    const neigh = (loc.neighborhood || '').replace(/^حي\s+/, '').trim();
    if (!cleaned || cleaned === title || cleaned === neigh || cleaned === `حي ${neigh}`) {
      return '';
    }
    return cleaned;
  };

  const formattedAddress = formatCleanAddress(place.location, place.title);
  const specificStreet = formattedAddress;
  const formattedHours = formatOpeningHours(place.contact?.opening_hours);
  const hasValidCoords = Boolean(
    place.location?.latitude &&
    place.location?.longitude &&
    (place.location.latitude !== 0 || place.location.longitude !== 0)
  );
  const locationShareUrl = hasValidCoords
    ? `https://www.google.com/maps/search/?api=1&query=${place.location.latitude},${place.location.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.title + ' دمشق')}`;

  const hasAnyContact = Boolean(
    place.contact?.phone || 
    place.contact?.mobile || 
    place.contact?.short_number || 
    place.contact?.whatsapp || 
    place.contact?.email || 
    place.contact?.website || 
    (place.contact?.social_media && Object.keys(place.contact.social_media).length > 0)
  );

  return (
    <>

      <div 
        className="map-place-card z-50 bg-[#fdfbf7] dark:bg-zinc-900 shadow-2xl rounded-3xl border border-[#064239]/20 dark:border-white/10 flex flex-col animate-in slide-in-from-left fade-in duration-300 overflow-hidden"
        role="region"
        aria-label={`تفاصيل ${place.title}`}
        dir="rtl"
      >

        {/* شريط علوي ذكي ثابت يظهر بنعومة عند التمرير (Sticky Navigation Bar) */}
        <div className={`absolute top-0 inset-x-0 h-12 bg-[#fdfbf7]/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-[#064239]/15 dark:border-white/10 flex items-center justify-between px-3 z-30 transition-all duration-200 ${
          isScrolled ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        }`}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div 
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
              style={{ backgroundColor: '#064239' }}
            >
              {getCategoryIcon(place.category.slug)}
            </div>
            <span className="font-black text-xs text-[#064239] dark:text-zinc-100 truncate">
              {place.title}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleShare(e); }}
              className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 text-zinc-700 dark:text-zinc-200 flex items-center justify-center transition-all cursor-pointer"
              title="مشاركة الرابط"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 text-zinc-700 dark:text-zinc-200 flex items-center justify-center transition-all cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* حاوية التمرير الموحدة للبطاقة بأكملها (Unified Scroll Container) */}
        <div 
          onScroll={(e) => setIsScrolled(e.currentTarget.scrollTop > 100)}
          className="overflow-y-auto flex-1 overscroll-contain"
        >
          {/* 1. صورة الغلاف أو الفيديو - قابلة للنقر والفتح بالكامل */}
          <div 
            onClick={() => setLightboxIndex(activeMediaIndex)}
            className="relative h-56 sm:h-64 w-full overflow-hidden shrink-0 bg-zinc-800 cursor-pointer group"
            title="انقر لفتح الصورة أو الفيديو بحجم كامل"
          >
          {activeMedia?.type === 'video' ? (
            (() => {
              const embed = getEmbedVideoUrl(activeMedia.url);
              return embed ? (
                <iframe
                  src={embed}
                  title={activeMedia.caption || place.title}
                  className="w-full h-full border-0 pointer-events-none"
                />
              ) : (
                <video 
                  src={activeMedia.url} 
                  className="w-full h-full object-cover pointer-events-none"
                  poster={DEFAULT_PLACEHOLDERS[place.category.slug]}
                />
              );
            })()
          ) : (
            <img 
              src={displayImage} 
              alt={place.title} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          )}

          {/* زر التكبير في الزاوية العلوية اليمنى */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
            <div 
              className="w-8 h-8 rounded-full bg-black/40 group-hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-all shadow-md"
              title="عرض ملء الشاشة"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/35 pointer-events-none" />

          {/* أزرار المشاركة والإغلاق في الزاوية العلوية */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 z-20">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleShare(e);
              }}
              aria-label="مشاركة الرابط"
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white active:scale-90 flex items-center justify-center transition-all cursor-pointer"
              title="مشاركة الرابط"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label="إغلاق تفاصيل المكان"
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white active:scale-90 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. معرض الوسائط المتعددة إذا توفر أكثر من صورة/فيديو */}
        {place.media && place.media.length > 1 && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-black/5 dark:bg-white/5 border-b border-black/5 overflow-x-auto no-scrollbar shrink-0">
            {place.media.map((m, idx) => (
              <button
                key={m.id || idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMediaIndex(idx);
                  setLightboxIndex(idx);
                }}
                className={`relative w-12 h-10 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                  activeMediaIndex === idx ? 'border-[#c8a76a] scale-105 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
                title={m.caption || (m.type === 'video' ? `فيديو ${idx + 1}` : `صورة ${idx + 1}`)}
              >
                <img
                  src={m.type === 'video' ? (getVideoThumbnail(m.url) || DEFAULT_PLACEHOLDERS[place.category.slug] || DEFAULT_PLACEHOLDERS.default) : m.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {m.type === 'video' && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Video className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* 3. جسم تفاصيل البطاقة */}
        <div className="p-3.5 sm:p-4 space-y-3 pb-8">
          {/* اسم الفعالية أو المنشأة */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-lg font-black text-[#064239] dark:text-zinc-100 leading-tight">
                  {place.title}
                </h2>
              </div>
              {place.title_en && (
                <p className="text-[11px] font-medium text-zinc-400 truncate mt-0.5">
                  {place.title_en}
                </p>
              )}
            </div>

            {/* زر النبذة التعريفية */}
            {place.description && (
              <button
                type="button"
                onClick={() => setShowDescription(!showDescription)}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer select-none active:scale-95 ${
                  showDescription
                    ? 'bg-[#064239] text-[#f7f4ed] shadow-xs'
                    : 'bg-[#c8a76a]/15 text-[#846628] dark:bg-amber-950/50 dark:text-amber-300 hover:bg-[#c8a76a]/25'
                }`}
                title="عرض نبذة تعريفية عن المكان"
              >
                <Info className="w-3.5 h-3.5" />
                <span>نبذة</span>
                {place.is_verified && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-label="موثق رسمياً" />
                )}
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showDescription ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>

          {/* محتوى النبذة التعريفية */}
          {showDescription && place.description && (
            <div className="p-3 rounded-2xl bg-[#f7f4ed] dark:bg-zinc-800/80 border border-[#064239]/15 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed animate-in fade-in slide-in-from-top-1 duration-150">
              <p>{place.description}</p>
            </div>
          )}

          {/* الموقع الإداري والحي (بدون أي تكرار) */}
          <div className="bg-[#f7f4ed] dark:bg-zinc-800/60 p-3 rounded-2xl border border-[#064239]/10 space-y-2">
            <div className="flex items-start gap-2 text-xs">
              <MapPin className="w-4 h-4 text-[#c8a76a] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 space-y-1">
                {specificStreet && (
                  <div className="font-bold text-zinc-800 dark:text-zinc-100 text-xs leading-snug">
                    {specificStreet}
                  </div>
                )}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  {cleanNeighborhood && (
                    <button
                      type="button"
                      onClick={() => onSelectNeighborhood?.(cleanNeighborhood)}
                      className="font-bold px-2 py-0.5 rounded-md bg-[#064239]/10 hover:bg-[#064239]/20 text-[#064239] dark:text-emerald-300 transition-colors cursor-pointer"
                      title={`عرض كافة معالم حي ${cleanNeighborhood}`}
                    >
                      حي {cleanNeighborhood}
                    </button>
                  )}
                  {cleanMunicipality && (
                    <span className="font-medium text-zinc-500 dark:text-zinc-400">
                      • بلدية {cleanMunicipality}
                    </span>
                  )}
                  <span className="text-zinc-400 font-normal">
                    • دمشق
                  </span>
                </div>
              </div>
            </div>

            {/* أوقات العمل والدوام الرسمي - يظهر فقط إذا وُجدت بيانات الدوام */}
            {formattedHours && (
              <div className="flex items-center gap-2 text-xs pt-2 border-t border-black/5 dark:border-white/5">
                <Clock className="w-4 h-4 text-[#064239] dark:text-emerald-400 shrink-0" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">أوقات الدوام:</span>
                  <span className="text-zinc-600 dark:text-zinc-300 text-[11px]">
                    {formattedHours}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* طرق التواصل المعتمدة: هاتف ثابت - موبايل - واتساب - إيميل - موقع ويب */}
          {hasAnyContact ? (
            <div className="space-y-2">
              <h4 className="text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider px-1">
                طرق التواصل المعتمدة
              </h4>

              {/* الرقم المختصر / الرباعي */}
              {place.contact?.short_number && (
                <a
                  href={`tel:${place.contact.short_number}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 hover:border-amber-400 transition-all text-xs font-bold text-amber-900 dark:text-amber-200"
                >
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-amber-600" />
                    <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">الرقم المختصر:</span>
                    <span dir="ltr" className="font-black text-sm tracking-wide">{place.contact.short_number}</span>
                  </div>
                  <span className="text-[11px] bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-0.5 rounded-md font-semibold transition-colors">اتصال سريع</span>
                </a>
              )}

              {/* رقم الهاتف الأرضي */}
              {place.contact?.phone && (
                <a
                  href={`tel:${place.contact.phone}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-black/5 hover:border-[#064239]/30 transition-all text-xs font-bold text-[#064239] dark:text-zinc-200"
                >
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#064239] dark:text-emerald-400" />
                    <span className="text-[11px] font-medium text-zinc-400">هاتف ثابت:</span>
                    <span dir="ltr">{place.contact.phone}</span>
                  </div>
                  <span className="text-[11px] text-[#c8a76a] font-semibold">اتصال</span>
                </a>
              )}

              {/* رقم الموبايل */}
              {place.contact?.mobile && (
                <a
                  href={`tel:${place.contact.mobile}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-black/5 hover:border-[#064239]/30 transition-all text-xs font-bold text-[#064239] dark:text-zinc-200"
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[#064239] dark:text-emerald-400" />
                    <span className="text-[11px] font-medium text-zinc-400">موبايل:</span>
                    <span dir="ltr">{place.contact.mobile}</span>
                  </div>
                  <span className="text-[11px] text-[#c8a76a] font-semibold">اتصال</span>
                </a>
              )}

              {/* واتساب */}
              {place.contact?.whatsapp && (
                <a
                  href={formatWhatsAppUrl(place.contact.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 hover:border-emerald-400 transition-all text-xs font-bold text-emerald-800 dark:text-emerald-200"
                >
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">واتساب:</span>
                    <span dir="ltr">{place.contact.whatsapp}</span>
                  </div>
                  <span className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-0.5 rounded-md font-semibold transition-colors">مراسلة</span>
                </a>
              )}

              {/* البريد الإلكتروني */}
              {place.contact?.email && (
                <a
                  href={`mailto:${place.contact.email}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-black/5 hover:border-[#064239]/30 transition-all text-xs font-bold text-[#064239] dark:text-zinc-200"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#064239] dark:text-emerald-400" />
                    <span className="text-[11px] font-medium text-zinc-400">البريد:</span>
                    <span dir="ltr" className="truncate max-w-[180px]">{place.contact.email}</span>
                  </div>
                  <span className="text-[11px] text-[#c8a76a] font-semibold">إرسال</span>
                </a>
              )}

              {/* الموقع الإلكتروني */}
              {place.contact?.website && (
                <a
                  href={formatWebsiteUrl(place.contact.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-black/5 hover:border-[#064239]/30 transition-all text-xs font-bold text-[#064239] dark:text-zinc-200"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#064239] dark:text-emerald-400" />
                    <span className="truncate max-w-[200px]">{place.contact.website}</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                </a>
              )}

              {/* منصات التواصل الاجتماعي */}
              {place.contact?.social_media && typeof place.contact.social_media === 'object' && Object.keys(place.contact.social_media).length > 0 && (
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-black/5 space-y-1.5">
                  <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 block">منصات التواصل الاجتماعي:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(place.contact.social_media).map(([network, url]) => (
                      <a
                        key={network}
                        href={String(url).startsWith('http') ? String(url) : `https://${url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] px-2 py-0.5 rounded-md bg-[#f7f4ed] dark:bg-zinc-700 text-[#064239] dark:text-zinc-200 font-bold hover:bg-[#edebe0] transition-all flex items-center gap-1"
                      >
                        <span>{network}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onStartRouting({ lat: place.location.latitude, lon: place.location.longitude, title: place.title })}
              className="w-full py-2.5 px-3 rounded-xl bg-[#064239] hover:bg-[#04352e] text-[#f7f4ed] font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Navigation className="w-3.5 h-3.5 text-[#c8a76a]" />
              <span>الوصول إلى المكان</span>
            </button>
          </div>
        </div>

        {/* نهاية حاوية التمرير الموحدة للبطاقة بأكملها */}
        </div>

        {/* تدرج لوني سفلي ناعم يمنع قطع المحتوى بحافة حادة */}
        <div className="pointer-events-none absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-[#fdfbf7] dark:from-zinc-900 to-transparent z-20" />

        {/* شريط الإشعار عند نسخ الرابط */}
        {copied && (
          <div className="absolute bottom-3 inset-x-4 p-2 rounded-xl bg-[#064239] text-[#f7f4ed] text-xs font-bold text-center z-30 shadow-lg animate-in fade-in slide-in-from-bottom-2">
            تم نسخ رابط المكان بنجاح!
          </div>
        )}

        {isShareOpen && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={() => setIsShareOpen(false)}>
            <div className="w-full max-w-[280px] rounded-2xl bg-[#fdfbf7] dark:bg-zinc-800 p-4 shadow-2xl border border-[#064239]/15 dark:border-white/10" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="مشاركة المكان">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-sm text-[#064239] dark:text-zinc-100">مشاركة المكان</h3>
                <button type="button" onClick={() => setIsShareOpen(false)} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer" aria-label="إغلاق نافذة المشاركة">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                <a href={`https://wa.me/?text=${encodeURIComponent(`${place.title} - ${locationShareUrl}`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 font-bold text-xs cursor-pointer">
                  <MessageCircle className="w-4 h-4" /> واتساب
                </a>
                <button type="button" onClick={handleCopyLink} className="flex items-center gap-2 w-full p-2.5 rounded-xl bg-[#f7f4ed] dark:bg-zinc-700 text-[#064239] dark:text-zinc-100 font-bold text-xs cursor-pointer">
                  <Share2 className="w-4 h-4" /> نسخ الرابط
                </button>
                <a href={`https://t.me/share/url?url=${encodeURIComponent(locationShareUrl)}&text=${encodeURIComponent(place.title)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-200 font-bold text-xs cursor-pointer">
                  <Send className="w-4 h-4" /> تيليغرام
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* مشغل ومعرض الوسائط ملء الشاشة (Lightbox) */}
      {lightboxIndex !== null && (
        <div 
          className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-5 animate-in fade-in duration-200 select-none"
          dir="rtl"
          onClick={() => setLightboxIndex(null)}
        >
          {/* شريط الأدوات العلوي */}
          <div className="flex items-center justify-between text-white z-20 shrink-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base text-zinc-100">{place.title}</h3>
              {allMedia.length > 1 && (
                <span className="text-xs bg-white/15 px-2 py-0.5 rounded-full text-zinc-200">
                  {lightboxIndex + 1} / {allMedia.length}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="إغلاق (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* مساحة العرض الرئيسية */}
          <div className="flex-1 flex items-center justify-center relative my-2 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {allMedia.length > 1 && (
              <button
                type="button"
                onClick={() => setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : allMedia.length - 1))}
                className="absolute right-2 sm:right-4 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all cursor-pointer active:scale-90"
                title="السابق"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {allMedia[lightboxIndex]?.type === 'video' ? (
              (() => {
                const embed = getEmbedVideoUrl(allMedia[lightboxIndex].url);
                return embed ? (
                  <iframe
                    src={embed}
                    title={allMedia[lightboxIndex].caption || place.title}
                    className="w-full max-w-4xl aspect-video rounded-2xl shadow-2xl border border-white/10"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={allMedia[lightboxIndex].url}
                    controls
                    autoPlay
                    className="max-h-[75vh] max-w-[90vw] rounded-2xl shadow-2xl border border-white/10"
                  />
                );
              })()
            ) : (
              <img
                src={allMedia[lightboxIndex]?.url}
                alt={allMedia[lightboxIndex]?.caption || place.title}
                className="max-h-[75vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl transition-all"
              />
            )}

            {allMedia.length > 1 && (
              <button
                type="button"
                onClick={() => setLightboxIndex((prev) => (prev !== null && prev < allMedia.length - 1 ? prev + 1 : 0))}
                className="absolute left-2 sm:left-4 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all cursor-pointer active:scale-90"
                title="التالي"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* الشريط السفلي: الشرح والمصغرات */}
          <div className="flex flex-col items-center gap-2 z-20 shrink-0" onClick={(e) => e.stopPropagation()}>
            {allMedia[lightboxIndex]?.caption && (
              <p className="text-xs sm:text-sm text-zinc-300 text-center font-medium max-w-xl px-4 py-1 rounded-full bg-black/50 backdrop-blur-md">
                {allMedia[lightboxIndex].caption}
              </p>
            )}
            {allMedia.length > 1 && (
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 backdrop-blur-md max-w-full overflow-x-auto no-scrollbar">
                {allMedia.map((m, idx) => (
                  <button
                    key={m.id || idx}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className={`relative w-12 h-10 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      lightboxIndex === idx ? 'border-[#c8a76a] scale-105' : 'border-transparent opacity-50 hover:opacity-80'
                    }`}
                  >
                    <img
                  src={m.type === 'video' ? (getVideoThumbnail(m.url) || DEFAULT_PLACEHOLDERS[place.category.slug] || DEFAULT_PLACEHOLDERS.default) : m.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
                    {m.type === 'video' && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Video className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
