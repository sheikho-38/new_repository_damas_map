import type { Filters, Metadata } from '../../types/places'
import { emptyFilters } from '../../types/places'
export default function PlacesFilters({ metadata, value, onChange }: { metadata: Metadata; value: Filters; onChange: (filters: Filters) => void }) {
  return <div className="places-filters">
    <label>الفئة الرئيسية<select value={value.category_id} onChange={e => onChange({ ...value, category_id: e.target.value, subcategory_id: '' })}><option value="">جميع الفئات</option>{metadata.categories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}</select></label>
    <label>الفئة الفرعية<select value={value.subcategory_id} onChange={e => onChange({ ...value, subcategory_id: e.target.value })}><option value="">جميع الفئات الفرعية</option>{metadata.categories.filter(c => !value.category_id || String(c.id) === value.category_id).flatMap(c => c.subcategories).map(s => <option key={s.id} value={s.id}>{s.name_ar}</option>)}</select></label>
    <label>المنطقة<select value={value.admin_area_id} onChange={e => onChange({ ...value, admin_area_id: e.target.value })}><option value="">جميع المناطق</option>{metadata.admin_areas.map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}</select></label>
    <label>بحث<input type="search" value={value.search} onChange={e => onChange({ ...value, search: e.target.value })} placeholder="اسم المكان" /></label>
    {(['is_visible', 'is_verified'] as const).map((key, i) => <label key={key}>{i === 0 ? 'الظهور' : 'التوثيق'}<select value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })}><option value="">الكل</option><option value="true">{i === 0 ? 'ظاهر' : 'موثّق'}</option><option value="false">{i === 0 ? 'مخفي' : 'غير موثّق'}</option></select></label>)}
    <button onClick={() => onChange(emptyFilters)}>مسح الفلاتر</button>
  </div>
}
