import { Link } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ExternalLink, Gamepad2, RefreshCw, Trash2, Users } from 'lucide-react'
import type { GameStatus } from '../../../lib/types'
import { pluralTeams } from '../../../lib/theme'
import type { GameSummary } from '../data'
import { formatDateTime } from '../utils'
import { ErrorState, InlineError, Skeleton } from './States'

export const STATUS_LABELS: Record<GameStatus, string> = {
  lobby: 'Čaká na tímy',
  preview: 'Prebieha',
  question: 'Prebieha',
  reveal: 'Prebieha',
  scoreboard: 'Prebieha',
  finished: 'Skončená',
}

export function isRunning(status: GameStatus) {
  return status !== 'lobby' && status !== 'finished'
}

function StatusPill({ status }: { status: GameStatus }) {
  const style =
    status === 'finished'
      ? 'bg-gray-100 text-gray-600'
      : status === 'lobby'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-emerald-50 text-emerald-700'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${style}`}>
      {status !== 'finished' && (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-50" />
          <span className="relative inline-flex size-2 rounded-full bg-current" />
        </span>
      )}
      {STATUS_LABELS[status]}
    </span>
  )
}

interface Props {
  games: GameSummary[] | null
  error: string | null
  loading: boolean
  deletingId: string | null
  onRetry: () => void
  onDelete: (game: GameSummary) => void
}

export function RecentGames({ games, error, loading, deletingId, onRetry, onDelete }: Props) {
  return (
    <section aria-labelledby="recent-games" className="mt-14">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="recent-games" className="text-2xl font-black">
          Posledné hry
        </h2>
        <button
          type="button"
          onClick={onRetry}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-bold text-gray-500 transition hover:bg-gray-100 hover:text-ink disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Obnoviť
        </button>
      </div>

      {error && games && <InlineError message={error} onRetry={onRetry} />}
      {error && !games ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : !games ? (
        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-9 w-24" />
            </div>
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="flex items-center gap-4 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-8 text-gray-500">
          <Gamepad2 className="size-8 shrink-0 text-gray-300" />
          <p>
            Zatiaľ si nespustil žiadnu hru. Klikni na <b className="text-ink">Spustiť hru</b> pri niektorom kvíze – hra sa
            otvorí na projektore a tímy sa pripoja PIN-om.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <AnimatePresence initial={false}>
            {games.map((g) => (
              <motion.li
                key={g.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: deletingId === g.id ? 0.5 : 1 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5"
              >
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate font-bold">{g.quiz_title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-gray-500">
                    <span>{formatDateTime(g.created_at)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" aria-hidden />
                      {pluralTeams(g.teamCount)}
                    </span>
                    {isRunning(g.status) && g.question_index >= 0 && (
                      <span>
                        otázka {g.question_index + 1} z {g.question_count}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  PIN <span className="font-mono text-base font-bold tracking-wider text-ink">{g.pin ?? '—'}</span>
                </div>
                <div className="w-32">
                  <StatusPill status={g.status} />
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    to={`/host/${g.id}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border-2 border-gray-200 bg-white px-3 text-sm font-bold text-ink transition hover:border-brand-300 hover:bg-brand-50"
                  >
                    <ExternalLink className="size-4" />
                    Otvoriť
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDelete(g)}
                    disabled={deletingId === g.id}
                    className="inline-flex size-9 items-center justify-center rounded-md text-gray-400 transition hover:bg-red-50 hover:text-ans-red disabled:opacity-40"
                    aria-label={`Zmazať hru ${g.quiz_title}${g.pin ? ` (PIN ${g.pin})` : ''}`}
                    title="Zmazať hru"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  )
}
