import type { MouseEvent, RefObject } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, CircleCheck, Play, Save, Settings2 } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Spinner } from '../../../components/Spinner'
import { MAX_TITLE } from '../model'

export type SaveState = 'saved' | 'dirty' | 'saving'

interface Props {
  titleRef: RefObject<HTMLInputElement | null>
  title: string
  titleError: boolean
  description: string
  saveState: SaveState
  starting: boolean
  canStart: boolean
  onTitle: (title: string) => void
  onBack: (e: MouseEvent) => void
  onSettings: () => void
  onSave: () => void
  onStart: () => void
}

export function EditorTopBar({
  titleRef,
  title,
  titleError,
  description,
  saveState,
  starting,
  canStart,
  onTitle,
  onBack,
  onSettings,
  onSave,
  onStart,
}: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <Link
          to="/admin"
          onClick={onBack}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-bold text-gray-600 transition hover:bg-gray-100 hover:text-ink"
          title="Späť na moje kvízy"
        >
          <ArrowLeft className="size-5" />
          <span className="hidden lg:inline">Moje kvízy</span>
        </Link>
        <span className="h-8 w-px shrink-0 bg-gray-200" aria-hidden />

        <div className="flex min-w-0 flex-1 items-center gap-1">
          <div className="min-w-0 shrink">
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => onTitle(e.target.value)}
              maxLength={MAX_TITLE}
              // šírka podľa textu (field-sizing v Chromiu, inak približne cez size)
              size={Math.max(12, title.length + 2)}
              placeholder="Názov kvízu"
              aria-label="Názov kvízu"
              aria-invalid={titleError}
              className={`h-10 max-w-full min-w-40 truncate rounded-lg border-2 px-2.5 text-lg font-extrabold outline-none transition field-sizing-content placeholder:text-gray-300 focus:border-brand-500 ${
                titleError ? 'border-red-400 bg-red-50/50' : 'border-transparent hover:border-gray-200'
              }`}
            />
          </div>
          <button
            type="button"
            onClick={onSettings}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-bold text-gray-600 transition hover:bg-gray-100 hover:text-ink"
            title={description ? `Popis: ${description}` : 'Názov a popis kvízu'}
          >
            <Settings2 className="size-5" />
            <span className="hidden xl:inline">Nastavenia kvízu</span>
          </button>
        </div>

        <div className="hidden shrink-0 items-center gap-1.5 text-sm font-bold md:flex" aria-live="polite">
          {saveState === 'saving' ? (
            <span className="inline-flex items-center gap-1.5 text-gray-500">
              <Spinner className="size-4" />
              Ukladá sa…
            </span>
          ) : saveState === 'dirty' ? (
            <span className="inline-flex items-center gap-1.5 text-amber-600">
              <span className="size-2 rounded-full bg-amber-500" />
              Neuložené zmeny
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-emerald-600">
              <CircleCheck className="size-4" />
              Uložené
            </span>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          loading={saveState === 'saving'}
          disabled={saveState === 'saved'}
          icon={<Save className="size-4" />}
          title="Uložiť (Ctrl+S)"
        >
          <span className="hidden sm:inline">Uložiť</span>
        </Button>
        <Button
          variant="success"
          size="sm"
          onClick={onStart}
          loading={starting}
          disabled={!canStart || saveState === 'saving'}
          icon={<Play className="size-4 fill-current" />}
          title={canStart ? 'Uložiť a spustiť hru na projektore' : 'Najprv pridaj aspoň jednu otázku'}
        >
          <span className="hidden sm:inline">Spustiť hru</span>
        </Button>
      </div>
    </header>
  )
}
