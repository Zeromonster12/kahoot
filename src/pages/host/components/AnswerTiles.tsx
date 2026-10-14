import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { AnswerShape } from '../../../components/AnswerShape'
import { ANSWER_STYLES } from '../../../lib/theme'
import { answerTextClass } from '../utils'

/**
 * Farebné dlaždice odpovedí (2 × 2, pri dvoch odpovediach 1 × 2).
 * Po odhalení (`correct` zadané) sa nesprávne stlmia a správna sa zvýrazní.
 */
export function AnswerTiles({ answers, correct }: { answers: string[]; correct?: number }) {
  const revealed = correct !== undefined
  // rovnaká veľkosť písma na všetkých dlaždiciach podľa najdlhšej odpovede
  const textClass = answerTextClass(answers.reduce((a, b) => (b.length > a.length ? b : a), ''))
  return (
    <div className="grid shrink-0 grid-cols-2 gap-3">
      {answers.map((text, i) => {
        const style = ANSWER_STYLES[i]
        const isCorrect = revealed && correct === i
        const dimmed = revealed && !isCorrect
        return (
          <motion.div
            key={i}
            className={`relative flex min-h-[7.25rem] items-center gap-5 rounded-xl px-6 py-3 text-white shadow-[inset_0_-0.4rem_0_rgb(0_0_0/0.22)] ${style.bg} ${
              isCorrect ? 'z-10 ring-[0.35rem] ring-white' : ''
            }`}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: dimmed ? 0.35 : 1, y: 0, scale: isCorrect ? 1.025 : 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, delay: revealed ? 0 : 0.1 + i * 0.07 }}
          >
            <AnswerShape shape={style.shape} className="size-[3.25rem]" />
            <span className={`min-w-0 flex-1 leading-tight font-extrabold break-words text-shadow line-clamp-3 ${textClass}`}>
              {text}
            </span>
            {isCorrect && (
              <motion.span
                className="grid size-[4.75rem] shrink-0 place-items-center rounded-full bg-white text-ans-green shadow-[0_4px_0_rgb(0_0_0/0.2)]"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 15, delay: 0.25 }}
                aria-label="Správna odpoveď"
              >
                <Check className="size-[3.25rem]" strokeWidth={4} />
              </motion.span>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
