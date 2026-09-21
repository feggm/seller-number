import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * A read-only card shown while the trigger is hovered or focused. It renders into the body at
 * a fixed position, so it never grows the table's scroll container — a card inside an
 * `overflow-auto` box adds scrollbars nobody can use, because moving the mouse closes it.
 * Below the trigger when there is room, above it otherwise.
 */
export function HoverCard({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const show = (el: HTMLElement) => { setAnchor(el.getBoundingClientRect()); }
  const hide = () => { setAnchor(null); }
  const flip = anchor !== null && anchor.bottom + 160 > window.innerHeight
  return (
    <>
      <span
        className="cursor-help underline decoration-dotted"
        tabIndex={0}
        onMouseEnter={(e) => { show(e.currentTarget); }}
        onMouseLeave={hide}
        onFocus={(e) => { show(e.currentTarget); }}
        onBlur={hide}
      >
        {trigger}
      </span>
      {anchor &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-50 min-w-max rounded-md border bg-white p-2 text-xs shadow-md"
            style={
              flip
                ? { left: anchor.left, bottom: window.innerHeight - anchor.top + 4 }
                : { left: anchor.left, top: anchor.bottom + 4 }
            }
          >
            {children}
          </div>,
          document.body
        )}
    </>
  )
}
