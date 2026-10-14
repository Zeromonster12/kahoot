import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import confetti from 'canvas-confetti'
import { ArrowLeft, Crown, Download, ListOrdered, RotateCcw } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Spinner } from '../../../components/Spinner'
import { getLeaderboard, listAnswers } from '../../../lib/api'
import { formatScore } from '../../../lib/theme'
import { sound } from '../../../lib/sound'
import type { Game, LeaderboardEntry } from '../../../lib/types'
import { ResultsModal } from '../components/ResultsModal'
import { buildResultRows, correctCounts, downloadFile, resultsCsv, resultsFileName } from '../results'
import { errorMessage, playSound } from '../utils'

interface Props {
  gameId: string
  game: Game
  /** dramatické odhaľovanie so zvukmi; false = hra bola otvorená už ukončená */
  animated: boolean
}

interface Place {
  rank: number
  teams: LeaderboardEntry[]
}

const MEDALS: Record<number, { block: string; height: string; label: string }> = {
  1: { block: 'from-amber-300 to-amber-500', height: '23rem', label: '1. miesto' },
  2: { block: 'from-slate-200 to-slate-400', height: '16.5rem', label: '2. miesto' },
  3: { block: 'from-orange-300 to-orange-600', height: '11.5rem', label: '3. miesto' },
}

function formatPoints(n: number): string {
  const unit = n === 1 ? 'bod' : n >= 2 && n <= 4 ? 'body' : 'bodov'
  return `${formatScore(n)} ${unit}`
}

/** Konfety z oboch strán; vráti funkciu na zastavenie. */
function celebrate(): () => void {
  const base = {
    colors: ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#ffd54a', '#ffffff'],
    disableForReducedMotion: true,
    zIndex: 40,
    scalar: 1.3,
  }
  confetti({ ...base, particleCount: 180, spread: 110, startVelocity: 60, origin: { x: 0.5, y: 0.6 } })
  const end = Date.now() + 2800
  const id = window.setInterval(() => {
    if (Date.now() > end) {
      window.clearInterval(id)
      return
    }
    confetti({ ...base, particleCount: 7, angle: 60, spread: 65, startVelocity: 70, origin: { x: 0, y: 0.8 } })
    confetti({ ...base, particleCount: 7, angle: 120, spread: 65, startVelocity: 70, origin: { x: 1, y: 0.8 } })
  }, 120)
  return () => {
    window.clearInterval(id)
    confetti.reset()
  }
}

/** Stupne víťazov: 3. → 2. → 1. miesto, pri zhode bodov viac tímov na jednom stupni. */
export function PodiumScreen({ gameId, game, animated }: Props) {
  const navigate = useNavigate()
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [correct, setCorrect] = useState<Map<string, number> | null>(null)
  const [shown, setShown] = useState(animated ? 0 : 3)
  const [done, setDone] = useState(!animated)
  const [showAll, setShowAll] = useState(false)

  const loadBoard = useCallback(async () => {
    setBoardError(null)
    try {
      setBoard(await getLeaderboard(gameId))
    } catch (e) {
      setBoardError(errorMessage(e))
    }
  }, [gameId])

  useEffect(() => {
    loadBoard()
    listAnswers(gameId)
      .then((rows) => setCorrect(correctCounts(rows)))
      .catch(() => {})
  }, [gameId, loadBoard])

  // stupne 1. – 3. miesta podľa poradia zo servera (rank() – zhody majú rovnaké poradie)
  const places = useMemo<Place[]>(() => {
    if (!board) return []
    return [1, 2, 3]
      .map((rank) => ({ rank, teams: board.filter((e) => e.rank === rank) }))
      .filter((p) => p.teams.length > 0)
  }, [board])
  const placeCount = places.length
  const loaded = board !== null

  // dramatické odhaľovanie
  useEffect(() => {
    if (!animated || !loaded) return
    if (placeCount === 0) {
      setDone(true)
      return
    }
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    const stop = { confetti: null as (() => void) | null }

    at(250, () => playSound(() => sound.drumroll(1.8)))
    let t = 2200
    for (let step = 1; step <= placeCount; step++) {
      const winner = step === placeCount
      if (winner && step > 1) {
        t += 500
        at(t, () => playSound(() => sound.drumroll(1.8)))
        t += 2000
      }
      at(t, () => {
        setShown(step)
        if (winner) {
          playSound(sound.fanfare)
          stop.confetti = celebrate()
        } else {
          playSound(sound.join)
        }
      })
      t += 1600
    }
    at(t, () => setDone(true))

    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      stop.confetti?.()
    }
  }, [animated, loaded, placeCount])

  const rows = useMemo(() => buildResultRows(board ?? [], correct), [board, correct])

  const download = async () => {
    if (!board) return
    let counts = correct
    if (!counts) {
      counts = await listAnswers(gameId)
        .then(correctCounts)
        .catch(() => null)
      if (counts) setCorrect(counts)
    }
    const date = new Date(game.finished_at ?? Date.now())
    downloadFile(resultsFileName(game.quiz_title, date), resultsCsv(buildResultRows(board, counts)))
  }

  // stĺpce zľava: 2. stupeň, 1. stupeň, 3. stupeň
  const layout = [1, 0, 2].filter((i) => i < placeCount)

  return (
    <div className="flex h-full flex-col items-center px-8 pb-6">
      <motion.div
        className="shrink-0 text-center"
        initial={animated ? { y: -50, opacity: 0, scale: 0.8 } : false}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
      >
        <h2 className="text-[3.75rem] leading-none font-black text-shadow">Výsledky</h2>
        <p className="mt-2 line-clamp-1 text-[1.6rem] font-bold break-all opacity-80">{game.quiz_title}</p>
      </motion.div>

      <div className="flex min-h-0 w-full flex-1 items-end justify-center gap-6 pt-4">
        {boardError ? (
          <div className="game-card mb-16 flex flex-col items-center gap-5 self-center px-10 py-8 text-center">
            <p className="text-[1.75rem] font-extrabold">Výsledky sa nepodarilo načítať.</p>
            <p className="text-[1.25rem] text-gray-600">{boardError}</p>
            <Button variant="brand" size="lg" icon={<RotateCcw className="size-5" />} onClick={loadBoard}>
              Skúsiť znova
            </Button>
          </div>
        ) : !board ? (
          <div className="grid flex-1 place-items-center self-stretch">
            <Spinner className="size-14" />
          </div>
        ) : placeCount === 0 ? (
          <p className="mb-24 self-center text-[2.25rem] font-black opacity-85">Do hry sa nezapojil žiadny tím.</p>
        ) : (
          layout.map((i) => (
            <PodiumColumn key={places[i].rank} place={places[i]} visible={i >= placeCount - shown} animated={animated} />
          ))
        )}
      </div>

      <div className="flex h-[6.5rem] shrink-0 items-end justify-center">
        <AnimatePresence>
          {done && (
            <motion.div
              className="flex items-center gap-4"
              initial={animated ? { y: 30, opacity: 0 } : false}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            >
              <Button variant="white" size="xl" icon={<ListOrdered className="size-7" />} disabled={!board} onClick={() => setShowAll(true)}>
                Celé poradie
              </Button>
              <Button variant="white" size="xl" icon={<Download className="size-7" />} disabled={!board} onClick={download}>
                Stiahnuť výsledky (CSV)
              </Button>
              <Button variant="primary" size="xl" icon={<ArrowLeft className="size-7" />} onClick={() => navigate('/admin')}>
                Späť do administrácie
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ResultsModal open={showAll} rows={rows} questionCount={game.question_count} onClose={() => setShowAll(false)} />
    </div>
  )
}

function PodiumColumn({ place, visible, animated }: { place: Place; visible: boolean; animated: boolean }) {
  const medal = MEDALS[place.rank]
  const many = place.teams.length
  const shownTeams = place.teams.slice(0, 4)
  const nameSize = many === 1 ? 'text-[2.6rem] line-clamp-2' : many === 2 ? 'text-[2.1rem] line-clamp-1' : 'text-[1.6rem] line-clamp-1'

  return (
    <div className="flex w-[27rem] flex-col items-center justify-end" aria-label={medal.label}>
      <AnimatePresence>
        {visible && (
          <motion.div
            className="mb-4 flex w-full flex-col items-center text-center"
            initial={animated ? { y: 50, opacity: 0, scale: 0.5 } : false}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 15, delay: animated ? 0.45 : 0 }}
          >
            {place.rank === 1 && (
              <motion.div
                initial={animated ? { y: -60, rotate: -25, opacity: 0 } : false}
                animate={{ y: 0, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 12, delay: animated ? 0.75 : 0 }}
              >
                <Crown className="size-[4.5rem] text-amber-300 drop-shadow-[0_0.25rem_0_rgb(0_0_0/0.25)]" fill="currentColor" aria-hidden />
              </motion.div>
            )}
            {shownTeams.map((t) => (
              <p key={t.team_id} className={`w-full leading-tight font-black break-words text-shadow ${nameSize}`}>
                {t.name}
              </p>
            ))}
            {many > shownTeams.length && (
              <p className="text-[1.3rem] font-bold opacity-85">a ďalší ({many - shownTeams.length})</p>
            )}
            <p className="mt-2 rounded-full bg-black/25 px-5 py-1 text-[1.75rem] font-extrabold tabular-nums">
              {formatPoints(place.teams[0].score)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        className={`flex w-full justify-center overflow-hidden rounded-t-2xl bg-linear-to-b shadow-[inset_0_-0.5rem_0_rgb(0_0_0/0.15)] ${medal.block}`}
        initial={animated ? { height: 0 } : false}
        animate={{ height: visible ? medal.height : 0 }}
        transition={{ type: 'spring', stiffness: 110, damping: 17 }}
      >
        <span className="mt-4 text-[6rem] leading-none font-black text-white text-shadow">{place.rank}</span>
      </motion.div>
    </div>
  )
}
