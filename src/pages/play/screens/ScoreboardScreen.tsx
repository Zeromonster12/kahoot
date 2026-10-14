import { motion } from 'motion/react'
import { formatScore } from '../../../lib/theme'
import type { LeaderboardEntry, TeamState } from '../../../lib/types'
import { useLeaderboard } from '../hooks'
import { ofTeams, pluralPoints, questionsLeftText } from '../ui'

function motivation(rank: number, count: number): string {
  if (rank === 1) return 'Ste na čele! Ubráňte prvé miesto 🔥'
  if (rank <= 3) return 'Ste na stupňoch víťazov. Len tak ďalej!'
  if (rank <= Math.ceil(count / 2)) return 'Držíte sa v prvej polovici – skvelá práca!'
  return 'Nevzdávajte to, ešte sa to dá otočiť!'
}

/** Najbližší tím pred nami a o koľko bodov zaostávame. */
function chase(board: LeaderboardEntry[] | null, teamId: string, score: number) {
  if (!board) return null
  const ahead = board.filter((e) => e.team_id !== teamId && e.score > score)
  if (!ahead.length) return null
  const next = ahead.reduce((a, b) => (b.score < a.score ? b : a))
  return { name: next.name, gap: next.score - score }
}

/** Priebežné poradie tímu po otázke. */
export function ScoreboardScreen({
  gameId,
  teamId,
  questionIndex,
  questionsLeft,
  state,
}: {
  gameId: string
  teamId: string
  questionIndex: number
  questionsLeft: number
  state: TeamState
}) {
  const board = useLeaderboard(gameId, `scoreboard:${questionIndex}`)
  const behind = state.rank > 1 ? chase(board, teamId, state.score) : null
  const top3 = state.rank <= 3

  return (
    <div className="my-auto flex flex-col items-center gap-4 py-6 text-center">
      <p className="text-sm font-extrabold tracking-widest text-white/75 uppercase">Priebežné poradie</p>

      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 14 }}
        className={`flex size-32 items-center justify-center rounded-full shadow-[0_6px_0_rgb(0_0_0/0.2)] ${
          top3 ? 'bg-white text-brand-700' : 'bg-white/15 text-white'
        }`}
      >
        <span className="text-6xl font-black tabular-nums">{state.rank}.</span>
      </motion.div>

      <div>
        <h1 className="text-3xl font-black text-shadow">Ste na {state.rank}. mieste</h1>
        <p className="text-lg font-bold text-white/85">{ofTeams(state.team_count)}</p>
      </div>

      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="game-card px-6 py-3"
      >
        <p className="text-3xl font-black text-brand-700 tabular-nums">{formatScore(state.score)}</p>
        <p className="text-xs font-extrabold tracking-widest text-gray-500 uppercase">{pluralPoints(state.score)}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex max-w-sm flex-col gap-1.5"
      >
        <p className="text-lg leading-snug font-extrabold">{motivation(state.rank, state.team_count)}</p>
        {behind && (
          <p className="text-sm font-semibold text-white/85">
            Na tím „{behind.name}“ strácate {formatScore(behind.gap)} {pluralPoints(behind.gap)}.
          </p>
        )}
        <p className="text-sm font-semibold text-white/70">{questionsLeftText(questionsLeft)}</p>
      </motion.div>
    </div>
  )
}
