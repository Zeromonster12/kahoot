import { motion } from 'motion/react'
import { Users, WifiOff } from 'lucide-react'
import { formatScore } from '../../lib/theme'

/** Horná lišta: názov tímu, číslo otázky, skóre (+ hlásenie o výpadku spojenia). */
export function PlayHeader({
  name,
  score,
  counter,
  reconnecting,
}: {
  name: string
  score: number | null
  counter?: string
  reconnecting: boolean
}) {
  return (
    <header className="relative z-10 grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-2 pl-[max(0.75rem,env(safe-area-inset-left))]">
      <div className="flex min-w-0 justify-self-start">
        <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-black/20 py-1.5 pr-3 pl-2.5 text-sm font-extrabold">
          <Users className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{name}</span>
        </span>
      </div>

      <div className="text-sm font-black tabular-nums text-white/90" aria-label={counter ? `Otázka ${counter}` : undefined}>
        {counter}
      </div>

      <div className="justify-self-end">
        {score !== null && (
          <motion.span
            key={score}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            className="inline-block rounded-full bg-white px-3 py-1 text-sm font-black text-ink tabular-nums shadow-[0_3px_0_rgb(0_0_0/0.2)]"
            aria-label={`Skóre ${formatScore(score)}`}
          >
            {formatScore(score)}
          </motion.span>
        )}
      </div>

      {reconnecting && (
        <div className="pointer-events-none absolute inset-x-0 top-full flex justify-center px-3" role="status">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold shadow-lg"
          >
            <WifiOff className="size-3.5 animate-pulse" aria-hidden />
            Obnovujem spojenie…
          </motion.div>
        </div>
      )}
    </header>
  )
}
