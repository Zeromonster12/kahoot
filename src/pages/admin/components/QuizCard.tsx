import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Copy, FileDown, Pencil, Play, Trash2 } from 'lucide-react'
import { AnswerShape } from '../../../components/AnswerShape'
import { Button } from '../../../components/Button'
import { CategoryBadge } from '../../../components/CategoryBadge'
import { Spinner } from '../../../components/Spinner'
import { ANSWER_STYLES, pluralQuestions } from '../../../lib/theme'
import type { QuizSummary } from '../data'
import { formatDate } from '../utils'
import { Menu } from './Menu'
import { Skeleton } from './States'

const MAX_CHIPS = 4

interface Props {
  quiz: QuizSummary
  starting: boolean
  busy: boolean
  onStart: () => void
  onDuplicate: () => void
  onExport: () => void
  onDelete: () => void
}

export function QuizCard({ quiz, starting, busy, onStart, onDuplicate, onExport, onDelete }: Props) {
  const navigate = useNavigate()
  const editUrl = `/admin/quiz/${quiz.id}`
  const empty = quiz.questionCount === 0
  const extra = quiz.categories.length - MAX_CHIPS

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`group relative flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-lg hover:shadow-brand-900/5 ${
        busy ? 'pointer-events-none opacity-60' : ''
      }`}
    >
      <Link to={editUrl} className="relative block h-32 overflow-hidden rounded-t-2xl" tabIndex={-1} aria-hidden>
        <Cover src={quiz.cover} />
        <span className="absolute right-2.5 bottom-2.5 rounded-md bg-black/65 px-2 py-0.5 text-xs font-bold text-white">
          {pluralQuestions(quiz.questionCount)}
        </span>
      </Link>
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center text-brand-700">
          <Spinner className="size-8" />
        </span>
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-1">
          <h3 className="min-w-0 flex-1 text-lg leading-snug font-extrabold break-words">
            <Link to={editUrl} className="line-clamp-2 rounded hover:text-brand-700">
              {quiz.title}
            </Link>
          </h3>
          <Menu
            className="-mt-1 -mr-2"
            label={`Ďalšie možnosti – ${quiz.title}`}
            items={[
              { label: 'Duplikovať', icon: <Copy />, onSelect: onDuplicate },
              { label: 'Exportovať do Excelu', icon: <FileDown />, onSelect: onExport, disabled: empty },
              { label: 'Zmazať', icon: <Trash2 />, onSelect: onDelete, danger: true },
            ]}
          />
        </div>
        {quiz.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{quiz.description}</p>}

        {quiz.categories.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {quiz.categories.slice(0, MAX_CHIPS).map((c) => (
              <CategoryBadge key={c} category={c} size="sm" className="max-w-full overflow-hidden" />
            ))}
            {extra > 0 && <span className="text-xs font-bold text-gray-400">+{extra}</span>}
          </div>
        )}

        <p className="mt-auto pt-4 text-xs font-semibold text-gray-400">Upravené {formatDate(quiz.updated_at)}</p>

        <div className="mt-3 flex gap-2">
          <Button
            variant="success"
            size="sm"
            className="flex-1"
            icon={<Play className="size-4 fill-current" />}
            onClick={onStart}
            loading={starting}
            disabled={empty}
            title={empty ? 'Kvíz nemá žiadne otázky' : 'Spustiť hru na projektore'}
          >
            Spustiť hru
          </Button>
          <Button variant="outline" size="sm" icon={<Pencil className="size-4" />} onClick={() => navigate(editUrl)}>
            Upraviť
          </Button>
        </div>
        {empty && <p className="mt-2 text-xs font-semibold text-amber-700">Pridaj otázky, aby si mohol spustiť hru.</p>}
      </div>
    </motion.article>
  )
}

function Cover({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
      />
    )
  }
  return (
    <div className="flex size-full items-center justify-center bg-linear-to-br from-brand-500 to-brand-800">
      <div className="grid rotate-[-8deg] grid-cols-2 gap-1.5 transition duration-300 group-hover:rotate-0">
        {ANSWER_STYLES.map((s) => (
          <span key={s.letter} className={`flex size-9 items-center justify-center rounded-lg ${s.bg} shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)]`}>
            <AnswerShape shape={s.shape} className="size-4" />
          </span>
        ))}
      </div>
    </div>
  )
}

export function QuizCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <Skeleton className="h-32 rounded-t-2xl rounded-b-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex gap-2 pt-3">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </div>
  )
}
