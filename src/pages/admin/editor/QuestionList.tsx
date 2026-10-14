import { memo, useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { ChevronDown, ChevronUp, CircleAlert, Copy, FileDown, FileUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../../components/Button'
import { ANSWER_STYLES, categoryColor } from '../../../lib/theme'
import type { DraftQuestion } from '../model'

interface Props {
  questions: DraftQuestion[]
  selectedId: string | null
  invalidIds: Set<string>
  /** zvýrazniť neúplné otázky výraznejšie (po pokuse o uloženie) */
  showErrors: boolean
  importing: boolean
  onSelect: (id: string) => void
  onMove: (from: number, to: number) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
  onImport: () => void
  onExport: () => void
}

export function QuestionList({
  questions,
  selectedId,
  invalidIds,
  showErrors,
  importing,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onAdd,
  onImport,
  onExport,
}: Props) {
  const dragFrom = useRef<number | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const listRef = useRef<HTMLOListElement>(null)

  // vybranú otázku posuň do viditeľnej časti zoznamu
  useEffect(() => {
    if (!selectedId) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-qid="${selectedId}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId, questions.length])

  function onDragStart(e: DragEvent, index: number) {
    dragFrom.current = index
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  function onDragOver(e: DragEvent, index: number) {
    if (dragFrom.current === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const at = e.clientY < rect.top + rect.height / 2 ? index : index + 1
    if (at !== dropAt) setDropAt(at)
  }

  function onDrop(e: DragEvent) {
    if (dragFrom.current === null) return
    e.preventDefault()
    const from = dragFrom.current
    if (dropAt !== null) {
      const to = dropAt > from ? dropAt - 1 : dropAt
      if (to !== from) onMove(from, to)
    }
    dragFrom.current = null
    setDropAt(null)
  }

  function onDragEnd() {
    dragFrom.current = null
    setDropAt(null)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-sm font-extrabold tracking-wide text-gray-500 uppercase">
          Otázky <span className="text-gray-400">({questions.length})</span>
        </h2>
        {invalidIds.size > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-ans-red" title="Neúplné otázky">
            <CircleAlert className="size-3.5" />
            {invalidIds.size} {invalidIds.size === 1 ? 'neúplná' : invalidIds.size <= 4 ? 'neúplné' : 'neúplných'}
          </span>
        )}
      </div>

      <ol
        ref={listRef}
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3"
        onDrop={onDrop}
        onDragOver={(e) => dragFrom.current !== null && e.preventDefault()}
        aria-label="Zoznam otázok"
      >
        {questions.map((q, i) => (
          <li
            key={q.id}
            data-qid={q.id}
            draggable
            onDragStart={(e) => onDragStart(e, i)}
            onDragOver={(e) => onDragOver(e, i)}
            onDragEnd={onDragEnd}
            className="relative"
          >
            {dropAt === i && <DropLine className="-top-1" />}
            {dropAt === i + 1 && i === questions.length - 1 && <DropLine className="-bottom-1" />}
            <QuestionItem
              q={q}
              index={i}
              count={questions.length}
              selected={q.id === selectedId}
              invalid={invalidIds.has(q.id)}
              strong={showErrors}
              onSelect={onSelect}
              onMove={onMove}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2 border-t border-gray-200 bg-white p-3">
        <Button variant="brand" className="w-full" onClick={onAdd} icon={<Plus className="size-5" />}>
          Pridať otázku
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onImport}
          loading={importing}
          icon={<FileUp className="size-4" />}
          title="Pridať otázky z Excelu (.xlsx, .xls) alebo CSV"
        >
          Importovať otázky
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onExport}
          disabled={!questions.length}
          icon={<FileDown className="size-4" />}
        >
          Exportovať do Excelu
        </Button>
      </div>
    </div>
  )
}

function DropLine({ className }: { className: string }) {
  return <div className={`pointer-events-none absolute right-1 left-1 z-10 h-1 rounded-full bg-brand-500 ${className}`} />
}

interface ItemProps {
  q: DraftQuestion
  index: number
  count: number
  selected: boolean
  invalid: boolean
  strong: boolean
  onSelect: (id: string) => void
  onMove: (from: number, to: number) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

const QuestionItem = memo(function QuestionItem({
  q,
  index,
  count,
  selected,
  invalid,
  strong,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
}: ItemProps) {
  const color = categoryColor(q.category)
  const n = index + 1
  return (
    <motion.div layout="position" transition={{ duration: 0.2 }}>
      <div className="flex gap-1.5">
        <div className="flex w-6 shrink-0 flex-col items-center pt-2">
          <span className={`text-sm font-black ${selected ? 'text-brand-700' : 'text-gray-400'}`}>{n}</span>
          {invalid && (
            <CircleAlert className="mt-1 size-4 text-ans-red" aria-label="Neúplná otázka" />
          )}
        </div>
        {/* div namiesto <button> – Firefox nedovolí začať ťahanie z tlačidla */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect(q.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelect(q.id)
            }
          }}
          aria-current={selected ? 'true' : undefined}
          aria-label={`Otázka ${n}: ${q.text.trim() || 'bez textu'}${invalid ? ' (neúplná)' : ''}`}
          className={`relative min-w-0 flex-1 cursor-pointer overflow-hidden rounded-lg border-2 bg-white py-2 pr-2 pl-3.5 text-left transition outline-none select-none focus-visible:ring-2 focus-visible:ring-brand-300 active:cursor-grabbing ${
            selected
              ? 'border-brand-500 shadow-md shadow-brand-900/10'
              : invalid && strong
                ? 'border-red-300 hover:border-red-400'
                : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: color }} aria-hidden />
          <span className="flex gap-2">
            <span className="min-w-0 flex-1">
              <span className={`line-clamp-2 text-sm leading-snug font-bold ${q.text.trim() ? '' : 'text-gray-400 italic'}`}>
                {q.text.trim() || 'Otázka bez textu'}
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                <span className="truncate">{q.category.trim() || 'Bez kategórie'}</span>
                <span className="shrink-0">· {q.time_limit} s</span>
              </span>
            </span>
            {q.image_url ? (
              <img src={q.image_url} alt="" loading="lazy" className="size-11 shrink-0 rounded-md bg-gray-100 object-cover" />
            ) : null}
          </span>
          <span className="mt-1.5 flex gap-1" aria-hidden>
            {q.answers.map((a, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${a.trim() ? '' : 'opacity-25'} ${i === q.correct ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`}
                style={{ backgroundColor: ANSWER_STYLES[i].color }}
              />
            ))}
          </span>
        </div>
      </div>
      {selected && (
        <div className="mt-1 ml-7 flex items-center gap-0.5">
          <IconAction label="Posunúť vyššie" disabled={index === 0} onClick={() => onMove(index, index - 1)}>
            <ChevronUp />
          </IconAction>
          <IconAction label="Posunúť nižšie" disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
            <ChevronDown />
          </IconAction>
          <span className="mx-1 h-4 w-px bg-gray-200" aria-hidden />
          <IconAction label="Duplikovať otázku" onClick={() => onDuplicate(q.id)}>
            <Copy />
          </IconAction>
          <IconAction label="Zmazať otázku" danger onClick={() => onDelete(q.id)}>
            <Trash2 />
          </IconAction>
        </div>
      )}
    </motion.div>
  )
})

function IconAction({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex size-7 items-center justify-center rounded-md text-gray-500 transition disabled:opacity-30 [&_svg]:size-4 ${
        danger ? 'hover:bg-red-50 hover:text-ans-red' : 'hover:bg-gray-100 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
