import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronRight, Trophy } from 'lucide-react'
import { Button } from '../../../components/Button'
import { CategoryBadge } from '../../../components/CategoryBadge'
import { isLastItem } from '../../../lib/progress'
import { sound } from '../../../lib/sound'
import type { Game } from '../../../lib/types'
import { playSound } from '../utils'

interface Props {
  game: Game
  busy: boolean
  onNext: () => void
}

/** Snímka medzi otázkami: nadpis, text a obrázok. Bez časovača – učiteľ pokračuje ručne. */
export function SlideScreen({ game, busy, onNext }: Props) {
  const q = game.question
  const isLast = isLastItem(game)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => playSound(sound.whoosh), 0)
    return () => clearTimeout(t)
  }, [])

  if (!q) return null

  const body = (q.body ?? '').trim()
  const showImage = Boolean(q.image_url) && !imageFailed
  const category = q.category.trim()

  return (
    <div className="flex h-full flex-col items-center gap-6 px-12 pb-8">
      {category && (
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 14 }}
        >
          <CategoryBadge category={category} size="lg" className="gap-3! px-8! py-3! text-[2.25rem]! [&_svg]:size-8!" />
        </motion.div>
      )}

      <motion.h1
        className={`max-w-[110rem] shrink-0 text-center leading-tight font-black break-words text-shadow ${titleClass(q.text.length, showImage || Boolean(body))}`}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.05 }}
      >
        {q.text}
      </motion.h1>

      <div className="flex min-h-0 w-full max-w-[120rem] flex-1 items-stretch justify-center gap-8">
        {showImage && (
          <div className="relative min-w-0 flex-1">
            <motion.img
              src={q.image_url ?? undefined}
              alt=""
              onError={() => setImageFailed(true)}
              className="absolute inset-0 size-full object-contain drop-shadow-[0_0.5rem_0.4rem_rgb(0_0_0/0.3)]"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.15 }}
            />
          </div>
        )}
        {body && (
          <motion.div
            className={`game-card flex min-w-0 items-center overflow-hidden px-10 py-8 ${showImage ? 'flex-1' : 'max-w-[90rem] flex-1'}`}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.2 }}
          >
            <p className={`w-full leading-snug font-bold wrap-break-word whitespace-pre-line ${showImage ? '' : 'text-center'} ${bodyClass(body.length, !showImage)}`}>
              {body}
            </p>
          </motion.div>
        )}
      </div>

      <div className="flex w-full max-w-[120rem] shrink-0 justify-end">
        <Button
          variant="white"
          size="xl"
          loading={busy}
          onClick={onNext}
          icon={isLast ? <Trophy className="size-7" aria-hidden /> : undefined}
          title={isLast ? 'Výsledky (medzerník)' : 'Ďalej (medzerník)'}
        >
          {isLast ? 'Výsledky' : 'Ďalej'}
          {!isLast && <ChevronRight className="size-7" aria-hidden />}
        </Button>
      </div>
    </div>
  )
}

/** Nadpis (max. 400 znakov) – bez obrázka a textu môže byť veľký na celú obrazovku. */
function titleClass(n: number, crowded: boolean): string {
  if (!crowded) {
    if (n <= 40) return 'text-[7rem]'
    if (n <= 100) return 'text-[5rem]'
    return 'text-[3.6rem]'
  }
  if (n <= 40) return 'text-[4.5rem]'
  if (n <= 100) return 'text-[3.4rem]'
  return 'text-[2.6rem]'
}

/** Text snímky (max. 300 znakov). */
function bodyClass(n: number, wide: boolean): string {
  if (wide) {
    if (n <= 80) return 'text-[3.6rem]'
    if (n <= 160) return 'text-[3rem]'
    return 'text-[2.4rem]'
  }
  if (n <= 80) return 'text-[3rem]'
  if (n <= 160) return 'text-[2.4rem]'
  return 'text-[2rem]'
}
