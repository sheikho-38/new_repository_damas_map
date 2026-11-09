import { useEffect, useState } from 'react'
import PlaceForm from '../components/places/PlaceForm'
import { createSubmissionApi, type SubmissionMetadata } from '../services/placeSubmissionApi'
import type { Place, PlacePage } from '../types/places'

const api = createSubmissionApi()

export default function PlaceSubmissionPage() {
  const [metadata, setMetadata] = useState<SubmissionMetadata>()
  const [mode, setMode] = useState<'add' | 'edit'>('add')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<PlacePage>()
  const [selected, setSelected] = useState<Place | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Place | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'المواقع — دليل دمشق'
    return () => { document.title = previousTitle }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    api.metadata(controller.signal).then(setMetadata).catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    if (mode !== 'edit' || selected) return
    const controller = new AbortController()
    const timer = setTimeout(() => api.list(new URLSearchParams({ search, page_size: '20' }).toString(), controller.signal)
      .then(setResults).catch(e => { if (e.name !== 'AbortError') setError(e.message) }), 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [mode, search, selected])
  const choose = (id: number) => api.detail(id).then(place => { setSelected(place); setError('') }).catch(e => setError(e.message))
  const switchMode = (next: 'add' | 'edit') => { setMode(next); setSelected(null); setSaved(null); setError('') }

  return <main dir="rtl" className="place-submission">
    <header><span>دليل دمشق</span><h1>{mode === 'add' ? 'إضافة موقع' : 'تعديل موقع'}</h1>
      <nav className="submission-tabs" aria-label="إدارة المواقع">
        <button type="button" aria-current={mode === 'add' ? 'page' : undefined} onClick={() => switchMode('add')}>إضافة موقع</button>
        <button type="button" aria-current={mode === 'edit' ? 'page' : undefined} onClick={() => switchMode('edit')}>تعديل موقع</button>
      </nav>
      <p>{mode === 'add' ? 'أدخل معلومات المكان وحدد موقعه على الخريطة.' : 'ابحث عن الموقع المطلوب ثم عدّل بياناته.'}</p>
    </header>
    {error && <section className="places-panel"><p role="alert" className="places-error">{error}</p><button onClick={() => { setError(''); setAttempt(a => a + 1) }}>إعادة المحاولة</button></section>}
    {!metadata && !error && <p role="status">جارٍ تحميل النموذج…</p>}
    {metadata && !error && saved && <section className="places-panel submission-success" role="status"><span className="success-check" aria-hidden="true">✓</span><h2>تم حفظ المكان بنجاح</h2><p>{saved.title_ar}</p><button onClick={() => { setSaved(null); setSelected(null) }}>{mode === 'add' ? 'إضافة مكان آخر' : 'تعديل مكان آخر'}</button></section>}
    {metadata && !error && !saved && mode === 'edit' && !selected && <section className="places-panel submission-picker">
      <label htmlFor="submission-search">اسم الموقع</label>
      <input id="submission-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث عن موقع…" />
      {!results && <p role="status">جارٍ تحميل المواقع…</p>}
      {results?.results.length === 0 && <p>لا توجد مواقع مطابقة.</p>}
      <div className="places-list">{results?.results.map(place => <button type="button" key={place.id} onClick={() => choose(place.id)}><strong>{place.title_ar}</strong><small>{place.category_name} · {place.admin_area_name || place.location_text || 'دون منطقة'}</small></button>)}</div>
    </section>}
    {metadata && !error && !saved && (mode === 'add' || selected) && <>
      {mode === 'add' && <p className="submission-policy">{metadata.auto_publish ? 'سيُنشر المكان على الخريطة بعد الحفظ.' : 'سيُراجع المكان قبل نشره على الخريطة.'}</p>}
      <PlaceForm key={selected?.id ?? 'new'} metadata={{ ...metadata, csrf_token: '' }} initial={selected ?? undefined} submission savePlace={api.save} uploadMedia={api.uploadMedia} onCancel={selected ? () => setSelected(null) : undefined} onSaved={setSaved} />
    </>}
  </main>
}
