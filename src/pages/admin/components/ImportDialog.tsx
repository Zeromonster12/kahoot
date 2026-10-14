import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, FileSpreadsheet, ListPlus, Replace } from 'lucide-react'
import { Button } from '../../../components/Button'
import { CategoryBadge } from '../../../components/CategoryBadge'
import { ANSWER_STYLES, pluralQuestions } from '../../../lib/theme'
import type { ParseResult } from '../excel'
import { MAX_TITLE } from '../model'
import { Modal } from './Modal'

const PREVIEW_COUNT = 10

export type ImportMode = 'append' | 'replace'

interface Props {
  open: boolean
  fileName: string
  result: ParseResult | null
  /** 'create' = vytvorí nový kvíz (zadáva sa názov), 'editor' = pridá do otvoreného kvízu */
  target: 'create' | 'editor'
  initialTitle?: string
  /** počet otázok v otvorenom kvíze (pre target = 'editor') */
  existingCount?: number
  busy?: boolean
  onConfirm: (opts: { title: string; mode: ImportMode }) => void
  onClose: () => void
}

function pluralRows(n: number) {
  if (n === 1) return '1 riadok'
  if (n >= 2 && n <= 4) return `${n} riadky`
  return `${n} riadkov`
}

export function ImportDialog({
  open,
  fileName,
  result,
  target,
  initialTitle = '',
  existingCount = 0,
  busy = false,
  onConfirm,
  onClose,
}: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [mode, setMode] = useState<ImportMode>('append')

  useEffect(() => {
    if (open) {
      setTitle(initialTitle)
      setMode('append')
    }
  }, [open, initialTitle])

  const questions = result?.questions ?? []
  const errors = result?.errors ?? []
  const categories = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    let none = 0
    for (const q of result?.questions ?? []) {
      const key = q.category.trim().toLowerCase()
      if (!key) {
        none++
        continue
      }
      const entry = map.get(key) ?? { name: q.category.trim(), count: 0 }
      entry.count++
      map.set(key, entry)
    }
    return { list: [...map.values()], none }
  }, [result])

  const titleMissing = target === 'create' && !title.trim()
  const canConfirm = questions.length > 0 && !titleMissing && !busy

  function submit() {
    if (canConfirm) onConfirm({ title: title.trim(), mode })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={busy}
      size="xl"
      title={target === 'create' ? 'Nový kvíz z Excelu' : 'Import otázok'}
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <FileSpreadsheet className="size-4 text-emerald-600" aria-hidden />
          {fileName}
        </span>
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Zrušiť
          </Button>
          <Button
            variant="brand"
            size="sm"
            onClick={submit}
            disabled={!canConfirm}
            loading={busy}
            data-autofocus={target === 'editor' ? true : undefined}
          >
            {target === 'create'
              ? `Vytvoriť kvíz (${pluralQuestions(questions.length)})`
              : mode === 'replace'
                ? `Nahradiť otázky (${questions.length})`
                : `Pridať ${questions.length === 1 ? '1 otázku' : pluralQuestions(questions.length)}`}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {/* Súhrn */}
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${
              questions.length ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-ans-red'
            }`}
          >
            {questions.length ? <CircleCheck className="size-4" /> : <CircleAlert className="size-4" />}
            {questions.length
              ? `${pluralQuestions(questions.length)} ${readyWord(questions.length)} na import`
              : 'Nenašla sa žiadna platná otázka'}
          </span>
          {errors.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700">
              <CircleAlert className="size-4" />
              {pluralRows(errors.length)} s chybou – {errors.length >= 2 && errors.length <= 4 ? 'preskočia sa' : 'preskočí sa'}
            </span>
          )}
        </div>

        {target === 'create' && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700">Názov kvízu</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-autofocus
              maxLength={MAX_TITLE}
              className={`h-11 w-full rounded-lg border-2 px-3 font-semibold outline-none transition focus:border-brand-500 ${
                titleMissing ? 'border-red-300' : 'border-gray-200'
              }`}
              placeholder="Napr. Vlastiveda – 4. ročník"
            />
            {titleMissing && <span className="mt-1 block text-sm font-semibold text-ans-red">Zadaj názov kvízu.</span>}
          </label>
        )}

        {target === 'editor' && questions.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-gray-700">Čo s otázkami?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <ModeOption
                checked={mode === 'append'}
                onChange={() => setMode('append')}
                icon={<ListPlus className="size-5" />}
                title="Pridať na koniec"
                text={existingCount ? `Za súčasné otázky (${existingCount}).` : 'Kvíz je zatiaľ prázdny.'}
              />
              <ModeOption
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
                icon={<Replace className="size-5" />}
                title="Nahradiť všetky otázky"
                text={
                  existingCount
                    ? `Súčasné otázky (${existingCount}) sa po uložení zmažú.`
                    : 'Kvíz je zatiaľ prázdny.'
                }
                danger={existingCount > 0}
              />
            </div>
          </fieldset>
        )}

        {categories.list.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-bold text-gray-700">Kategórie</h3>
            <div className="flex flex-wrap items-center gap-2">
              {categories.list.map((c) => (
                <span key={c.name} className="inline-flex items-center gap-1.5">
                  <CategoryBadge category={c.name} size="sm" />
                  <span className="text-sm font-bold text-gray-500">{c.count}×</span>
                </span>
              ))}
              {categories.none > 0 && (
                <span className="text-sm font-semibold text-gray-500">bez kategórie: {categories.none}×</span>
              )}
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60">
            <h3 className="border-b border-amber-200 px-4 py-2 text-sm font-bold text-amber-800">
              Preskočené riadky – oprav ich v súbore a naimportuj znova
            </h3>
            <ul className="max-h-40 divide-y divide-amber-100 overflow-y-auto text-sm">
              {errors.map((e) => (
                <li key={`${e.row}-${e.message}`} className="flex gap-3 px-4 py-1.5">
                  <span className="w-20 shrink-0 font-bold text-amber-800">Riadok {e.row}</span>
                  <span className="text-gray-700">{e.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {questions.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-bold text-gray-700">
              Náhľad {questions.length > PREVIEW_COUNT ? `(prvých ${PREVIEW_COUNT})` : ''}
            </h3>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-gray-50 text-xs font-bold tracking-wide text-gray-500 uppercase">
                  <tr>
                    <th className="w-10 px-3 py-2">#</th>
                    <th className="px-3 py-2">Otázka</th>
                    <th className="px-3 py-2">Odpovede</th>
                    <th className="w-16 px-3 py-2 text-right">Čas</th>
                    <th className="w-20 px-3 py-2 text-right">Body</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {questions.slice(0, PREVIEW_COUNT).map((q, i) => (
                    <tr key={i} className="align-top">
                      <td className="px-3 py-2.5 font-bold text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        {q.category && <CategoryBadge category={q.category} size="sm" className="mb-1" />}
                        <p className="line-clamp-3 font-semibold">{q.text}</p>
                        {q.image_url && <p className="mt-0.5 text-xs text-gray-400">+ obrázok</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        <ul className="space-y-1">
                          {q.answers.map((a, ai) => {
                            const ok = ai === q.correct
                            return (
                              <li
                                key={ai}
                                className={`flex items-start gap-1.5 rounded-md px-1.5 py-0.5 ${
                                  ok ? 'bg-emerald-50 font-bold text-emerald-800' : 'text-gray-600'
                                }`}
                              >
                                <span
                                  className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-black text-white"
                                  style={{ backgroundColor: ANSWER_STYLES[ai].color }}
                                >
                                  {ANSWER_STYLES[ai].letter}
                                </span>
                                <span className="min-w-0 break-words">{a}</span>
                                {ok && <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="správna" />}
                              </li>
                            )
                          })}
                        </ul>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap text-gray-600">{q.time_limit} s</td>
                      <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap text-gray-600">
                        {q.points === 2000 ? '2×' : q.points === 0 ? 'bez' : '1×'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {questions.length > PREVIEW_COUNT && (
              <p className="mt-2 text-center text-sm font-semibold text-gray-500">
                … a ešte {pluralQuestions(questions.length - PREVIEW_COUNT)}
              </p>
            )}
          </div>
        )}

        {questions.length === 0 && (
          <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
            Skontroluj, či súbor obsahuje stĺpce <b>Otázka</b>, <b>Odpoveď A</b>, <b>Odpoveď B</b> a <b>Správna</b> a
            aspoň jeden vyplnený riadok. Najľahšie je začať so šablónou (tlačidlo „Stiahnuť šablónu“).
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

function ModeOption({
  checked,
  onChange,
  icon,
  title,
  text,
  danger = false,
}: {
  checked: boolean
  onChange: () => void
  icon: ReactNode
  title: string
  text: string
  danger?: boolean
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 ${
        checked ? (danger ? 'border-ans-red bg-red-50/50' : 'border-brand-500 bg-brand-50') : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <input type="radio" name="import-mode" checked={checked} onChange={onChange} className="sr-only" />
      <span className={`mt-0.5 ${checked ? (danger ? 'text-ans-red' : 'text-brand-600') : 'text-gray-400'}`}>{icon}</span>
      <span>
        <span className="block font-bold">{title}</span>
        <span className="block text-sm text-gray-500">{text}</span>
      </span>
    </label>
  )
}

/** „1 otázka pripravená“, „3 otázky pripravené“, „5 otázok pripravených“ */
function readyWord(n: number) {
  if (n === 1) return 'pripravená'
  if (n >= 2 && n <= 4) return 'pripravené'
  return 'pripravených'
}
