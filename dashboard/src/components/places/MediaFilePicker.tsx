import { useRef, useState } from 'react'
import { validateMediaFile } from './mediaValidation'
import type { LocalMediaFile } from '../../types/places'
const extension = (file: File) => file.name.split('.').pop()?.toLowerCase() ?? ''
const MB = 1024 * 1024

async function inspectVideo(file: File) {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<number>((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => resolve(video.duration)
      video.onerror = () => reject(new Error('تعذرت قراءة مدة الفيديو.'))
      video.src = url
    })
  } finally { URL.revokeObjectURL(url) }
}

export default function MediaFilePicker({ files, onChange, onCoverChange }: { files: LocalMediaFile[]; onChange: (files: LocalMediaFile[]) => void; onCoverChange: (index: number) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  const addFiles = async (selected: File[]) => {
    const accepted: File[] = []
    const rejected: string[] = []
    for (const file of selected) {
      let duration: number | undefined
      if (extension(file) === 'mp4' && file.size >= 15 * MB && file.size <= 35 * MB) {
        try { duration = await inspectVideo(file) } catch { rejected.push(`${file.name}: تعذرت قراءة مدة الفيديو.`); continue }
      }
      const message = validateMediaFile(file, duration)
      if (message) rejected.push(`${file.name}: ${message}`)
      else accepted.push(file)
    }
    if (accepted.length) onChange([...files, ...accepted.map(file => ({ file, is_cover: false }))])
    setError(rejected.join(' '))
    if (input.current) input.current.value = ''
  }

  return <div className={`media-dropzone ${dragging ? 'is-dragging' : ''}`}
    onDragOver={event => { event.preventDefault(); setDragging(true) }}
    onDragLeave={() => setDragging(false)}
    onDrop={event => { event.preventDefault(); setDragging(false); void addFiles(Array.from(event.dataTransfer.files)) }}>
    <input ref={input} type="file" accept=".jpg,.jpeg,.png,.webp,.mp4" multiple hidden
      aria-label="اختيار الصور والفيديو" onChange={event => void addFiles(Array.from(event.target.files ?? []))} />
    <div className="media-drop-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5" /></svg></div>
    <strong>اسحب الصور والفيديو إلى هنا</strong>
    <span className="media-drop-divider">أو</span>
    <button className="media-browse-button" type="button" onClick={() => input.current?.click()}>استعراض الملفات</button>
    <div className="media-format-list"><span>JPG</span><span>JPEG</span><span>PNG</span><span>WEBP</span><span>MP4</span></div>
    <small>الصورة حتى 5 MB · الفيديو 15–35 MB ومدة 30–60 ثانية</small>
    {error && <p className="media-file-error" role="alert">{error}</p>}
    {files.length > 0 && <div className="media-selected-list" aria-live="polite">{files.map(({ file, is_cover }, index) => <div className="media-file-row" key={`${file.name}-${index}`}>
      <span className="media-file-badge" aria-hidden="true">{extension(file) === 'mp4' ? '▶' : '▧'}</span>
      <span className="media-file-details"><strong>{file.name}</strong><small>{(file.size / MB).toFixed(1)} MB</small></span>
      {extension(file) !== 'mp4' && <label className="media-cover-choice"><input type="checkbox" checked={is_cover} aria-label={`تعيين ${file.name} كصورة غلاف`} onChange={() => onCoverChange(index)} />غلاف</label>}
      <button type="button" aria-label={`حذف ${file.name}`} onClick={() => onChange(files.filter((_, i) => i !== index))}>×</button>
    </div>)}
    </div>}
  </div>
}
