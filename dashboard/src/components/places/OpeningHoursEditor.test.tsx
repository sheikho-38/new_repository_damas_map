// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import OpeningHoursEditor from './OpeningHoursEditor'

afterEach(cleanup)
const open = () => fireEvent.click(screen.getByText('ساعات العمل'))
it('applies one schedule to all days', () => {
  const change = vi.fn()
  render(<OpeningHoursEditor value={{}} onChange={change} />)
  open()
  fireEvent.click(screen.getByText('تطبيق على الأيام المختارة'))
  expect(Object.values(change.mock.calls[0][0])).toEqual(Array(7).fill('09:00–17:00'))
  expect(screen.getByRole('status').textContent).toContain('7 أيام')
})
it('changes only selected days and preserves existing hours', () => {
  const change = vi.fn()
  render(<OpeningHoursEditor value={{ السبت: '10:00–18:00' }} onChange={change} />)
  open()
  fireEvent.click(screen.getByText('إلغاء الاختيار'))
  expect(screen.getByText('تطبيق على الأيام المختارة').hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: 'الجمعة' }))
  fireEvent.change(screen.getByLabelText('نوع الدوام'), { target: { value: 'closed' } })
  fireEvent.click(screen.getByText('تطبيق على الأيام المختارة'))
  expect(change).toHaveBeenCalledWith({ السبت: '10:00–18:00', الجمعة: 'مغلق' })
})
it('rejects equal start and end times', () => {
  render(<OpeningHoursEditor value={{}} onChange={vi.fn()} />)
  open()
  fireEvent.change(screen.getByLabelText('إلى'), { target: { value: '09:00' } })
  expect(screen.getByText('تطبيق على الأيام المختارة').hasAttribute('disabled')).toBe(true)
})
