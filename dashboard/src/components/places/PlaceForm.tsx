import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { LocalMediaFile, Metadata, Place, PlaceInput } from '../../types/places'
import { placesApi } from '../../services/placesApi'
import PlacesMap from './PlacesMap'
import OpeningHoursEditor from './OpeningHoursEditor'
import MediaFilePicker from './MediaFilePicker'
import { lookupAdminArea } from '../../services/adminAreaLookup'

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
const contactMessage = (type: string, value: string) => {
  if (!value) return ''
  if (type === 'phone') return /^[0-9]{7}$/.test(value) ? '' : 'أدخل رقم هاتف من 7 أرقام.'
  if (type === 'mobile' || type === 'whatsapp') return /^09[0-9]{8}$/.test(value) ? '' : 'أدخل 10 أرقام تبدأ بـ 09.'
  if (type === 'email') return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i.test(value) ? '' : 'أدخل بريدًا إلكترونيًا صحيحًا ينتهي بـ @gmail.com.'
  const domain = ({ facebook: 'facebook.com', instagram: 'instagram.com', telegram: 't.me' } as Record<string, string>)[type]
  if (type !== 'website' && !domain) return ''
  try {
    const url = new URL(value)
    if (/^https?:\/\/[^\s/\\]/i.test(value) && !/[\s\\]/.test(value) && url.hostname && !url.username && !url.password
      && (domain ? url.protocol === 'https:' && url.hostname === domain && !url.port : ['http:', 'https:'].includes(url.protocol))) return ''
  } catch { /* Invalid URLs use the field-specific message below. */ }
  return domain ? `أدخل رابطًا صحيحًا يبدأ بـ https://${domain}.` : 'أدخل رابطًا صحيحًا يبدأ بـ http:// أو https://.'
}
const isField = (el: EventTarget): el is Field => el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement
const fieldMessage = (field: Field) => field.required && !field.value.trim() ? 'هذا الحقل مطلوب.'
  : field.dataset.contactType ? contactMessage(field.dataset.contactType, field.value)
  : field.validity.typeMismatch ? 'أدخل رابطًا صحيحًا يبدأ بـ https://.'
  : !field.validity.valid ? 'أدخل قيمة صحيحة ضمن النطاق الموضح.' : ''
export default function PlaceForm({ metadata, initial, onSaved, onCancel, savePlace = placesApi.save, uploadMedia, submission = false }: { metadata: Metadata; initial?: Place; onSaved: (place: Place) => void; onCancel?: () => void; savePlace?: (data: PlaceInput, id?: number) => Promise<Place>; uploadMedia?: (files: LocalMediaFile[]) => Promise<PlaceInput['media']>; submission?: boolean }) {
  const [form, setForm] = useState<PlaceInput>(initial ?? { title_ar: '', title_en: '', description: '', sector: 'Public', latitude: NaN, longitude: NaN, location_text: '', opening_hours: {}, is_visible: true, is_verified: false, sub_category_id: 0, admin_area_id: null, communication_info: [], media: [] })
  const [category, setCategory] = useState(initial?.category_id?.toString() ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [localMedia, setLocalMedia] = useState<LocalMediaFile[]>([])
  const saving = useRef(false)
  const field = (name: string, label: string) => ({ name, 'aria-label': label, 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `${name}-error` : undefined })
  const hint = (name: string) => errors[name] && <small className="field-error" id={`${name}-error`}>{errors[name]}</small>
  const set = <K extends keyof PlaceInput>(key: K, value: PlaceInput[K]) => setForm(old => ({ ...old, [key]: value }))
  const validCoordinates = Number.isFinite(form.latitude) && Number.isFinite(form.longitude) && Math.abs(form.latitude) <= 90 && Math.abs(form.longitude) <= 180
  const lastLookup = useRef(initial ? `${initial.latitude},${initial.longitude}` : '')
  useEffect(() => {
    if (!validCoordinates) return
    const key = `${form.latitude},${form.longitude}`
    if (key === lastLookup.current) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      lastLookup.current = key
      lookupAdminArea(form.latitude, form.longitude, controller.signal)
        .then(area => { if (!controller.signal.aborted) setForm(old => ({ ...old, admin_area_id: area?.id ?? null })) })
        .catch(() => { /* نترك القيمة الحالية إذا فشل الطلب */ })
    }, 500)
    return () => { clearTimeout(timer); controller.abort() }
  }, [form.latitude, form.longitude, validCoordinates])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving.current) return
    const fields = Array.from((event.currentTarget as HTMLFormElement).elements).filter(isField).filter(el => el.name)
    const invalid = fields.filter(el => fieldMessage(el))
    setErrors(Object.fromEntries(invalid.map(el => [el.name, fieldMessage(el)])))
    if (invalid.length) {
      setError('بقيت حقول تحتاج إلى تصحيح. راجع التنبيهات أسفلها.')
      invalid[0].closest('details')?.setAttribute('open', '')
      invalid[0].focus(); return
    }
    if (localMedia.length && !uploadMedia) {
      setError('تم اختيار الملفات والتحقق منها، لكن خدمة رفع الملفات غير مربوطة بعد. لن تُحفظ الملفات قبل ربطها.')
      return
    }
    saving.current = true
    setBusy(true); setError('')
    try {
      const uploadedMedia = localMedia.length ? await uploadMedia!(localMedia) : []
      onSaved(await savePlace({ ...form, media: [...form.media, ...uploadedMedia] }, initial?.id))
    }
    catch (e) {
      let message = e instanceof Error ? e.message : 'تعذر الاتصال بالخادم.'
      try { const details = JSON.parse(message); message = Object.values(details).flat().join(' · ') } catch { /* Plain-text errors already have a readable message. */ }
      setError(`لم يتم الحفظ. ${message} البيانات المدخلة محفوظة في النموذج؛ صحّحها أو حاول مجددًا.`)
    }
    finally { saving.current = false; setBusy(false) }
  }
  return <div className="places-split place-entry">
    <form className="place-form places-panel" noValidate aria-busy={busy} onSubmit={submit}
      onBlurCapture={e => { const el = e.target; if (isField(el) && el.name) setErrors(old => ({ ...old, [el.name]: fieldMessage(el) })) }}
      onChangeCapture={e => { const el = e.target; if (isField(el) && el.name in errors) setErrors(old => ({ ...old, [el.name]: fieldMessage(el) })) }}>
      <h2>{initial ? 'تعديل المكان' : 'إضافة مكان جديد'}</h2>
      <p className="form-intro">ابدأ بالمعلومات الأساسية، ثم حدد الموقع. الحقول بعلامة <span aria-hidden="true">*</span> مطلوبة، وبقية التفاصيل اختيارية.</p>
      {error && <p role="alert" className="places-error">{error}</p>}
      <fieldset disabled={busy}>
        <h3 className="form-section-title"><span>1</span> المعلومات الأساسية</h3>
        <label>الاسم بالعربية *<input {...field('title_ar', 'الاسم بالعربية')} required maxLength={255} placeholder="مثال: صيدلية الشام" value={form.title_ar} onChange={e => set('title_ar', e.target.value)} />{hint('title_ar')}</label>
        <label>الاسم بالإنجليزية <span className="optional-label">اختياري</span><input maxLength={255} value={form.title_en} onChange={e => set('title_en', e.target.value)} /></label>
        <label>الفئة الرئيسية *<select {...field('category', 'الفئة الرئيسية')} required value={category} onChange={e => { setCategory(e.target.value); set('sub_category_id', 0) }}><option value="">اختر الفئة</option>{metadata.categories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}</select>{hint('category')}</label>
        <label>الفئة الفرعية *<select {...field('sub_category_id', 'الفئة الفرعية')} required value={form.sub_category_id || ''} onChange={e => set('sub_category_id', Number(e.target.value))}><option value="">{category ? 'اختر الفئة الفرعية' : 'اختر الفئة الرئيسية أولًا'}</option>{metadata.categories.find(c => String(c.id) === category)?.subcategories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}</select>{hint('sub_category_id')}</label>
        <label>القطاع *<input {...field('sector', 'القطاع')} list="place-sectors" required maxLength={20} value={form.sector} onChange={e => set('sector', e.target.value)} /><datalist id="place-sectors">{metadata.sectors.map(s => <option key={s} value={s} />)}</datalist>{hint('sector')}<small className="form-hint">Public: عام · private: خاص · joint: مشترك</small></label>
        <label>المنطقة الإدارية<select value={form.admin_area_id ?? ''} onChange={e => set('admin_area_id', e.target.value ? Number(e.target.value) : null)}><option value="">غير محددة</option>{metadata.admin_areas.map(a => <option key={a.id} value={a.id}>{a.name_ar}</option>)}</select></label>
        <label>الوصف<textarea value={form.description} onChange={e => set('description', e.target.value)} /></label>
        <label>العنوان<input maxLength={255} value={form.location_text} onChange={e => set('location_text', e.target.value)} /></label>
        <h3 className="form-section-title"><span>2</span> الموقع على الخريطة</h3>
        <p>انقر على موقع المنشأة في الخريطة لتعبئة الإحداثيات تلقائيًا. يمكنك تعديلها يدويًا إن كانت متوفرة لديك.</p>
        <a className="location-jump" href="#place-location-map">انتقل إلى الخريطة لتحديد الموقع ←</a>
        <div className="places-row coordinate-fields">{(['latitude', 'longitude'] as const).map((key, i) => <label key={key}>{i === 0 ? 'خط العرض *' : 'خط الطول *'}<input {...field(key, i === 0 ? 'خط العرض' : 'خط الطول')} required type="number" step="any" min={i === 0 ? -90 : -180} max={i === 0 ? 90 : 180} placeholder={i === 0 ? '33.513800' : '36.291300'} dir="ltr" value={Number.isFinite(form[key]) ? form[key] : ''} onChange={e => set(key, e.target.value === '' ? NaN : Number(e.target.value))} />{hint(key)}</label>)}</div>
        <h3 className="form-section-title"><span>3</span> تفاصيل إضافية <small>اختيارية</small></h3>
        <OpeningHoursEditor value={form.opening_hours} onChange={hours => set('opening_hours', hours)} />
        <details><summary>وسائل التواصل</summary><p>أضف وسيلة متوفرة، أو اترك هذا القسم فارغًا. احذف السطر إذا لم تتوفر قيمته.</p>{form.communication_info.map((row, index) => <div className="places-row" key={index}><select aria-label="نوع التواصل" value={row.type} onChange={e => { set('communication_info', form.communication_info.map((r, i) => i === index ? { ...r, type: e.target.value } : r)); setErrors(old => ({ ...old, [`contact_${index}`]: row.value.trim() ? contactMessage(e.target.value, row.value) : 'هذا الحقل مطلوب.' })) }}>{metadata.contact_types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input {...field(`contact_${index}`, 'قيمة التواصل')} data-contact-type={row.type} required maxLength={200} value={row.value} onChange={e => set('communication_info', form.communication_info.map((r, i) => i === index ? { ...r, value: e.target.value } : r))} />{hint(`contact_${index}`)}<button type="button" onClick={() => set('communication_info', form.communication_info.filter((_, i) => i !== index))}>حذف</button></div>)}<button type="button" onClick={() => set('communication_info', [...form.communication_info, { type: 'phone', value: '' }])}>إضافة وسيلة تواصل</button></details>
        <details><summary>الصور والفيديو</summary><p className="media-section-intro">أضف صورًا أو فيديو للمكان. اسحب الملفات إلى المساحة أو اخترها من جهازك، ويمكنك تحديد صورة الغلاف.</p><MediaFilePicker files={localMedia} onChange={setLocalMedia} onCoverChange={index => { setLocalMedia(files => files.map((item, i) => ({ ...item, is_cover: i === index }))); set('media', form.media.map(item => ({ ...item, is_cover: false }))) }} />{!uploadMedia && <small className="media-backend-note">سيُفعّل إرسال الملفات عند ربط خدمة الرفع.</small>}{form.media.length > 0 && <div className="media-existing"><strong>الوسائط المحفوظة</strong>{form.media.map((row, index) => <div className="media-existing-row" key={`${row.file_url}-${index}`}><a href={row.file_url} target="_blank" rel="noreferrer">{row.caption || row.file_url}</a>{row.media_type === 'image' && <label><input type="checkbox" checked={row.is_cover} aria-label={`تعيين الوسيط ${index + 1} كصورة غلاف`} onChange={() => { set('media', form.media.map((item, i) => ({ ...item, is_cover: i === index }))); setLocalMedia(files => files.map(item => ({ ...item, is_cover: false }))) }} /> غلاف</label>}<button type="button" onClick={() => set('media', form.media.filter((_, i) => i !== index))}>إزالة</button></div>)}</div>}</details>
        {!submission && <>
        <label className="places-check"><input type="checkbox" checked={form.is_visible} onChange={e => set('is_visible', e.target.checked)} />ظاهر على الخريطة العامة</label>
        <label className="places-check"><input type="checkbox" checked={form.is_verified} onChange={e => set('is_verified', e.target.checked)} />تم التحقق من معلومات المكان</label>
        <p>النشر يعتمد على خيار الظهور. التوثيق مستقل ويتطلب مراجعتك.</p>
        </>}
        <div className="form-save-bar"><p role="status">{busy ? 'جارٍ إرسال البيانات، يرجى الانتظار…' : 'راجع الاسم والموقع قبل الحفظ.'}</p><button className="places-primary" type="submit" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ المكان'}</button>{onCancel && <button type="button" onClick={onCancel}>إلغاء</button>}</div>
      </fieldset>
    </form>
    <aside className="location-guide" id="place-location-map" tabIndex={-1} aria-label="اختيار موقع المكان">
      <h2>أين يقع المكان؟</h2>
      <ol><li>قرّب الخريطة بزر + أو بعجلة الفأرة، واسحبها للوصول إلى الحي.</li><li>انقر مرة على موقع المنشأة لتظهر العلامة الذهبية.</li><li>اسحب العلامة لضبط موقعها عند مدخل المنشأة.</li></ol>
      <p className={`location-status ${validCoordinates ? 'is-selected' : ''}`} role="status">{validCoordinates ? '✓ تم تحديد الموقع — يمكنك تحريك العلامة لتصحيحه.' : 'لم يُحدد الموقع بعد — انقر على الخريطة للبدء.'}</p>
      <div className={busy ? 'map-saving' : ''} inert={busy || undefined}><PlacesMap coordinates={validCoordinates ? [form.longitude, form.latitude] : null} onCoordinates={([longitude, latitude]) => { if (saving.current) return; setForm(old => ({ ...old, longitude, latitude })); setErrors(old => ({ ...old, latitude: '', longitude: '' })) }} /></div>
    </aside>
  </div>
}
