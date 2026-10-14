import { motion } from 'motion/react'
import { RotateCcw, WifiOff } from 'lucide-react'
import { AnswerShape } from '../../../components/AnswerShape'
import { CountdownRing } from '../../../components/CountdownRing'
import { useCountdown } from '../../../lib/clock'
import { ANSWER_STYLES } from '../../../lib/theme'
import type { PublicQuestion } from '../../../lib/types'
import { FitText, ZoomableImage, questionTextClass } from '../ui'

/** Odpovedanie: otázka hore, farebné tlačidlá odpovedí cez zvyšok obrazovky. */
export function QuestionScreen({
  question,
  endsAt,
  onPick,
  error,
  lastPick,
}: {
  question: PublicQuestion
  endsAt: string | null
  onPick: (answer: number) => void
  /** chyba pri odoslaní (sieť) – tlačidlá sú znova aktívne */
  error: string | null
  /** odpoveď, ktorú sa nepodarilo odoslať */
  lastPick: number | null
}) {
  const n = question.answers.length
  const grid =
    n === 2 ? 'grid-cols-1 grid-rows-2 landscape:grid-cols-2 landscape:grid-rows-1' : 'grid-cols-2 grid-rows-2'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 pt-1">
      <div className="flex shrink-0 items-center gap-2.5">
        <QuestionTimer endsAt={endsAt} totalMs={question.time_limit * 1000} />
        <div className="game-card max-h-[22dvh] min-w-0 flex-1 overflow-y-auto px-3 py-2 landscape:max-h-[18dvh]">
          <p className={`leading-snug font-extrabold wrap-break-word ${questionTextClass(question.text.length, true)}`}>
            {question.text}
          </p>
        </div>
        {question.image_url && <ZoomableImage src={question.image_url} variant="thumb" />}
      </div>

      {error && (
        <div role="alert" className="flex shrink-0 items-center gap-2 rounded-lg bg-black/40 py-1.5 pr-1.5 pl-3 text-sm font-bold">
          <WifiOff className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 leading-tight">{error}</span>
          {lastPick !== null && (
            <button
              type="button"
              onClick={() => onPick(lastPick)}
              className="btn-3d flex shrink-0 touch-manipulation items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-ink"
            >
              <RotateCcw className="size-4" aria-hidden />
              Znova
            </button>
          )}
        </div>
      )}

      <div className={`grid min-h-0 flex-1 gap-2.5 ${grid}`}>
        {question.answers.map((text, i) => (
          <AnswerButton
            key={i}
            index={i}
            text={text}
            wide={n === 3 && i === 2}
            large={n === 2}
            highlighted={lastPick === i}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  )
}

/** Odpočet prekresľovaný 10× za sekundu – oddelene, aby sa neprekresľovali tlačidlá. */
function QuestionTimer({ endsAt, totalMs }: { endsAt: string | null; totalMs: number }) {
  const remaining = useCountdown(endsAt)
  if (remaining === null) return null
  return <CountdownRing remainingMs={remaining} totalMs={totalMs} size={52} />
}

function AnswerButton({
  index,
  text,
  wide,
  large,
  highlighted,
  onPick,
}: {
  index: number
  text: string
  wide: boolean
  large: boolean
  highlighted: boolean
  onPick: (answer: number) => void
}) {
  const style = ANSWER_STYLES[index]
  return (
    <motion.div
      className={`min-h-0 min-w-0 ${wide ? 'col-span-2' : ''}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 28, delay: index * 0.04 }}
    >
      <button
        type="button"
        onClick={() => onPick(index)}
        aria-label={`Odpoveď ${style.letter}: ${text}`}
        className={`btn-3d flex size-full touch-manipulation flex-col items-center justify-center gap-2 overflow-hidden rounded-xl p-3 text-white select-none [-webkit-touch-callout:none] landscape:flex-row landscape:gap-3 landscape:px-4 ${style.bg} ${
          highlighted ? 'ring-4 ring-white ring-offset-2 ring-offset-transparent' : ''
        }`}
      >
        <AnswerShape shape={style.shape} className={large ? 'size-10 sm:size-14' : 'size-9 sm:size-12'} />
        <FitText text={text} max={large ? 34 : 28} min={12} className="leading-tight font-extrabold text-shadow" />
      </button>
    </motion.div>
  )
}
