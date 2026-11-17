import { useEffect, useRef, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Plus, X } from 'lucide-react'
import { AnswerShape } from '../../../components/AnswerShape'
import { ANSWER_STYLES } from '../../../lib/theme'
import { MAX_ANSWER, MAX_ANSWERS, MIN_ANSWERS } from '../model'
import { AutoTextarea } from './AutoTextarea'

interface Props {
  answers: string[]
  correct: number
  /** chyby k jednotlivým odpovediam (zobrazujú sa až po pokuse o uloženie) */
  errors: (string | null)[] | null
  onChangeAnswer: (index: number, value: string) => void
  onSetCorrect: (index: number) => void
  onAdd: () => void
  onRemove: (index: number) => void
}

export function AnswerGrid({ answers, correct, errors, onChangeAnswer, onSetCorrect, onAdd, onRemove }: Props) {
  const inputs = useRef<(HTMLTextAreaElement | null)[]>([])
  const focusNext = useRef<number | null>(null)
  const canRemove = answers.length > MIN_ANSWERS

  // po pridaní odpovede presuň kurzor do nového poľa
  useEffect(() => {
    if (focusNext.current !== null) {
      inputs.current[focusNext.current]?.focus()
      focusNext.current = null
    }
  }, [answers.length])

  return (
    <div>
      <div className="grid gap-3 lg:grid-cols-2">
        <AnimatePresence initial={false}>
          {answers.map((value, i) => {
            const style = ANSWER_STYLES[i]
            const filled = value.trim().length > 0
            const isCorrect = i === correct
            const error = errors?.[i] ?? null
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
                transition={{ duration: 0.18 }}
                style={{ '--ans': style.color } as CSSProperties}
                className={`group relative flex min-h-24 items-center gap-3 rounded-xl p-3 pr-16 transition-colors ${
                  filled
                    ? `${style.bg} text-white shadow-[inset_0_-4px_0_rgb(0_0_0/0.18)]`
                    : `border-2 bg-white text-ink focus-within:border-[var(--ans)] ${error ? 'border-red-400' : 'border-gray-200'}`
                }`}
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${filled ? 'bg-black/10' : style.bg}`}
                >
                  <AnswerShape shape={style.shape} className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <AutoTextarea
                    ref={(el) => {
                      inputs.current[i] = el
                    }}
                    value={value}
                    maxLength={MAX_ANSWER}
                    onChange={(e) => onChangeAnswer(i, e.target.value.replace(/[\r\n]+/g, ' '))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        inputs.current[i + 1]?.focus()
                      }
                    }}
                    placeholder={i < MIN_ANSWERS ? `Odpoveď ${style.letter}` : `Odpoveď ${style.letter} (nepovinná)`}
                    aria-label={`Odpoveď ${style.letter}`}
                    aria-invalid={!!error}
                    className={`block w-full bg-transparent text-base leading-snug font-bold outline-none sm:text-lg ${
                      filled ? 'placeholder:text-white/70' : 'placeholder:font-semibold placeholder:text-gray-400'
                    }`}
                  />
                  {error && !filled && <p className="mt-0.5 text-xs font-bold text-ans-red">{error}</p>}
                </div>

                {value.length > MAX_ANSWER - 30 && (
                  <span className={`absolute right-16 bottom-1.5 text-xs font-bold ${filled ? 'text-white/80' : 'text-gray-400'}`}>
                    {value.length}/{MAX_ANSWER}
                  </span>
                )}

                <button
                  type="button"
                  aria-pressed={isCorrect}
                  aria-label={`Správna odpoveď ${style.letter}`}
                  title={isCorrect ? 'Správna odpoveď' : 'Označiť ako správnu odpoveď'}
                  onClick={() => onSetCorrect(i)}
                  className={`absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border-[3px] transition ${
                    isCorrect
                      ? 'border-white bg-ans-green text-white shadow-[0_0_0_3px_rgb(38_137_12/0.35)]'
                      : filled
                        ? 'border-white/90 text-transparent hover:bg-white/20 hover:text-white/70'
                        : 'border-gray-300 text-transparent hover:border-gray-400 hover:text-gray-300'
                  }`}
                >
                  <Check className="size-5" strokeWidth={4} />
                </button>

                {canRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    aria-label={`Odstrániť odpoveď ${style.letter}`}
                    title="Odstrániť odpoveď"
                    className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 opacity-0 shadow-sm transition group-focus-within:opacity-100 group-hover:opacity-100 hover:text-ans-red focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>

        {answers.length < MAX_ANSWERS && (
          <button
            type="button"
            onClick={() => {
              focusNext.current = answers.length
              onAdd()
            }}
            className="flex min-h-24 items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-white/60 p-3 font-bold text-gray-500 transition hover:border-gray-400 hover:bg-white hover:text-ink"
          >
            <span
              className={`flex size-9 items-center justify-center rounded-lg opacity-60 ${ANSWER_STYLES[answers.length].bg}`}
            >
              <Plus className="size-5 text-white" strokeWidth={3} />
            </span>
            Pridať odpoveď {ANSWER_STYLES[answers.length].letter}
          </button>
        )}
      </div>
      {errors && (correct < 0 || correct >= answers.length) ? (
        <p role="alert" className="mt-3 text-center text-sm font-bold text-ans-red">
          Označ správnu odpoveď – klikni na krúžok{' '}
          <span className="inline-flex size-4 translate-y-0.5 rounded-full border-2 border-ans-red" aria-hidden /> pri nej.
        </p>
      ) : (
        <p className="mt-3 text-center text-sm text-gray-500">
          Klikni na krúžok <span className="inline-flex size-4 translate-y-0.5 rounded-full border-2 border-gray-400" aria-hidden />{' '}
          pri správnej odpovedi. Odpovede C a D sú nepovinné.
        </p>
      )}
    </div>
  )
}
