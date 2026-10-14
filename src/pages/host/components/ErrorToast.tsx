import { AnimatePresence, motion } from 'motion/react'
import { RotateCcw, TriangleAlert, X } from 'lucide-react'
import { Button } from '../../../components/Button'
import type { Toast } from '../hooks/useHostActions'

export function ErrorToast({ toast, onDismiss }: { toast: Toast | null; onDismiss: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-6">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="alert"
            className="pointer-events-auto flex max-w-[72rem] items-center gap-5 rounded-xl bg-white py-4 pr-4 pl-6 text-ink shadow-[0_8px_0_rgb(0_0_0/0.25)] ring-4 ring-ans-red"
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <TriangleAlert className="size-10 shrink-0 text-ans-red" aria-hidden />
            <div className="min-w-0">
              <p className="text-[1.4rem] font-extrabold">Niečo sa nepodarilo</p>
              <p className="text-[1.2rem] break-words text-gray-600">{toast.message}</p>
            </div>
            {toast.retry && (
              <Button variant="danger" size="lg" icon={<RotateCcw className="size-5" />} onClick={toast.retry}>
                Skúsiť znova
              </Button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="grid size-11 shrink-0 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100"
              aria-label="Zavrieť"
              title="Zavrieť"
            >
              <X className="size-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
