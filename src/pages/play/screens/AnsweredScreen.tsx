import { motion } from 'motion/react'
import { AnswerShape } from '../../../components/AnswerShape'
import { Spinner } from '../../../components/Spinner'
import { ANSWER_STYLES } from '../../../lib/theme'
import { pickStable } from '../ui'

const FUN_LINES = [
  'Držíme palce!',
  'Napätie by sa dalo krájať…',
  'Ostatné tímy ešte premýšľajú.',
  'Teraz už len dúfať.',
  'Odpoveď je zapečatená.',
  'Trafili ste? Uvidíme o chvíľu.',
  'Kto váha, ten nehrá. Vy ste nezaváhali.',
  'Pssst, nepozerajte do susedných mobilov!',
  'Vaša odpoveď letí rýchlosťou svetla.',
  'Čas na hlboký nádych.',
  'Mozgy ostatných sa ešte zahrievajú.',
]

/** Odpoveď zvolená – celá obrazovka vo farbe a tvare odpovede. */
export function AnsweredScreen({
  answerIndex,
  answerText,
  pending,
  seed,
}: {
  answerIndex: number
  answerText: string
  /** odpoveď sa ešte odosiela */
  pending: boolean
  seed: string
}) {
  const style = ANSWER_STYLES[answerIndex] ?? ANSWER_STYLES[0]
  return (
    <div className="my-auto flex flex-col items-center gap-4 py-6 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 14 }}
      >
        <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
          <AnswerShape shape={style.shape} className="size-28 sm:size-36" />
        </motion.div>
      </motion.div>

      <h1 className="text-3xl font-black text-shadow sm:text-4xl">Odpoveď odoslaná!</h1>

      {answerText && (
        <p className="max-w-sm rounded-xl bg-black/15 px-4 py-2 text-lg leading-snug font-bold wrap-break-word">{answerText}</p>
      )}

      <p className="text-lg font-bold text-white/90">Čakáme na ostatné tímy…</p>
      <p className="max-w-xs text-sm font-semibold text-white/75 italic">{pickStable(FUN_LINES, seed)}</p>

      <div className="flex h-6 items-center gap-2 text-sm font-bold text-white/80" aria-live="polite">
        {pending && (
          <>
            <Spinner className="size-4" />
            Odosielam…
          </>
        )}
      </div>
    </div>
  )
}
