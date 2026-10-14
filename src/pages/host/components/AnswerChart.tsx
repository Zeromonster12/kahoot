import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { AnswerShape } from '../../../components/AnswerShape'
import { ANSWER_STYLES } from '../../../lib/theme'

/**
 * Stĺpcový graf počtu tímov pri každej odpovedi. Farba aj tvar identifikujú
 * odpoveď (nie len farba); správna je označená fajkou, ostatné sú stlmené.
 */
export function AnswerChart({ counts, correct }: { counts: number[]; correct: number | undefined }) {
  const max = Math.max(1, ...counts)
  return (
    <div className="flex h-full items-stretch justify-center gap-[2.5rem]" role="img" aria-label={chartLabel(counts, correct)}>
      {counts.map((n, i) => {
        const style = ANSWER_STYLES[i]
        const ok = i === correct
        return (
          <motion.div
            key={i}
            className="flex w-[10.5rem] flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: correct === undefined || ok ? 1 : 0.55 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <div className="relative min-h-0 flex-1">
              {/* miesto pre číslo nad najvyšším stĺpcom */}
              <div className="absolute inset-x-0 top-[4.5rem] bottom-0">
                <motion.div
                  className="absolute inset-x-0 bottom-0 min-h-[0.6rem] rounded-t-lg"
                  style={{ backgroundColor: style.color }}
                  initial={{ height: '0%' }}
                  animate={{ height: `${(n / max) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 90, damping: 18, delay: 0.15 + i * 0.08 }}
                >
                  <span className="absolute inset-x-0 bottom-full mb-2 flex items-center justify-center gap-1.5 text-[3rem] leading-none font-black text-white tabular-nums text-shadow">
                    {ok && <Check className="size-[2.5rem]" strokeWidth={4} aria-hidden />}
                    {n}
                  </span>
                </motion.div>
              </div>
            </div>
            <div
              className="flex h-[3.75rem] shrink-0 items-center justify-center rounded-b-lg"
              style={{ backgroundColor: style.dark }}
            >
              <AnswerShape shape={style.shape} className="size-[2.25rem]" />
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function chartLabel(counts: number[], correct: number | undefined): string {
  return counts
    .map((n, i) => `${ANSWER_STYLES[i].letter}: ${n}${i === correct ? ' (správna)' : ''}`)
    .join(', ')
}
