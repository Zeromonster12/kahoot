import { Maximize, Minimize, Power, Smartphone, Tag } from 'lucide-react'
import { Logo } from '../../../components/Logo'
import { MuteButton } from '../../../components/MuteButton'
import { categoryColor } from '../../../lib/theme'
import type { Game } from '../../../lib/types'
import { useFullscreen } from '../hooks/useFullscreen'
import { formatPin } from '../utils'
import { PointsBadge } from './PointsBadge'

const ROUND_BUTTON =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-black/20 text-white transition hover:bg-black/30'

/** Horná lišta: logo, číslo otázky, údaje na pripojenie a ovládanie (zvuk, celá obrazovka, ukončenie). */
export function HostHeader({ game, onEnd, ending }: { game: Game; onEnd: () => void; ending: boolean }) {
  const fs = useFullscreen()
  const { status, question: q } = game
  const inGame = status !== 'lobby' && status !== 'finished'
  const showProgress = status === 'question' || status === 'reveal' || status === 'scoreboard'
  const showQuestionInfo = q && (status === 'question' || status === 'reveal')
  const category = q?.category.trim() ?? ''

  return (
    <header className="relative z-20 flex h-[5rem] shrink-0 items-center gap-4 px-6">
      <Logo size="sm" className="shrink-0" />

      <div className="flex min-w-0 flex-1 items-center justify-center gap-3 overflow-hidden">
        {showProgress && (
          <span className="shrink-0 rounded-full bg-black/25 px-5 py-1.5 text-[1.5rem] font-extrabold tabular-nums">
            Otázka {game.question_index + 1} / {game.question_count}
          </span>
        )}
        {showQuestionInfo && category && (
          // vlastný štítok (ako CategoryBadge), ktorý sa pri dlhom názve skráti namiesto zalomenia
          <span
            className="inline-flex min-w-0 items-center gap-2 rounded-full px-5 py-2 text-xl font-extrabold tracking-wide text-white uppercase shadow-[0_3px_0_rgb(0_0_0/0.2)]"
            style={{ backgroundColor: categoryColor(category) }}
            title={category}
          >
            <Tag className="size-5 shrink-0" aria-hidden />
            <span className="truncate">{category}</span>
          </span>
        )}
        {showQuestionInfo && <PointsBadge points={q.points} />}
      </div>

      {inGame && (
        <div
          className="flex shrink-0 items-center gap-2 rounded-full bg-black/25 px-4 py-1.5 text-[1.3rem] font-bold"
          title="Neskoro prišlé tímy sa môžu pripojiť aj počas hry"
        >
          <Smartphone className="size-5" aria-hidden />
          <span>{window.location.host}</span>
          <span className="opacity-50">·</span>
          <span>
            PIN <span className="font-black tracking-wider tabular-nums">{formatPin(game.pin)}</span>
          </span>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2">
        <MuteButton />
        {fs.supported && (
          <button
            type="button"
            onClick={fs.toggle}
            className={ROUND_BUTTON}
            title={fs.active ? 'Zrušiť celú obrazovku (F)' : 'Celá obrazovka (F)'}
            aria-label={fs.active ? 'Zrušiť celú obrazovku' : 'Celá obrazovka'}
          >
            {fs.active ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
          </button>
        )}
        {status !== 'finished' && (
          <button
            type="button"
            onClick={onEnd}
            disabled={ending}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-black/20 px-4 font-bold text-white transition hover:bg-ans-red disabled:opacity-50"
          >
            <Power className="size-5" aria-hidden />
            Ukončiť hru
          </button>
        )}
      </div>
    </header>
  )
}
