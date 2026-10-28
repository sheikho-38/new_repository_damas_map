import type { CategoryInfo } from '../components/LayersPanel';

export const PLATFORM_CATEGORIES: CategoryInfo[] = [
  ['damascus-governorate', 'مباني محافظة دمشق', 'Damascus Governorate Buildings', 'landmark'],
  ['government', 'مباني حكومية', 'Government Buildings', 'landmark'],
  ['economy', 'اقتصاد', 'Economy', 'coins'],
  ['public-facilities', 'المرافق العامة', 'Public Facilities', 'trees'],
  ['communications', 'اتصالات', 'Communications', 'phone'],
  ['education', 'تربية وتعليم', 'Education', 'graduation-cap'],
  ['religious', 'دور العبادة', 'Places of Worship', 'moon'],
  ['healthcare', 'صحة', 'Healthcare', 'hospital'],
].map(([slug, name_ar, name_en, icon], index) => ({
  id: -(index + 1), slug, name_ar, name_en, icon, sort_order: index + 1, places_count: 0, subcategories: [],
}));

export function mergePlatformCategories(categories: CategoryInfo[]): CategoryInfo[] {
  const main = PLATFORM_CATEGORIES.map(category => ({
    ...category,
    ...categories.find(existing => existing.slug === category.slug),
    name_ar: category.name_ar,
  }));
  // Keep existing categories (including holy sites) accessible without reclassifying places.
  return [...main, ...categories.filter(category => !main.some(item => item.slug === category.slug))]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);
}
