import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

let openCount = 0

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** malý text pod nadpisom */
  subtitle?: ReactNode
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** zakáže zavretie (napr. počas ukladania) */
  locked?: boolean
}

/** Dialógové okno: Esc zatvára, focus ostáva vo vnútri, po zatvorení sa vráti späť. */
export function Modal(props: ModalProps) {
  return createPortal(<AnimatePresence>{props.open && <ModalPanel {...props} />}</AnimatePresence>, document.body)
}

function ModalPanel({ onClose, title, subtitle, icon, children, footer, size = 'md', locked = false }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size]

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    // prvok s data-autofocus, inak prvé pole formulára, inak samotný panel
    const target =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>('[data-modal-body] input:not([disabled]), [data-modal-body] textarea:not([disabled])') ??
      panel
    target?.focus({ preventScroll: true })
    openCount++
    document.body.style.overflow = 'hidden'
    return () => {
      openCount--
      if (!openCount) document.body.style.overflow = ''
      previous?.focus?.({ preventScroll: true })
    }
  }, [])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (!locked) onClose()
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" onKeyDown={onKeyDown}>
      <motion.div
        className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={() => !locked && onClose()}
        aria-hidden
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full ${width} flex-col overflow-hidden rounded-t-2xl bg-white text-ink shadow-2xl outline-none sm:rounded-2xl`}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      >
        <div className="flex items-start gap-3 border-b border-gray-100 px-6 py-4">
          {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-extrabold leading-tight">
              {title}
            </h2>
            {subtitle && <div className="mt-0.5 text-sm text-gray-500">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            className="-mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-ink disabled:opacity-40"
            aria-label="Zavrieť"
          >
            <X className="size-5" />
          </button>
        </div>
        <div data-modal-body className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/70 px-6 py-3">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  )
}
