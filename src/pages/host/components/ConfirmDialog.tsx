import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '../../../components/Button'

interface Props {
  open: boolean
  title: string
  message?: ReactNode
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel, danger = false, busy = false, onConfirm, onCancel }: Props) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  // portál – rodičovské transformácie (animácie obrazoviek) by rozbili position: fixed
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="game-card w-full max-w-[46rem] p-10"
            initial={{ scale: 0.85, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId} className="text-[2.25rem] leading-tight font-black">
              {title}
            </h2>
            {message && <div className="mt-3 text-[1.35rem] text-gray-600">{message}</div>}
            <div className="mt-8 flex justify-end gap-4">
              {/* fokus na "Zrušiť" – Enter omylom nič neukončí */}
              <Button variant="outline" size="lg" onClick={onCancel} autoFocus>
                Zrušiť
              </Button>
              <Button variant={danger ? 'danger' : 'brand'} size="lg" loading={busy} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
