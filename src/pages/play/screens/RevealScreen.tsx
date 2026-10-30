import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { Check, Clock, Lightbulb, X } from 'lucide-react'
import { AnswerShape } from '../../../components/AnswerShape'
import { vibrate } from '../../../lib/sound'
import { ANSWER_STYLES, formatScore } from '../../../lib/theme'
import type { PublicQuestion, TeamState } from '../../../lib/types'
import { CountUp, ZoomableImage, pluralPoints } from '../ui'

export type RevealResult = 'correct' | 'wrong' | 'none'

export function revealResult(state: TeamState, questionIndex: number): RevealResult {
  const a = state.answer
  if (!a || a.question_idx !== questionIndex) return 'none'
  return a.correct ? 'correct' : 'wrong'
}

const pop = {
  initial: { scale: 0, rotate: -20 },
  animate: { scale: 1, rotate: 0 },
  transition: { type: 'spring', stiffness: 420, damping: 13 },
} as const

/** Vyhodnotenie otázky pre tím (údaje musia byť načítané až po odhalení). */
export function RevealScreen({
  question,
  state,
  questionIndex,
}: {
  question: PublicQuestion
  state: TeamState
  questionIndex: number
}) {
  const result = revealResult(state, questionIndex)
  const points = result === 'correct' ? (state.answer?.points ?? 0) : 0

  const vibrated = useRef(false)
  useEffect(() => {
    if (vibrated.current) return
    vibrated.current = true
    if (result === 'correct') vibrate([60, 40, 60])
    else if (result === 'wrong') vibrate(200)
  }, [result])

  return (
    <div className="my-auto flex flex-col items-center gap-4 py-6 text-center">
      {result === 'correct' && (
        <>
          <motion.div {...pop} className="flex size-28 items-center justify-center rounded-full bg-white text-[#26890c] shadow-[0_6px_0_rgb(0_0_0/0.2)]">
            <Check className="size-16" strokeWidth={4} aria-hidden />
          </motion.div>
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-5xl font-black text-shadow"
          >
            Správne!
          </motion.h1>
          {question.points === 0 ? (
            <p className="rounded-full bg-black/20 px-5 py-2 text-lg font-bold">Táto otázka bola bez bodov</p>
          ) : (
            <motion.p
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.3 }}
              className="rounded-full bg-black/20 px-6 py-2 text-3xl font-black tabular-nums"
            >
              +<CountUp value={points} delay={0.35} /> {pluralPoints(points)}
            </motion.p>
          )}
        </>
      )}

      {result === 'wrong' && (
        <>
          <motion.div {...pop} className="flex size-28 items-center justify-center rounded-full bg-white text-[#c4122f] shadow-[0_6px_0_rgb(0_0_0/0.2)]">
            <X className="size-16" strokeWidth={4} aria-hidden />
          </motion.div>
          <motion.h1
            initial={{ x: 0 }}
            animate={{ x: [0, -10, 10, -6, 6, 0] }}
            transition={{ delay: 0.25, duration: 0.45 }}
            className="text-5xl font-black text-shadow"
          >
            Nesprávne
          </motion.h1>
          <CorrectAnswer question={question} />
        </>
      )}

      {result === 'none' && (
        <>
          <motion.div {...pop} className="flex size-28 items-center justify-center rounded-full bg-white/15">
            <Clock className="size-14" aria-hidden />
          </motion.div>
          <h1 className="text-4xl font-black text-shadow">Bez odpovede</h1>
          <CorrectAnswer question={question} />
        </>
      )}

      <Explanation text={question.explanation ?? ''} image={question.explanation_image_url ?? null} />

      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-2 rounded-xl bg-black/20 px-6 py-3"
      >
        <p className="text-xl font-black">Ste na {state.rank}. mieste</p>
        <p className="text-sm font-bold text-white/80">
          Spolu {formatScore(state.score)} {pluralPoints(state.score)}
        </p>
      </motion.div>
    </div>
  )
}

/** Vysvetlenie správnej odpovede (ak ho učiteľ zadal) – text a/alebo obrázok. */
function Explanation({ text, image }: { text: string; image: string | null }) {
  const t = text.trim()
  if (!t && !image) return null
  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="game-card flex w-full max-w-sm flex-col items-center gap-3 px-4 py-3 text-left"
    >
      <div className="flex w-full items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ans-yellow text-white">
          <Lightbulb className="size-5" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 self-center leading-snug font-bold wrap-break-word whitespace-pre-line">
          {t || 'Vysvetlenie'}
        </p>
      </div>
      {image && <ZoomableImage src={image} variant="inline" />}
    </motion.div>
  )
}

function CorrectAnswer({ question }: { question: PublicQuestion }) {
  const c = question.correct
  if (c === undefined || c === null || !ANSWER_STYLES[c]) return null
  const style = ANSWER_STYLES[c]
  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.35 }}
      className="flex w-full max-w-sm flex-col items-center gap-2"
    >
      <p className="text-sm font-extrabold tracking-wide text-white/85 uppercase">Správna odpoveď:</p>
      <div
        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left shadow-[inset_0_-4px_0_rgb(0_0_0/0.25),0_4px_0_rgb(0_0_0/0.15)] ${style.bg}`}
      >
        <AnswerShape shape={style.shape} className="size-8" />
        <span className="min-w-0 text-lg leading-snug font-extrabold wrap-break-word text-shadow">{question.answers[c]}</span>
      </div>
    </motion.div>
  )
}
