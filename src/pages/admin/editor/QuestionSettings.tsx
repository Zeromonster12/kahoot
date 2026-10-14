import { Copy, Info, Timer, Trash2, Trophy } from 'lucide-react'
import type { PointsMode } from '../../../lib/types'
import { POINTS_OPTIONS, TIME_LIMITS } from '../../../lib/theme'

const POINTS_HINT: Record<PointsMode, string> = {
  1000: 'až 1 000 bodov',
  2000: 'až 2 000 bodov',
  0: 'len na rozohriatie',
}

interface Props {
  timeLimit: number
  points: PointsMode
  onTimeLimit: (s: number) => void
  onPoints: (p: PointsMode) => void
  onDuplicate: () => void
  onDelete: () => void
}

/** Pravý panel: časový limit, body, akcie otázky. */
export function QuestionSettings({ timeLimit, points, onTimeLimit, onPoints, onDuplicate, onDelete }: Props) {
  const times = TIME_LIMITS.includes(timeLimit) ? TIME_LIMITS : [...TIME_LIMITS, timeLimit].sort((a, b) => a - b)
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 flex items-center gap-2 text-sm font-extrabold text-gray-700">
          <Timer className="size-4 text-brand-600" />
          Časový limit
        </legend>
        <div className="grid grid-cols-4 gap-1.5">
          {times.map((t) => {
            const active = t === timeLimit
            return (
              <button
                key={t}
                type="button"
                onClick={() => onTimeLimit(t)}
                aria-pressed={active}
                className={`h-9 rounded-lg text-sm font-bold whitespace-nowrap transition ${
                  active
                    ? 'bg-brand-700 text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)]'
                    : 'border border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50'
                }`}
              >
                {t} s
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 flex items-center gap-2 text-sm font-extrabold text-gray-700">
          <Trophy className="size-4 text-brand-600" />
          Body
        </legend>
        <div className="space-y-1.5">
          {POINTS_OPTIONS.map((o) => {
            const active = o.value === points
            return (
              <label
                key={o.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-2 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 ${
                  active ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="points"
                  checked={active}
                  onChange={() => onPoints(o.value)}
                  className="size-4 accent-brand-700"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{o.label}</span>
                  <span className="block text-xs text-gray-500">{POINTS_HINT[o.value]}</span>
                </span>
              </label>
            )
          })}
        </div>
        <p className="mt-3 flex gap-2 rounded-lg bg-gray-100 p-3 text-xs leading-relaxed text-gray-600">
          <Info className="mt-px size-4 shrink-0 text-gray-400" />
          <span>
            Za správnu odpoveď 500 – 1 000 bodov podľa rýchlosti (pri dvojnásobných 1 000 – 2 000). Za nesprávnu odpoveď 0
            bodov.
          </span>
        </p>
      </fieldset>

      <div className="space-y-1.5 border-t border-gray-200 pt-5">
        <button
          type="button"
          onClick={onDuplicate}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100"
        >
          <Copy className="size-4" />
          Duplikovať otázku
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-ans-red transition hover:bg-red-50"
        >
          <Trash2 className="size-4" />
          Zmazať otázku
        </button>
      </div>
    </div>
  )
}
