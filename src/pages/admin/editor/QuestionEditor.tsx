import { useEffect, useId, useRef } from 'react'
import { Lightbulb, Presentation, Tag } from 'lucide-react'
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

export function QuestionEditor(props: Props) {
  return props.question.kind === 'slide' ? <SlideEditor {...props} /> : <QuestionForm {...props} />
}

/** Kategória s návrhmi z kvízu – spoločná pre otázku aj snímku. */
function CategoryField({ value, categories, onChange }: { value: string; categories: string[]; onChange: (v: string) => void }) {
  const listId = useId()
  return (
    <label className="flex items-center gap-2">
      <span className="text-sm font-bold text-gray-600">Kategória</span>
      <span className="relative">
        <Tag
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          style={{ color: categoryColor(value) }}
          aria-hidden
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
  )
}

/** Snímka: nadpis, text a obrázok – na projektore aj mobiloch sa ukáže, kým učiteľ nepokračuje. */
function SlideEditor({ quizId, question: q, index, count, categories, issues, autoFocus, onChange }: Props) {
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const update = (fn: (q: DraftQuestion) => DraftQuestion) => onChange(q.id, fn)
  const titleError = issues?.text ?? null

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus()
  }, [autoFocus])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-extrabold tracking-wide text-brand-700 uppercase">
          <Presentation className="size-4" aria-hidden />
          Snímka · položka {index + 1} z {count}
        </p>
        <CategoryField value={q.category} categories={categories} onChange={(v) => update((x) => ({ ...x, category: v }))} />
      </div>

      <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-900">
        Snímka je informačná obrazovka bez odpovedí a bodov – napríklad úvod kategórie alebo pokyny. V hre sa ukáže na
        projektore aj na mobiloch, kým nestlačíš „Ďalej“. Do číslovania otázok sa neráta.
      </p>

      <div
        className={`relative flex min-h-40 flex-col justify-center rounded-2xl border-2 bg-white px-5 pt-5 pb-8 shadow-sm transition focus-within:border-brand-400 ${
          titleError ? 'border-red-300' : 'border-transparent'
        }`}
      >
        {q.category.trim() && (
          <div className="mb-3 flex justify-center">
            <CategoryBadge category={q.category} />
          </div>
        )}
        <AutoTextarea
          ref={titleRef}
          value={q.text}
          onChange={(e) => update((x) => ({ ...x, text: e.target.value.replace(/[\r\n]+/g, ' ') }))}
          maxLength={MAX_QUESTION}
          placeholder="Nadpis snímky, napr. Geografia"
          aria-label="Nadpis snímky"
          aria-invalid={!!titleError}
          className="block w-full bg-transparent text-center text-2xl leading-snug font-extrabold outline-none placeholder:text-gray-300 sm:text-3xl"
        />
        <span className="absolute right-4 bottom-2 text-xs font-bold text-gray-300 tabular-nums">
          {q.text.length} / {MAX_QUESTION}
        </span>
        {titleError && (
          <p className="absolute bottom-2 left-5 text-xs font-bold text-ans-red" role="alert">
            {titleError}
          </p>
        )}
      </div>

      <div className="rounded-2xl border-2 border-transparent bg-white px-5 pt-4 pb-4 shadow-sm transition focus-within:border-brand-400">
        <label className="block">
          <span className="mb-1.5 block text-sm font-extrabold text-gray-700">
            Text <span className="font-semibold text-gray-400">(nepovinný)</span>
          </span>
          <AutoTextarea
            value={q.explanation}
            onChange={(e) => update((x) => ({ ...x, explanation: e.target.value }))}
            maxLength={MAX_EXPLANATION}
            placeholder="Napr. „5 otázok o horách a riekach Slovenska“ alebo pokyny pre tímy."
            aria-label="Text snímky"
            className="block w-full resize-none bg-transparent leading-relaxed font-semibold outline-none placeholder:font-normal placeholder:text-gray-400"
          />
          <span className="mt-1 block text-right text-xs font-bold text-gray-300 tabular-nums">
            {q.explanation.length} / {MAX_EXPLANATION}
          </span>
        </label>
      </div>

      <ImagePicker quizId={quizId} value={q.image_url} onChange={(url) => update((x) => ({ ...x, image_url: url }))} />
    </div>
  )
}

function QuestionForm({ quizId, question: q, index, count, categories, issues, autoFocus, onChange }: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null)
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
        <CategoryField value={q.category} categories={categories} onChange={(v) => update((x) => ({ ...x, category: v }))} />
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

      <div className="rounded-2xl border-2 border-transparent bg-white px-5 pt-4 pb-4 shadow-sm transition focus-within:border-brand-400">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-2 text-sm font-extrabold text-gray-700">
            <Lightbulb className="size-4 text-ans-yellow" aria-hidden />
            Vysvetlenie
            <span className="font-semibold text-gray-400">(nepovinné)</span>
          </span>
          <AutoTextarea
            value={q.explanation}
            onChange={(e) => update((x) => ({ ...x, explanation: e.target.value }))}
            maxLength={MAX_EXPLANATION}
            placeholder="Prečo je to správne? Na projektore sa ukáže na samostatnej obrazovke po odhalení odpovede, tímom na mobiloch."
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
        <ImagePicker
          quizId={quizId}
          value={q.explanation_image_url}
          onChange={(url) => update((x) => ({ ...x, explanation_image_url: url }))}
          label="Pridať obrázok k vysvetleniu"
          alt="Obrázok k vysvetleniu"
        />
      </div>
    </div>
  )
}
