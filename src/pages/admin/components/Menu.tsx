import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { EllipsisVertical } from 'lucide-react'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

/** Rozbaľovacie menu („⋮“). Šípky hore/dole, Esc zatvára, klik mimo zatvára. */
export function Menu({
  items,
  label = 'Ďalšie možnosti',
  className = '',
  triggerClassName = '',
  icon,
}: {
  items: MenuItem[]
  label?: string
  className?: string
  triggerClassName?: string
  /** ikona tlačidla (predvolene „⋮“) */
  icon?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    // zameraj prvú položku
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus())
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  function toggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setUp(window.innerHeight - rect.bottom < 48 * items.length + 24 && rect.top > window.innerHeight / 2)
    }
    setOpen((o) => !o)
  }

  function close(focusTrigger = true) {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!open) return
    const els = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])]
    const i = els.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      els[(i + 1) % els.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      els[(i - 1 + els.length) % els.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      els[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      els[els.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        className={`inline-flex size-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-ink aria-expanded:bg-gray-100 aria-expanded:text-ink ${triggerClassName}`}
      >
        {icon ?? <EllipsisVertical className="size-5" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            id={menuId}
            role="menu"
            aria-label={label}
            initial={{ opacity: 0, scale: 0.95, y: up ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
            transition={{ duration: 0.14 }}
            className={`absolute right-0 z-40 min-w-52 overflow-hidden rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl ${
              up ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'
            }`}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  close(false)
                  item.onSelect()
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold outline-none transition disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 ${
                  item.danger
                    ? 'text-ans-red hover:bg-red-50 focus-visible:bg-red-50'
                    : 'text-ink hover:bg-gray-100 focus-visible:bg-gray-100'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
