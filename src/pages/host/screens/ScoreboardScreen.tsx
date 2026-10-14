import { useEffect, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { ChevronRight, ChevronUp, Crown } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Spinner } from '../../../components/Spinner'
import { formatScore } from '../../../lib/theme'
import type { AnswerRow, Team } from '../../../lib/types'
import { CountUp } from '../components/CountUp'
import { moreTeams, withRanks } from '../utils'

const TOP = 5
/** ako dlho sa ukazuje poradie pred touto otázkou, kým sa tímy prehodia */
const BEFORE_MS = 1300
/** ak sa odpovede nenačítajú, ukáž poradie aj bez "+body" */
const ANSWERS_TIMEOUT_MS = 2500

interface Row {
  id: string
  name: string
  score: number
  prev: number
  gained: number
  joined: number
}

interface Snapshot {
  before: (Row & { rank: number })[]
  after: (Row & { rank: number })[]
  total: number
  anyGain: boolean
}

function buildSnapshot(teams: Team[], answers: AnswerRow[]): Snapshot {
  const gained = new Map<string, number>()
  for (const a of answers) gained.set(a.team_id, (gained.get(a.team_id) ?? 0) + a.points)
  const rows: Row[] = teams.map((t) => {
    const g = gained.get(t.id) ?? 0
    return { id: t.id, name: t.name, score: t.score, gained: g, prev: Math.max(0, t.score - g), joined: Date.parse(t.created_at) }
  })
  const before = [...rows].sort((a, b) => b.prev - a.prev || a.joined - b.joined)
  const after = [...rows].sort((a, b) => b.score - a.score || a.joined - b.joined)
  return {
    before: withRanks(before, (r) => r.prev),
    after: withRanks(after, (r) => r.score),
    total: rows.length,
    anyGain: rows.some((r) => r.gained > 0),
  }
}

interface Props {
  teams: Team[] | null
  answers: AnswerRow[]
  answersReady: boolean
  /** koľko odpovedí server napočítal pri odhalení (games.question.answered) */
  expectedAnswers: number
  busy: boolean
  onNext: () => void
}

/** Priebežné poradie – top 5, tímy sa presunú z poradia pred otázkou na nové. */
export function ScoreboardScreen({ teams, answers, answersReady, expectedAnswers, busy, onNext }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [waited, setWaited] = useState(false)
  const [phase, setPhase] = useState<'before' | 'after'>('before')

  // dáta sa zafixujú, keď sú načítané tímy aj odpovede (neskoršie obnovenia nerušia animáciu)
  const answersComplete = answersReady && answers.length >= expectedAnswers
  if (!snapshot && teams && (answersComplete || waited)) setSnapshot(buildSnapshot(teams, answers))

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), ANSWERS_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!snapshot) return
    const t = setTimeout(() => setPhase('after'), snapshot.anyGain ? BEFORE_MS : 0)
    return () => clearTimeout(t)
  }, [snapshot])

  const rows = snapshot ? (phase === 'before' ? snapshot.before : snapshot.after).slice(0, TOP) : []
  const prevRank = new Map(snapshot?.before.map((r) => [r.id, r.rank]))
  const more = snapshot ? snapshot.total - TOP : 0

  return (
    <div className="flex h-full flex-col items-center px-8 pb-6">
      <motion.h2
        className="game-card shrink-0 px-12 py-3 text-[3rem] font-black"
        initial={{ y: -30, opacity: 0, rotate: -2 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      >
        Priebežné poradie
      </motion.h2>

      <div className="mt-7 flex min-h-0 w-full max-w-[92rem] flex-1 flex-col">
        {!snapshot ? (
          <div className="grid flex-1 place-items-center">
            <Spinner className="size-14" />
          </div>
        ) : snapshot.total === 0 ? (
          <p className="mt-10 text-center text-[2.25rem] font-black opacity-80">V hre nie sú žiadne tímy.</p>
        ) : (
          <LayoutGroup>
            <ol className="flex flex-col gap-3">
              <AnimatePresence mode="popLayout" initial={true}>
                {rows.map((r, i) => {
                  const leader = phase === 'after' && r.rank === 1 && r.score > 0
                  const movedUp = phase === 'after' && (prevRank.get(r.id) ?? r.rank) > r.rank
                  return (
                    <motion.li
                      key={r.id}
                      layout
                      initial={{ opacity: 0, x: -80 }}
                      animate={{ opacity: 1, x: 0, scale: leader ? 1.03 : 1 }}
                      exit={{ opacity: 0, x: 80 }}
                      transition={{
                        layout: { type: 'spring', stiffness: 170, damping: 22 },
                        default: { type: 'spring', stiffness: 260, damping: 24, delay: phase === 'before' ? i * 0.07 : 0 },
                      }}
                      className={`flex h-[6.75rem] items-center gap-6 rounded-xl px-6 text-ink shadow-[0_0.4rem_0_rgb(0_0_0/0.2)] ${
                        leader ? 'z-10 bg-amber-50 ring-[0.35rem] ring-amber-400' : 'bg-white'
                      }`}
                    >
                      <span
                        className={`grid size-[4.5rem] shrink-0 place-items-center rounded-full text-[2.25rem] font-black tabular-nums ${
                          leader ? 'bg-amber-400 text-ink' : 'bg-brand-700 text-white'
                        }`}
                      >
                        {leader ? <Crown className="size-[2.4rem]" strokeWidth={2.5} aria-label="1." /> : r.rank}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[2.6rem] font-extrabold">{r.name}</span>
                      <AnimatePresence>
                        {movedUp && (
                          <motion.span
                            className="shrink-0 text-ans-green"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            aria-label="Posun nahor"
                          >
                            <ChevronUp className="size-[2.75rem]" strokeWidth={3.5} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {r.gained > 0 && (
                        <motion.span
                          className="shrink-0 rounded-full bg-ans-green px-4 py-1 text-[1.75rem] font-black text-white tabular-nums"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 15, delay: 0.3 + i * 0.07 }}
                        >
                          +{formatScore(r.gained)}
                        </motion.span>
                      )}
                      <CountUp
                        from={r.prev}
                        value={phase === 'after' ? r.score : r.prev}
                        className="w-[12rem] shrink-0 text-right text-[2.9rem] font-black tabular-nums"
                      />
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ol>
            {more > 0 && (
              <motion.p
                className="mt-4 text-center text-[1.75rem] font-extrabold opacity-85"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
                transition={{ delay: 0.6 }}
              >
                {moreTeams(more)}
              </motion.p>
            )}
          </LayoutGroup>
        )}
      </div>

      <div className="flex w-full max-w-[92rem] shrink-0 justify-end">
        <Button variant="white" size="xl" loading={busy} onClick={onNext} title="Ďalšia otázka (medzerník)">
          Ďalej
          <ChevronRight className="size-7" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
