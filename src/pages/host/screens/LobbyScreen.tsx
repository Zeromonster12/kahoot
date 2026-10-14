import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import { Play, Users, X } from 'lucide-react'
import { AnswerShape } from '../../../components/AnswerShape'
import { Button } from '../../../components/Button'
import { ANSWER_STYLES, pluralQuestions, pluralTeams } from '../../../lib/theme'
import { sound } from '../../../lib/sound'
import type { Game, Team } from '../../../lib/types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { formatPin, playSound, teamColor } from '../utils'

interface Props {
  game: Game
  teams: Team[] | null
  starting: boolean
  onStart: () => void
  /** vyhodí tím; chyby rieši volajúci (nevyhadzuje) */
  onKick: (team: Team) => Promise<void>
}

function chipClass(n: number): string {
  if (n <= 14) return 'px-7 py-3.5 text-[2.1rem]'
  if (n <= 36) return 'px-5 py-2.5 text-[1.7rem]'
  if (n <= 90) return 'px-4 py-2 text-[1.35rem]'
  return 'px-3 py-1.5 text-[1.05rem]'
}

export function LobbyScreen({ game, teams, starting, onStart, onKick }: Props) {
  const [kickTarget, setKickTarget] = useState<Team | null>(null)
  const [kicking, setKicking] = useState(false)
  const count = teams?.length ?? 0
  const host = window.location.host
  const joinUrl = `${window.location.origin}/?pin=${game.pin}`

  // zvuk pri príchode nového tímu – nie pri prvom načítaní zoznamu
  const seen = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!teams) return
    if (!seen.current) {
      seen.current = new Set(teams.map((t) => t.id))
      return
    }
    let fresh = false
    for (const t of teams) {
      if (!seen.current.has(t.id)) {
        seen.current.add(t.id)
        fresh = true
      }
    }
    if (fresh) playSound(sound.join)
  }, [teams])

  const confirmKick = async () => {
    if (!kickTarget) return
    setKicking(true)
    await onKick(kickTarget)
    setKicking(false)
    setKickTarget(null)
  }

  return (
    <div className="flex h-full flex-col items-center gap-5 px-8 pb-6">
      {/* PIN + QR */}
      <div className="flex shrink-0 items-stretch gap-5">
        <motion.div
          className="game-card flex flex-col justify-center px-10 py-5"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        >
          <p className="text-[2rem] font-bold text-gray-600">
            Pripojte sa na <span className="font-black text-brand-700">{host}</span>
          </p>
          <div className="mt-1 flex items-baseline gap-5">
            <span className="text-[2rem] font-extrabold text-gray-600">PIN hry:</span>
            <span className="text-[7rem] leading-none font-black tracking-[0.06em] tabular-nums" aria-label={`PIN ${game.pin}`}>
              {formatPin(game.pin)}
            </span>
          </div>
        </motion.div>
        <motion.div
          className="game-card flex flex-col items-center justify-center gap-2 px-5 py-4"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.08 }}
        >
          <QRCodeSVG value={joinUrl} size={512} level="M" marginSize={0} className="size-[11rem]" title="QR kód na pripojenie" />
          <p className="text-[1.15rem] font-extrabold text-gray-600">Naskenujte mobilom</p>
        </motion.div>
      </div>

      {/* názov kvízu */}
      <div className="max-w-full shrink-0 text-center">
        <h1 className="line-clamp-1 text-[2.75rem] leading-tight font-black break-all text-shadow">{game.quiz_title}</h1>
        <p className="text-[1.4rem] font-bold opacity-80">{pluralQuestions(game.question_count)}</p>
      </div>

      {/* počet tímov + spustenie */}
      <div className="flex w-full max-w-[110rem] shrink-0 items-center justify-between gap-6">
        <div className="flex items-center gap-3 rounded-full bg-black/25 px-7 py-3 text-[2rem] font-black">
          <Users className="size-9" aria-hidden />
          <motion.span
            key={count}
            initial={{ scale: 1.35 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            className="tabular-nums"
          >
            {pluralTeams(count)}
          </motion.span>
        </div>
        <Button
          variant="white"
          size="xl"
          className="h-[5.5rem]! rounded-xl! px-14! text-[2.5rem]!"
          icon={<Play className="size-9" fill="currentColor" aria-hidden />}
          disabled={count === 0}
          loading={starting}
          onClick={onStart}
          title={count === 0 ? 'Počkajte, kým sa pripojí aspoň jeden tím' : 'Spustiť hru (medzerník)'}
        >
          Spustiť
        </Button>
      </div>

      {/* tímy */}
      <div className="min-h-0 w-full max-w-[110rem] flex-1 overflow-y-auto rounded-2xl bg-black/15 p-5">
        {count === 0 ? (
          <Waiting host={host} />
        ) : (
          <ul className="flex flex-wrap content-start justify-center gap-3">
            <AnimatePresence mode="popLayout">
              {teams?.map((t) => (
                <motion.li
                  key={t.id}
                  layout
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                >
                  <button
                    type="button"
                    onClick={() => setKickTarget(t)}
                    title={`Vyhodiť tím ${t.name}`}
                    className={`group relative inline-flex max-w-[40rem] items-center rounded-xl font-extrabold text-white shadow-[0_0.3rem_0_rgb(0_0_0/0.25)] transition hover:brightness-110 ${chipClass(count)}`}
                    style={{ backgroundColor: teamColor(t.id) }}
                  >
                    <span className="truncate text-shadow">{t.name}</span>
                    <span
                      className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full bg-ink text-white opacity-0 shadow transition group-hover:opacity-100 group-focus-visible:opacity-100"
                      aria-hidden
                    >
                      <X className="size-5" />
                    </span>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={kickTarget !== null}
        title={`Vyhodiť tím „${kickTarget?.name ?? ''}“?`}
        message="Tím zmizne z hry. Ak bude chcieť hrať ďalej, musí sa pripojiť znova."
        confirmLabel="Vyhodiť"
        danger
        busy={kicking}
        onConfirm={confirmKick}
        onCancel={() => !kicking && setKickTarget(null)}
      />
    </div>
  )
}

function Waiting({ host }: { host: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <div className="flex gap-4" aria-hidden>
        {ANSWER_STYLES.map((s, i) => (
          <motion.span
            key={s.letter}
            className={`grid size-16 place-items-center rounded-xl shadow-[0_0.3rem_0_rgb(0_0_0/0.2)] ${s.bg}`}
            animate={{ y: [0, -22, 0], rotate: [0, i % 2 ? 8 : -8, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
          >
            <AnswerShape shape={s.shape} className="size-9" />
          </motion.span>
        ))}
      </div>
      <p className="text-[2.75rem] font-black text-shadow">Čakáme na tímy…</p>
      <p className="text-[1.5rem] font-bold opacity-75">
        Otvorte <span className="font-black">{host}</span> a zadajte PIN, alebo naskenujte QR kód.
      </p>
    </div>
  )
}
