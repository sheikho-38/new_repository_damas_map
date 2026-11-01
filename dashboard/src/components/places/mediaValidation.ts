const MB = 1024 * 1024

export function validateMediaFile(file: File, duration?: number) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext))
    return file.size <= 5 * MB ? '' : 'حجم الصورة يجب ألا يتجاوز 5 ميغابايت.'
  if (ext !== 'mp4') return 'الصيغ المقبولة: JPG وJPEG وPNG وWEBP وMP4.'
  if (file.size < 15 * MB || file.size > 35 * MB) return 'حجم الفيديو يجب أن يكون بين 15 و35 ميغابايت.'
  if (duration === undefined || !Number.isFinite(duration)) return 'تعذرت قراءة مدة الفيديو.'
  if (duration < 30 || duration > 60) return 'مدة الفيديو يجب أن تكون بين 30 و60 ثانية.'
  return ''
}
