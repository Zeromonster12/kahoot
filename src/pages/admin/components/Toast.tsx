import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'

// Jednoduché oznámenia („toasty“). Volaj toast.success('…') odkiaľkoľvek
// a na stránke vykresli <Toaster />. Oznámenie prežije aj presmerovanie na inú admin stránku.

type Kind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: Kind
  message: string
}

let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function emit() {
  for (const l of listeners) l()
}

function dismiss(id: number) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  items = items.filter((t) => t.id !== id)
  emit()
}

function show(kind: Kind, message: string) {
  const id = nextId++
  // rovnaká správa sa nezobrazí dvakrát naraz
  items = [...items.filter((t) => t.message !== message), { id, kind, message }].slice(-4)
  timers.set(id, setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 3500))
  emit()
}

export const toast = {
  success: (message: string) => show('success', message),
  error: (message: string) => show('error', message),
  info: (message: string) => show('info', message),
  dismiss,
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

const STYLES: Record<Kind, { icon: typeof Info; color: string }> = {
  success: { icon: CircleCheck, color: 'text-emerald-400' },
  error: { icon: CircleAlert, color: 'text-red-400' },
  info: { icon: Info, color: 'text-brand-300' },
}

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => items)
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {list.map((t) => {
          const { icon: Icon, color } = STYLES[t.kind]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95, transition: { duration: 0.15 } }}
              className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-xl"
              role={t.kind === 'error' ? 'alert' : undefined}
            >
              <Icon className={`mt-px size-5 shrink-0 ${color}`} aria-hidden />
              <p className="min-w-0 flex-1 leading-snug">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="-my-1 -mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Zavrieť oznámenie"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>,
    document.body,
  )
}
