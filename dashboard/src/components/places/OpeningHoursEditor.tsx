import { useState } from 'react'

const days = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
export default function OpeningHoursEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (hours: Record<string, unknown>) => void }) {
  const [selected, setSelected] = useState(days)
  const [mode, setMode] = useState('hours')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')
  const [notice, setNotice] = useState('')
  const invalid = !selected.length || (mode === 'hours' && (!start || !end || start === end))
  const apply = () => {
    if (invalid) return
    const text = mode === 'closed' ? 'مغلق' : mode === 'all-day' ? '24/7' : `${start}–${end}`
    onChange({ ...value, ...Object.fromEntries(selected.map(day => [day, text])) })
    setNotice(`تم تطبيق الدوام على ${selected.length} أيام. احفظ المكان لتثبيت التغييرات.`)
  }
  return <details className="hours-editor"><summary>ساعات العمل</summary>
    <p>حدد الأيام المتشابهة وأدخل دوامها مرة واحدة، ثم اضغط «تطبيق على الأيام المختارة». لتعديل يوم مختلف، اختره وحده وطبّق دوامه.</p>
    <div className="places-row"><button type="button" onClick={() => setSelected(days)}>كل الأيام</button><button type="button" onClick={() => setSelected([])}>إلغاء الاختيار</button></div>
    <div className="hours-days">{days.map(day => <label className="places-check" key={day}><input type="checkbox" checked={selected.includes(day)} onChange={e => { setSelected(old => e.target.checked ? [...old, day] : old.filter(d => d !== day)); setNotice('') }} />{day}</label>)}</div>
    <label>نوع الدوام<select value={mode} onChange={e => { setMode(e.target.value); setNotice('') }}><option value="hours">ساعات محددة</option><option value="closed">مغلق</option><option value="all-day">24 ساعة</option></select></label>
    {mode === 'hours' && <div className="places-row coordinate-fields"><label>من<input type="time" value={start} onChange={e => { setStart(e.target.value); setNotice('') }} /></label><label>إلى<input type="time" value={end} onChange={e => { setEnd(e.target.value); setNotice('') }} /></label></div>}
    {mode === 'hours' && start && end && end < start && <p>ينتهي هذا الدوام بعد منتصف الليل في اليوم التالي.</p>}
    <button type="button" disabled={invalid} onClick={apply}>تطبيق على الأيام المختارة</button>
    {invalid && <p className="field-error">اختر يومًا واحدًا على الأقل ووقت بداية ونهاية مختلفين، أو اختر «24 ساعة».</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="hours-preview" aria-label="جدول الدوام الحالي">{days.map(day => <div key={day}><span>{day}</span><bdi>{typeof value[day] === 'string' && value[day] ? value[day] === '24/7' ? '24 ساعة' : String(value[day]) : 'غير محدد'}</bdi></div>)}</div>
  </details>
}
