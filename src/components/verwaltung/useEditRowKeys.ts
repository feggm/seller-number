import { useEffect, useRef, type KeyboardEvent } from 'react'

/**
 * The keyboard of an inline edit row: the first field takes focus when the row opens, Escape
 * closes the row without saving. Enter needs nothing here — inside the form it submits the
 * form. Keys from a dialog the row opened (a portal, not a DOM child) are left alone.
 */
export const useEditRowKeys = (onClose: () => void) => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLInputElement>('input:not([disabled])')?.focus()
  }, [])
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape' || !e.currentTarget.contains(e.target as Node)) return
    e.stopPropagation()
    onClose()
  }
  return { ref, onKeyDown }
}
