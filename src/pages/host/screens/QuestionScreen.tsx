import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronRight, Lightbulb, SkipForward, Trophy } from 'lucide-react'
import { AnswerShape } from '../../../components/AnswerShape'
import { Button } from '../../../components/Button'
import { CountdownRing } from '../../../components/CountdownRing'
import { useCountdown } from '../../../lib/clock'
import { ANSWER_STYLES } from '../../../lib/theme'
import { sound } from '../../../lib/sound'
import type { AnswerRow, Game } from '../../../lib/types'
import { AnswerChart } from '../components/AnswerChart'
import { AnswerTiles } from '../components/AnswerTiles'
import { playSound, questionTextClass } from '../utils'

interface Props {
  game: Game
  teamCount: number
  /** počet tímov, ktoré už odpovedali (počas otázky) */
  answeredCount: number
  answers: AnswerRow[]
  /** veľkosť 1 rem v px (pre kruhový odpočet) */
  rem: number
  skipping: boolean
  onSkip: () => void
  nextBusy: boolean
  onNext: () => void
}

/** Otázka (stav 'question') a jej vyhodnotenie (stav 'reveal') – rovnaké rozloženie. */
export function QuestionScreen({ game, teamCount, answeredCount, answers, rem, skipping, onSkip, nextBusy, onNext }: Props) {
  const q = game.question
  const revealed = game.status === 'reveal'
  const remaining = useCountdown(revealed ? null : game.ends_at)
  const totalMs = (q?.time_limit ?? 0) * 1000
  const seconds = remaining === null ? null : Math.ceil(remaining / 1000)
  const timeUp = !revealed && remaining === 0
  const isLast = game.question_index >= game.question_count - 1
  const [imageFailed, setImageFailed] = useState(false)

  // tikanie posledných 5 s a zvuk konca času – len ak tu odpočet naozaj bežal
  const lastSecond = useRef<number | null>(null)
  useEffect(() => {
    if (revealed || seconds === null) return
    const prev = lastSecond.current
    lastSecond.current = seconds
    if (prev === null || seconds >= prev) return
    if (seconds === 0) playSound(sound.timeUp)
    else if (seconds <= 5) playSound(sound.tick)
  }, [seconds, revealed])

  useEffect(() => {
    if (!revealed) return
    const t = setTimeout(() => playSound(sound.correct), 150)
    return () => clearTimeout(t)
  }, [revealed])

  if (!q) return null

  const counts = q.counts ?? countAnswers(answers, q.answers.length)
  const answered = revealed ? (q.answered ?? answeredCount) : answeredCount
  const correctCount = q.correct !== undefined ? (counts[q.correct] ?? 0) : 0
  const showImage = Boolean(q.image_url) && !imageFailed
  const explanation = revealed ? (q.explanation ?? '').trim() : ''

  return (
    <div className="flex h-full flex-col gap-4 px-6 pb-6">
      <motion.div
        className="game-card flex min-h-[7rem] shrink-0 items-center justify-center px-10 py-4 text-center"
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        <h2 className={`font-extrabold break-words ${questionTextClass(q.text)}`}>{q.text}</h2>
      </motion.div>

      <div className="flex min-h-0 flex-1 items-center gap-6">
        {/* vľavo: odpočet / počet správnych */}
        <div className="flex w-[17rem] shrink-0 items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            {revealed ? (
              <motion.div key="correct" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
                <Stat
                  label="Správne"
                  value={correctCount}
                  total={teamCount}
                  icon={
                    <span className="mb-3 grid size-[4rem] place-items-center rounded-full bg-ans-green shadow-[0_0.25rem_0_rgb(0_0_0/0.25)]">
                      <Check className="size-[2.6rem]" strokeWidth={4} aria-hidden />
                    </span>
                  }
                />
              </motion.div>
            ) : (
              <motion.div key="timer" exit={{ scale: 0.6, opacity: 0 }}>
                <CountdownRing remainingMs={remaining ?? totalMs} totalMs={totalMs} size={Math.round(12 * rem)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* stred: obrázok / dekorácia / graf */}
        <div className="relative h-full min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            {revealed ? (
              <motion.div
                key="chart"
                className="absolute inset-0 py-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <AnswerChart counts={counts} correct={q.correct} />
              </motion.div>
            ) : showImage ? (
              <motion.img
                key="image"
                src={q.image_url ?? undefined}
                alt=""
                onError={() => setImageFailed(true)}
                className="absolute inset-0 size-full object-contain drop-shadow-[0_0.5rem_0.4rem_rgb(0_0_0/0.3)]"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              />
            ) : (
              <motion.div key="deco" className="absolute inset-0 grid place-items-center" exit={{ opacity: 0 }}>
                <Decoration count={q.answers.length} />
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {timeUp && (
              <motion.div
                className="pointer-events-none absolute inset-0 grid place-items-center"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              >
                <span className="rounded-2xl bg-ans-red px-10 py-4 text-[3.5rem] font-black text-shadow shadow-[0_0.5rem_0_rgb(0_0_0/0.25)]">
                  Čas vypršal!
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* vpravo: počet odpovedí + akcia */}
        <div className="flex w-[17rem] shrink-0 flex-col items-center justify-center gap-7">
          <Stat label="Odpovede" value={answered} total={teamCount} />
          {revealed ? (
            <Button
              variant="white"
              size="xl"
              loading={nextBusy}
              onClick={onNext}
              icon={isLast ? <Trophy className="size-7" aria-hidden /> : undefined}
              title={isLast ? 'Výsledky (medzerník)' : 'Ďalej (medzerník)'}
            >
              {isLast ? 'Výsledky' : 'Ďalej'}
              {!isLast && <ChevronRight className="size-7" aria-hidden />}
            </Button>
          ) : (
            <Button
              variant="white"
              size="md"
              loading={skipping}
              onClick={onSkip}
              icon={<SkipForward className="size-5" aria-hidden />}
              title="Ukončiť odpovedanie a ukázať správnu odpoveď"
            >
              Preskočiť
            </Button>
          )}
        </div>
      </div>

      {explanation && <Explanation text={explanation} />}

      <AnswerTiles answers={q.answers} correct={revealed ? q.correct : undefined} />
    </div>
  )
}

/** Vysvetlenie správnej odpovede – objaví sa chvíľu po odhalení. */
function Explanation({ text }: { text: string }) {
  const size = text.length <= 90 ? 'text-[2.1rem]' : text.length <= 180 ? 'text-[1.75rem]' : 'text-[1.5rem]'
  return (
    <motion.div
      className="game-card flex shrink-0 items-center gap-5 px-7 py-4"
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.7 }}
    >
      <span className="grid size-14 shrink-0 place-items-center rounded-full bg-ans-yellow text-white shadow-[0_0.25rem_0_rgb(0_0_0/0.2)]">
        <Lightbulb className="size-8" strokeWidth={2.5} aria-hidden />
      </span>
      <p className={`min-w-0 flex-1 leading-snug font-bold wrap-break-word whitespace-pre-line ${size}`}>{text}</p>
    </motion.div>
  )
}

function Stat({ label, value, total, icon }: { label: string; value: number; total: number; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center">
      {icon}
      <div className="leading-none font-black whitespace-nowrap tabular-nums text-shadow">
        <motion.span
          key={value}
          className="inline-block text-[5.5rem]"
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
        >
          {value}
        </motion.span>
        <span className="text-[2.5rem] opacity-75"> / {total}</span>
      </div>
      <div className="mt-2 text-[1.5rem] font-extrabold tracking-wide uppercase opacity-90">{label}</div>
    </div>
  )
}

/** Dekorácia namiesto obrázka – tvary odpovedí. */
function Decoration({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-5" aria-hidden>
      {ANSWER_STYLES.slice(0, count).map((s, i) => (
        <motion.div
          key={s.letter}
          className={`grid size-[8rem] place-items-center rounded-2xl shadow-[inset_0_-0.4rem_0_rgb(0_0_0/0.2)] ${s.bg}`}
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0, y: [0, -12, 0] }}
          transition={{
            scale: { type: 'spring', stiffness: 400, damping: 14, delay: 0.1 + i * 0.08 },
            rotate: { type: 'spring', stiffness: 400, damping: 14, delay: 0.1 + i * 0.08 },
            y: { duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.35 },
          }}
        >
          <AnswerShape shape={s.shape} className="size-[4.5rem]" />
        </motion.div>
      ))}
    </div>
  )
}

function countAnswers(rows: AnswerRow[], n: number): number[] {
  const counts = Array.from({ length: n }, () => 0)
  for (const r of rows) if (r.answer >= 0 && r.answer < n) counts[r.answer]++
  return counts
}
