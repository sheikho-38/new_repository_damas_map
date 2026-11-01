// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MediaFilePicker from './MediaFilePicker'
import { validateMediaFile } from './mediaValidation'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
const file = (name: string, size: number) => {
  const value = new File([], name)
  Object.defineProperty(value, 'size', { value: size })
  return value
}

describe('media file selection', () => {
  it('accepts supported images up to 5 MB and rejects unsupported or oversized files', () => {
    expect(validateMediaFile(file('place.jpeg', 5 * 1024 * 1024))).toBe('')
    expect(validateMediaFile(file('place.webp', 5 * 1024 * 1024 + 1))).toContain('5 ميغابايت')
    expect(validateMediaFile(file('place.gif', 100))).toContain('الصيغ المقبولة')
  })

  it('requires MP4 videos between 15 and 35 MB and 30 to 60 seconds', () => {
    const video = file('clip.mp4', 20 * 1024 * 1024)
    expect(validateMediaFile(video, 30)).toBe('')
    expect(validateMediaFile(video, 60)).toBe('')
    expect(validateMediaFile(video, 29.9)).toContain('30 و60')
    expect(validateMediaFile(video, 60.1)).toContain('30 و60')
    expect(validateMediaFile(video, Number.NaN)).toContain('تعذرت قراءة')
    expect(validateMediaFile(file('clip.mp4', 14 * 1024 * 1024), 40)).toContain('15 و35')
    expect(validateMediaFile(file('clip.mp4', 36 * 1024 * 1024), 40)).toContain('15 و35')
  })

  it('adds valid files from the file chooser and reports invalid selections', async () => {
    const change = vi.fn()
    render(<MediaFilePicker files={[]} onChange={change} onCoverChange={vi.fn()} />)
    const input = screen.getByLabelText('اختيار الصور والفيديو')
    fireEvent.change(input, { target: { files: [file('place.png', 1024)] } })
    expect(change).toHaveBeenCalledWith([{ file: expect.objectContaining({ name: 'place.png' }), is_cover: false }])
    fireEvent.change(input, { target: { files: [file('place.gif', 1024)] } })
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(change).toHaveBeenCalledTimes(1)
  })

  it('lets the user mark a selected image as the cover', () => {
    const image = file('cover.png', 1024)
    const change = vi.fn()
    const cover = vi.fn()
    render(<MediaFilePicker files={[{ file: image, is_cover: false }]} onChange={change} onCoverChange={cover} />)
    fireEvent.click(screen.getByLabelText('تعيين cover.png كصورة غلاف'))
    expect(cover).toHaveBeenCalledWith(0)
  })
})
