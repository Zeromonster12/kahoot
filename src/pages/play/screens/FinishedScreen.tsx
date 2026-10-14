import { useEffect } from 'react'
import { motion } from 'motion/react'
import { Medal, RotateCcw, Trophy } from 'lucide-react'
import type { Options as ConfettiOptions } from 'canvas-confetti'
import { Button } from '../../../components/Button'
import { formatScore } from '../../../lib/theme'
import type { TeamState } from '../../../lib/types'
import { useLeaderboard } from '../hooks'
import { ScreenLoading, ofTeams, pluralPoints } from '../ui'

const MEDALS: Record<number, { color: string; shadow: string }> = {
  1: { color: '#f5b400', shadow: '#b88600' },
  2: { color: '#aeb8c2', shadow: '#7d8893' },
  3: { color: '#cd7f32', shadow: '#965a1f' },
}

function finalLine(rank: number): string {
  if (rank === 1) return 'Gratulujeme, vyhrali ste!'
  if (rank === 2) return 'Strieborné miesto – skvelý výkon!'
  if (rank === 3) return 'Bronz! Ste na stupňoch víťazov.'
  return 'Dobrá práca! Nabudúce to bude ešte lepšie.'
}

/** Konečné umiestnenie tímu + top 3. */
export function FinishedScreen({
  gameId,
  teamId,
  fallback,
  onPlayAgain,
}: {
  gameId: string
  teamId: string
  /** stav tímu načítaný po skončení hry (ak rebríček nejde načítať) */
  fallback: TeamState | null
  onPlayAgain: () => void
}) {
  const board = useLeaderboard(gameId, 'finished')
  const own = board?.find((e) => e.team_id === teamId)
  const rank = own?.rank ?? fallback?.rank ?? null
  const score = own?.score ?? fallback?.score ?? 0
  const total = board?.length ?? fallback?.team_count ?? 0
  const medal = rank !== null ? MEDALS[rank] : undefined

  useConfetti(rank !== null && rank <= 3 ? rank : null)

  if (rank === null) return <ScreenLoading label="Sčítavame body…" />

  return (
    <div className="my-auto flex flex-col items-center gap-4 py-5 text-center">
      <p className="text-sm font-extrabold tracking-widest text-white/75 uppercase">Koniec hry!</p>

      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.1 }}
        className="relative flex size-28 items-center justify-center rounded-full sm:size-32"
        style={
          medal
            ? { backgroundColor: medal.color, boxShadow: `inset 0 -6px 0 ${medal.shadow}, 0 6px 0 rgb(0 0 0 / 0.2)` }
            : { backgroundColor: 'rgb(255 255 255 / 0.15)' }
        }
      >
        {rank === 1 ? (
          <Trophy className="size-14 text-white drop-shadow sm:size-16" strokeWidth={2.5} aria-hidden />
        ) : medal ? (
          <Medal className="size-14 text-white drop-shadow sm:size-16" strokeWidth={2.5} aria-hidden />
        ) : (
          <span className="text-5xl font-black tabular-nums">{rank}.</span>
        )}
      </motion.div>

      <div>
        <h1 className="text-3xl font-black text-shadow sm:text-4xl">
          {medal ? `${rank}. miesto!` : `Skončili ste na ${rank}. mieste`}
        </h1>
        <p className="text-base font-bold text-white/85">
          {ofTeams(total)} · {formatScore(score)} {pluralPoints(score)}
        </p>
      </div>

      <p className="max-w-sm text-lg leading-snug font-extrabold">{finalLine(rank)}</p>

      {board && board.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="game-card w-full max-w-sm p-3 text-left"
        >
          <p className="px-1 pb-2 text-xs font-extrabold tracking-widest text-gray-500 uppercase">Najlepšie tímy</p>
          <ol className="space-y-1.5">
            {board.slice(0, 3).map((e) => {
              const m = MEDALS[e.rank]
              const mine = e.team_id === teamId
              return (
                <li
                  key={e.team_id}
                  className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${mine ? 'bg-brand-50 ring-2 ring-brand-500' : ''}`}
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
                    style={{ backgroundColor: m?.color ?? '#6b7280' }}
                  >
                    {e.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-extrabold">{e.name}</span>
                  <span className="shrink-0 font-black text-brand-700 tabular-nums">{formatScore(e.score)}</span>
                </li>
              )
            })}
          </ol>
        </motion.div>
      )}

      <p className="text-xl font-black text-shadow">Ďakujeme za hru!</p>

      <Button variant="white" size="lg" icon={<RotateCcw className="size-5" />} onClick={onPlayAgain} className="touch-manipulation">
        Hrať znova
      </Button>
    </div>
  )
}

/** Konfety pre top 3 – knižnica sa načíta až v tejto chvíli. */
function useConfetti(rank: number | null) {
  useEffect(() => {
    if (rank === null) return
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    import('canvas-confetti')
      .then(({ default: confetti }) => {
        if (cancelled) return
        const colors = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#ffffff']
        const fire = (o: ConfettiOptions) => confetti({ colors, disableForReducedMotion: true, ...o })
        fire({ particleCount: rank === 1 ? 160 : 100, spread: 90, startVelocity: 45, origin: { y: 0.6 } })
        timers.push(setTimeout(() => fire({ particleCount: 70, angle: 60, spread: 65, origin: { x: 0, y: 0.75 } }), 450))
        timers.push(setTimeout(() => fire({ particleCount: 70, angle: 120, spread: 65, origin: { x: 1, y: 0.75 } }), 750))
        if (rank === 1) {
          timers.push(setTimeout(() => fire({ particleCount: 120, spread: 120, startVelocity: 35, origin: { y: 0.4 } }), 1400))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [rank])
}
