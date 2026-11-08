import { useEffect, useState } from 'react'
import PlaceForm from '../components/places/PlaceForm'
import { usePlacesMetadata } from '../hooks/usePlaces'
import { placesApi } from '../services/placesApi'
import type { Place, PlacePage } from '../types/places'
import { API_URL } from '../config'

const idFromUrl = () => {
  const raw = new URLSearchParams(window.location.search).get('id')
  const id = Number(raw)
  return raw && Number.isSafeInteger(id) && id > 0 ? id : null
}

export default function EditPlacePage() {
  const { metadata, error: metadataError } = usePlacesMetadata()
  const [id, setId] = useState<number | null>(idFromUrl)
  const [place, setPlace] = useState<Place | null>(null)
  const [editing, setEditing] = useState(Boolean(idFromUrl()))
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<PlacePage>({ count: 0, results: [], next: null, previous: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const pop = () => { const next = idFromUrl(); setId(next); setEditing(Boolean(next)); setNotice('') }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  useEffect(() => {
    if (!metadata || editing) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      placesApi.list(new URLSearchParams({ search, page: String(page), page_size: '20' }).toString(), controller.signal)
        .then(data => { setResults(data); setError('') })
        .catch(e => { if (e.name !== 'AbortError') setError(e.message) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [metadata, search, page, editing])
  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    placesApi.detail(id, controller.signal)
      .then(data => { setPlace(data); setError('') })
      .catch(e => { if (e.name !== 'AbortError') { setPlace(null); setError(e.message) } })
    return () => controller.abort()
  }, [id])

  const choose = (next: number) => {
    window.history.pushState({}, '', `/admin/places/edit?id=${next}`)
    setPlace(null); setId(next); setEditing(true); setNotice(''); setError('')
  }
  const showList = () => {
    window.history.pushState({}, '', '/admin/places/edit')
    setId(null); setPlace(null); setEditing(false); setError('')
  }

  return <section className="places-explorer edit-place-page">
    <div className="places-row"><h2>تعديل مكان</h2>{editing && <button type="button" onClick={showList}>اختيار مكان آخر</button>}</div>
    {metadataError && <p role="alert" className="places-error">{metadataError} <a href={`${API_URL.replace(/\/api\/?$/, '')}/admin/login/`} target="_blank" rel="noreferrer">تسجيل الدخول</a> ثم أعد تحميل الصفحة.</p>}
    {error && <p role="alert" className="places-error">{error}</p>}
    {notice && <p role="status" className="edit-place-notice">{notice}</p>}
    {!metadata && !metadataError && <p role="status">جارٍ تحميل بيانات الإدارة…</p>}
    {metadata && editing && place?.id !== id && !error && <p role="status">جارٍ تحميل المكان…</p>}
    {metadata && editing && place?.id === id && <PlaceForm key={`${place.id}-${place.latitude}-${place.longitude}-${notice}`} metadata={metadata} initial={place} uploadMedia={placesApi.uploadMedia} onCancel={showList} onSaved={saved => { setPlace(saved); setNotice(`تم حفظ تعديلات «${saved.title_ar}» بنجاح.`) }} />}
    {metadata && !editing && <div className="places-panel edit-place-picker">
      <p>ابحث عن المكان، ثم عدّل معلوماته أو موقعه على الخريطة.</p>
      <label htmlFor="edit-place-search">اسم المكان</label>
      <input id="edit-place-search" type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="ابحث عن مكان…" />
      {loading && <p role="status">جارٍ البحث…</p>}
      {!loading && <p>{results.count} مكان</p>}
      {!loading && results.results.length === 0 && <p>لا توجد أماكن مطابقة.</p>}
      <div className="places-list">{results.results.map(item => <button type="button" key={item.id} onClick={() => choose(item.id)}><strong>{item.title_ar}</strong><small>{item.category_name} · {item.admin_area_name || item.location_text || 'دون منطقة'}</small></button>)}</div>
      <div className="places-row"><button type="button" disabled={page === 1 || loading} onClick={() => setPage(n => n - 1)}>السابق</button><span>صفحة {page}</span><button type="button" disabled={!results.next || loading} onClick={() => setPage(n => n + 1)}>التالي</button></div>
    </div>}
  </section>
}
