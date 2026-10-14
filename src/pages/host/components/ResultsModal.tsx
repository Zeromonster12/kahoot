import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { formatScore } from '../../../lib/theme'
import type { ResultRow } from '../results'

const MEDAL_BG = ['bg-amber-400', 'bg-slate-300', 'bg-orange-400']

/** Celé poradie všetkých tímov (poradie, tím, body, správne odpovede). */
export function ResultsModal({
  open,
  rows,
  questionCount,
  onClose,
}: {
  open: boolean
  rows: ResultRow[]
  questionCount: number
  onClose: () => void
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // portál – rodičovské transformácie (animácie obrazoviek) by rozbili position: fixed
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="game-card flex max-h-full w-full max-w-[68rem] flex-col overflow-hidden"
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b-2 border-gray-100 px-8 py-5">
              <h2 id={titleId} className="text-[2.25rem] font-black">
                Celé poradie
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="grid size-12 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100"
                aria-label="Zavrieť"
                title="Zavrieť"
                autoFocus
              >
                <X className="size-7" />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto px-4 pb-4">
              {rows.length === 0 ? (
                <p className="py-12 text-center text-[1.5rem] font-bold text-gray-500">Do hry sa nezapojil žiadny tím.</p>
              ) : (
                <table className="w-full text-[1.4rem]">
                  <thead className="sticky top-0 bg-white text-left text-[1.05rem] tracking-wide text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 font-extrabold">Poradie</th>
                      <th className="px-4 py-3 font-extrabold">Tím</th>
                      <th className="px-4 py-3 text-right font-extrabold">Body</th>
                      <th className="px-4 py-3 text-right font-extrabold">Správne odpovede</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.team_id} className="border-t border-gray-100 even:bg-brand-50/50">
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-grid size-11 place-items-center rounded-full font-black tabular-nums ${
                              r.rank <= 3 ? `${MEDAL_BG[r.rank - 1]} text-ink` : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {r.rank}.
                          </span>
                        </td>
                        <td className="max-w-[30rem] truncate px-4 py-2.5 font-extrabold">{r.name}</td>
                        <td className="px-4 py-2.5 text-right font-black tabular-nums">{formatScore(r.score)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-gray-600 tabular-nums">
                          {r.correct === null ? '–' : `${r.correct} / ${questionCount}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
