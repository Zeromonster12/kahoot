import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { UserX, X } from 'lucide-react'
import { Button } from '../../../components/Button'
import { pluralTeams } from '../../../lib/theme'
import type { Team } from '../../../lib/types'
import { teamColor } from '../utils'

interface Props {
  open: boolean
  teams: Team[] | null
  /** vyhodí tím; chyby rieši volajúci (nevyhadzuje) */
  onKick: (team: Team) => Promise<void>
  onClose: () => void
}

/** Zoznam tímov počas hry – vyhodenie tímu (dvojklik: „Vyhodiť“ → „Naozaj?“). */
export function TeamsDialog({ open, teams, onKick, onClose }: Props) {
  const titleId = useId()
  const [armed, setArmed] = useState<string | null>(null)
  const [kicking, setKicking] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setArmed(null)
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const kick = async (team: Team) => {
    if (armed !== team.id) {
      setArmed(team.id)
      return
    }
    setKicking(team.id)
    await onKick(team)
    setKicking(null)
    setArmed(null)
  }

  const sorted = [...(teams ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'sk'))

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
            className="game-card flex max-h-[85vh] w-full max-w-[56rem] flex-col p-10"
            initial={{ scale: 0.85, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-[2.25rem] leading-tight font-black">
                  Tímy v hre
                </h2>
                <p className="mt-1 text-[1.25rem] text-gray-600">
                  {pluralTeams(sorted.length)} · vyhodený tím sa s rovnakým názvom nevráti
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
                aria-label="Zavrieť"
                autoFocus
              >
                <X className="size-7" />
              </button>
            </div>

            <ul className="mt-6 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {sorted.length === 0 && <li className="py-6 text-center text-[1.35rem] text-gray-500">Žiadne tímy.</li>}
              {sorted.map((t) => (
                <li key={t.id} className="flex items-center gap-4 rounded-xl bg-gray-50 px-4 py-3">
                  <span className="size-5 shrink-0 rounded-full" style={{ backgroundColor: teamColor(t.id) }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[1.5rem] font-extrabold text-ink">{t.name}</span>
                  <span className="text-[1.25rem] font-bold text-gray-500 tabular-nums">{t.score} b.</span>
                  <Button
                    variant={armed === t.id ? 'danger' : 'outline'}
                    size="md"
                    icon={<UserX className="size-5" aria-hidden />}
                    loading={kicking === t.id}
                    onClick={() => void kick(t)}
                  >
                    {armed === t.id ? 'Naozaj vyhodiť?' : 'Vyhodiť'}
                  </Button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
