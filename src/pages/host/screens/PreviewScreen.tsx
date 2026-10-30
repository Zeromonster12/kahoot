import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { CategoryBadge } from '../../../components/CategoryBadge'
import { PREVIEW_SECONDS } from '../../../lib/theme'
import { sound } from '../../../lib/sound'
import type { Game } from '../../../lib/types'
import { PointsBadge } from '../components/PointsBadge'
import { playSound, questionTextClass } from '../utils'

/** Úvod otázky: číslo, kategória, text, obrázok – po PREVIEW_SECONDS sa otvorí odpovedanie. */
export function PreviewScreen({ game, endsAt }: { game: Game; endsAt: number }) {
  const q = game.question
  // zostávajúci čas sa určí raz pri zobrazení (aj po obnovení stránky)
  const [bar] = useState(() => {
    const total = PREVIEW_SECONDS * 1000
    const remaining = Math.max(0, Math.min(total, endsAt - Date.now()))
    return { from: remaining / total, seconds: remaining / 1000 }
  })
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => playSound(sound.whoosh), 0)
    return () => clearTimeout(t)
  }, [])

  if (!q) return null

  const showImage = Boolean(q.image_url) && !imageFailed

  return (
    <div className={`flex h-full flex-col items-center justify-center px-12 pb-12 ${showImage ? 'gap-6' : 'gap-8'}`}>
      <motion.p
        className="rounded-full bg-black/25 px-8 py-2 text-[2.5rem] font-black tabular-nums text-shadow"
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        Otázka {game.question_index + 1} / {game.question_count}
      </motion.p>

      {(q.category.trim() || q.points !== 1000) && (
        <div className="flex flex-wrap items-center justify-center gap-5">
          {q.category.trim() && (
            <motion.div
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 12, delay: 0.15 }}
            >
              <CategoryBadge category={q.category} size="lg" className="gap-3! px-8! py-3! text-[2.25rem]! [&_svg]:size-8!" />
            </motion.div>
          )}
          {q.points !== 1000 && (
            <motion.div
              initial={{ scale: 0, rotate: 12 }}
              animate={{ scale: [0, 1.15, 1], rotate: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
            >
              <PointsBadge points={q.points} large />
            </motion.div>
          )}
        </div>
      )}

      <motion.div
        className={`game-card flex w-full max-w-[104rem] shrink-0 items-center justify-center px-14 text-center ${showImage ? 'py-8' : 'py-12'}`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20, delay: 0.1 }}
      >
        <h2 className={`font-black break-words ${questionTextClass(q.text, true)}`}>{q.text}</h2>
      </motion.div>

      {showImage && (
        <div className="relative min-h-[12rem] w-full flex-1">
          <motion.img
            src={q.image_url ?? undefined}
            alt=""
            onError={() => setImageFailed(true)}
            className="absolute inset-0 size-full object-contain drop-shadow-[0_0.5rem_0.4rem_rgb(0_0_0/0.3)]"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.25 }}
          />
        </div>
      )}

      <div className="h-4 w-full max-w-[80rem] shrink-0 overflow-hidden rounded-full bg-black/25" aria-hidden>
        <motion.div
          className="h-full origin-left rounded-full bg-white"
          initial={{ scaleX: bar.from }}
          animate={{ scaleX: 0 }}
          transition={{ duration: bar.seconds, ease: 'linear' }}
        />
      </div>
    </div>
  )
}
