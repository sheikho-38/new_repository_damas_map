import { useEffect, useRef, useState } from 'react'
import PlacesMap from '../components/places/PlacesMap'
import PlacesFilters from '../components/places/PlacesFilters'
import { usePlaces, usePlacesMetadata } from '../hooks/usePlaces'
import { placesApi } from '../services/placesApi'
import { emptyFilters, type Place } from '../types/places'
import { API_URL } from '../config'

export default function PlacesExplorerPage({ onAdd, onEdit }: { onAdd: () => void; onEdit: (id: number) => void }) {
  const { metadata, error: metadataError } = usePlacesMetadata()
  const [filters, setFilters] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [bbox, setBbox] = useState('')
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<Place | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selectionRequest = useRef<AbortController | null>(null)
  const { list, geojson, loading, error: loadError } = usePlaces(filters, page, bbox, revision)
  useEffect(() => () => selectionRequest.current?.abort(), [])
  const select = async (id: number) => {
    selectionRequest.current?.abort(); const controller = new AbortController(); selectionRequest.current = controller
    try { setSelected(await placesApi.detail(id, controller.signal)); setError('') } catch (e) { if (e instanceof Error && e.name !== 'AbortError') setError(e.message) }
  }
  const mutate = async (remove: boolean) => {
    if (!selected || busy || (remove && !window.confirm(`حذف «${selected.title_ar}» نهائيًا؟`))) return
    setBusy(true); setError('')
    try {
      if (remove) { await placesApi.remove(selected.id); setSelected(null) }
      else setSelected(await placesApi.save({ is_visible: !selected.is_visible }, selected.id))
      setRevision(r => r + 1); setPage(1); setNotice(remove ? 'تم حذف المكان' : 'تم تحديث الظهور')
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذرت العملية') }
    finally { setBusy(false) }
  }
  if (metadataError) return <p role="alert">{metadataError} <a href={`${API_URL.replace(/\/api\/?$/, '')}/admin/login/`} target="_blank" rel="noreferrer">تسجيل الدخول</a> ثم أعد تحميل الصفحة.</p>
  if (!metadata) return <p>جارٍ تحميل بيانات الإدارة…</p>
  return <section className="places-explorer">
    <div className="places-row"><h2>استكشاف الأماكن</h2><button className="places-primary" onClick={onAdd}>إضافة مكان</button></div>
    {notice && <p role="status">{notice}</p>}
    {(error || loadError) && <p role="alert" className="places-error">{error || loadError} <button onClick={() => setRevision(r => r + 1)}>إعادة المحاولة</button></p>}
    <PlacesFilters metadata={metadata} value={filters} onChange={f => { selectionRequest.current?.abort(); setFilters(f); setPage(1); setSelected(null) }} />
    <div className="places-split">
      <aside className="places-panel">
        {selected && <article className="place-details"><button onClick={() => { selectionRequest.current?.abort(); setSelected(null) }}>إغلاق واستعادة الخريطة</button><h3>{selected.title_ar}</h3><p>{selected.category_name} / {selected.sub_category_name}</p><p>{selected.description}</p><p>{selected.admin_area_name} · {selected.location_text}</p><p>{selected.is_visible ? 'ظاهر' : 'مخفي'} · {selected.is_verified ? 'موثّق' : 'غير موثّق'}</p><p dir="ltr">{selected.latitude}, {selected.longitude}</p><div className="places-row"><button disabled={busy} onClick={() => onEdit(selected.id)}>تعديل</button><button disabled={busy} onClick={() => void mutate(false)}>{selected.is_visible ? 'إخفاء' : 'إظهار'}</button><button disabled={busy} onClick={() => void mutate(true)}>حذف</button></div></article>}
        <h3>{list.count} مكان</h3>{loading && <p role="status">جارٍ التحميل…</p>}
        {!loading && !list.results.length && <p>لا توجد أماكن مطابقة للفلاتر.</p>}
        <div className="places-list">{list.results.map(p => <button key={p.id} className={selected?.id === p.id ? 'selected' : ''} onClick={() => void select(p.id)}><strong>{p.title_ar}</strong><small>{p.category_name} · {p.admin_area_name} · {p.is_visible ? 'ظاهر' : 'مخفي'}</small></button>)}</div>
        <div className="places-row"><button disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>السابق</button><span>صفحة {page}</span><button disabled={!list.next || loading} onClick={() => setPage(p => p + 1)}>التالي</button></div>
      </aside>
      <div>{geojson.truncated && <p>توجد أكثر من 5000 نقطة في النطاق؛ قرّب الخريطة أو ضيّق الفلاتر.</p>}<PlacesMap data={geojson} selected={selected} onSelect={id => void select(id)} onBounds={setBbox} /></div>
    </div>
  </section>
}
