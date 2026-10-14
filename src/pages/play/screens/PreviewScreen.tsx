import { motion } from 'motion/react'
import { CategoryBadge } from '../../../components/CategoryBadge'
import { PREVIEW_SECONDS } from '../../../lib/theme'
import type { PublicQuestion } from '../../../lib/types'
import { PointsBadge, ShapesLoader, ZoomableImage, questionTextClass } from '../ui'

/** Otázka je zobrazená, odpovedať sa ešte nedá. */
export function PreviewScreen({ question, index, count }: { question: PublicQuestion; index: number; count: number }) {
  return (
    <div className="my-auto flex flex-col items-center gap-4 py-4 text-center">
      <motion.p
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-lg font-extrabold tracking-wide text-white/90 uppercase"
      >
        Otázka {index + 1} z {count}
      </motion.p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <CategoryBadge category={question.category} />
        <PointsBadge points={question.points} />
      </div>

      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        className="game-card w-full max-w-2xl px-5 py-5"
      >
        <p className={`leading-snug font-extrabold wrap-break-word ${questionTextClass(question.text.length)}`}>{question.text}</p>
      </motion.div>

      {question.image_url && <ZoomableImage src={question.image_url} variant="inline" />}

      <div className="flex flex-col items-center gap-3 pt-2">
        <ShapesLoader />
        <p className="text-xl font-black text-shadow">Pripravte sa…</p>
      </div>

      <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-black/25" aria-hidden>
        <motion.div
          className="h-full origin-left rounded-full bg-white"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: PREVIEW_SECONDS, ease: 'linear' }}
        />
      </div>
    </div>
  )
}
