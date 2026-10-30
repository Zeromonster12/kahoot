import { useEffect, useId, useRef } from 'react'
import { Lightbulb, Tag } from 'lucide-react'
import { CategoryBadge } from '../../../components/CategoryBadge'
import { categoryColor } from '../../../lib/theme'
import {
  MAX_CATEGORY,
  MAX_EXPLANATION,
  MAX_QUESTION,
  addAnswer,
  removeAnswer,
  type DraftQuestion,
  type QuestionIssues,
} from '../model'
import { AnswerGrid } from './AnswerGrid'
import { AutoTextarea } from './AutoTextarea'
import { ImagePicker } from './ImagePicker'

interface Props {
  quizId: string
  question: DraftQuestion
  index: number
  count: number
  /** kategórie použité v kvíze (návrhy) */
  categories: string[]
  /** chyby otázky – null, ak sa nemajú zobrazovať */
  issues: QuestionIssues | null
  autoFocus: boolean
  onChange: (id: string, update: (q: DraftQuestion) => DraftQuestion) => void
}

export function QuestionEditor({ quizId, question: q, index, count, categories, issues, autoFocus, onChange }: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  const listId = useId()
  const update = (fn: (q: DraftQuestion) => DraftQuestion) => onChange(q.id, fn)

  useEffect(() => {
    if (autoFocus) textRef.current?.focus()
  }, [autoFocus])

  const length = q.text.length
  const textError = issues?.text ?? null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-extrabold tracking-wide text-gray-400 uppercase">
          Otázka {index + 1} z {count}
        </p>
        <label className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-600">Kategória</span>
          <span className="relative">
            <Tag
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              style={{ color: categoryColor(q.category) }}
              aria-hidden
            />
            <input
              value={q.category}
              onChange={(e) => update((x) => ({ ...x, category: e.target.value }))}
              list={listId}
              maxLength={MAX_CATEGORY}
              placeholder="napr. Geografia"
              className="h-10 w-56 rounded-lg border-2 border-gray-200 bg-white pr-3 pl-8 text-sm font-semibold outline-none transition focus:border-brand-500"
            />
          </span>
          <datalist id={listId}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      </div>

      <div
        className={`relative flex min-h-40 flex-col justify-center rounded-2xl border-2 bg-white px-5 pt-5 pb-8 shadow-sm transition focus-within:border-brand-400 ${
          textError ? 'border-red-300' : 'border-transparent'
        }`}
      >
        {q.category.trim() && (
          <div className="mb-3 flex justify-center">
            <CategoryBadge category={q.category} />
          </div>
        )}
        <AutoTextarea
          ref={textRef}
          value={q.text}
          onChange={(e) => update((x) => ({ ...x, text: e.target.value.replace(/[\r\n]+/g, ' ') }))}
          onKeyDown={(e) => {
            // Enter neodriadkuje, ale presunie kurzor na prvú odpoveď
            if (e.key === 'Enter') {
              e.preventDefault()
              document.querySelector<HTMLTextAreaElement>('[aria-label="Odpoveď A"]')?.focus()
            }
          }}
          maxLength={MAX_QUESTION}
          placeholder="Začni písať otázku…"
          aria-label="Text otázky"
          aria-invalid={!!textError}
          className="block w-full bg-transparent text-center text-2xl leading-snug font-extrabold outline-none placeholder:text-gray-300 sm:text-3xl"
        />
        <span
          className={`absolute right-4 bottom-2 text-xs font-bold tabular-nums ${
            length > MAX_QUESTION - 40 ? 'text-amber-600' : 'text-gray-300'
          }`}
        >
          {length} / {MAX_QUESTION}
        </span>
        {textError && (
          <p className="absolute bottom-2 left-5 text-xs font-bold text-ans-red" role="alert">
            {textError}
          </p>
        )}
      </div>

      <ImagePicker quizId={quizId} value={q.image_url} onChange={(url) => update((x) => ({ ...x, image_url: url }))} />

      <AnswerGrid
        answers={q.answers}
        correct={q.correct}
        errors={issues?.answers ?? null}
        onChangeAnswer={(i, value) =>
          update((x) => ({ ...x, answers: x.answers.map((a, ai) => (ai === i ? value : a)) }))
        }
        onSetCorrect={(i) => update((x) => ({ ...x, correct: i }))}
        onAdd={() => update(addAnswer)}
        onRemove={(i) => update((x) => removeAnswer(x, i))}
      />

      <label className="block rounded-2xl border-2 border-transparent bg-white px-5 pt-4 pb-3 shadow-sm transition focus-within:border-brand-400">
        <span className="mb-1.5 flex items-center gap-2 text-sm font-extrabold text-gray-700">
          <Lightbulb className="size-4 text-ans-yellow" aria-hidden />
          Vysvetlenie
          <span className="font-semibold text-gray-400">(nepovinné)</span>
        </span>
        <AutoTextarea
          value={q.explanation}
          onChange={(e) => update((x) => ({ ...x, explanation: e.target.value }))}
          maxLength={MAX_EXPLANATION}
          placeholder="Prečo je to správne? Zobrazí sa po odhalení odpovede na projektore aj na mobiloch tímov."
          className="block w-full resize-none bg-transparent leading-relaxed font-semibold outline-none placeholder:font-normal placeholder:text-gray-400"
        />
        <span
          className={`mt-1 block text-right text-xs font-bold tabular-nums ${
            q.explanation.length > MAX_EXPLANATION - 30 ? 'text-amber-600' : 'text-gray-300'
          }`}
        >
          {q.explanation.length} / {MAX_EXPLANATION}
        </span>
      </label>
    </div>
  )
}
