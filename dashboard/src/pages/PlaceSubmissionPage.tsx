import { useEffect, useState } from 'react'
import PlaceForm from '../components/places/PlaceForm'
import { createSubmissionApi, type SubmissionMetadata } from '../services/placeSubmissionApi'
import type { Place } from '../types/places'

const api = createSubmissionApi()

export default function PlaceSubmissionPage() {
  const [metadata, setMetadata] = useState<SubmissionMetadata>()
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Place | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'إضافة مكان — دليل دمشق'
    return () => { document.title = previousTitle }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    api.metadata(controller.signal).then(setMetadata).catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    return () => controller.abort()
  }, [attempt])
  return <main dir="rtl" className="place-submission">
    <header><span>دليل دمشق</span><h1>إضافة مكان</h1><br /> <p>أدخل معلومات المكان وحدد موقعه على الخريطة.</p></header>
    {error ? <section className="places-panel"><p role="alert" className="places-error">{error}</p><button onClick={() => { setError(''); setAttempt(a => a + 1) }}>إعادة المحاولة</button></section>
      : !metadata ? <p role="status">جارٍ تحميل النموذج…</p>
      : saved ? <section className="places-panel submission-success" role="status"><span className="success-check" aria-hidden="true">✓</span><h2>تم حفظ المكان بنجاح</h2><p>{saved.title_ar}</p><p>{saved.is_visible ? 'سيظهر على الخريطة العامة خلال نحو 15 ثانية عند اختيار فئته.' : 'تم إرسال المكان للمراجعة قبل ظهوره على الخريطة.'}</p><p>رقم المكان: {saved.id} — يمكنك الآن إضافة المكان التالي.</p><button onClick={() => setSaved(null)}>إضافة مكان آخر</button></section>
      : <><p className="submission-policy">{metadata.auto_publish ? 'سيُنشر المكان على الخريطة بعد الحفظ.' : 'سيُراجع المكان قبل نشره على الخريطة.'}</p><PlaceForm metadata={{ ...metadata, csrf_token: '' }} submission savePlace={api.save} onSaved={setSaved} /></>}
  </main>
}
