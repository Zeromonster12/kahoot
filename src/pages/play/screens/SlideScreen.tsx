import { motion } from 'motion/react'
import { Presentation } from 'lucide-react'
import { CategoryBadge } from '../../../components/CategoryBadge'
import type { PublicQuestion } from '../../../lib/types'
import { ZoomableImage, questionTextClass } from '../ui'

/** Snímka medzi otázkami – na mobile ten istý obsah ako na projektore, bez odpovedania. */
export function SlideScreen({ slide }: { slide: PublicQuestion }) {
  const body = (slide.body ?? '').trim()
  return (
    <div className="my-auto flex flex-col items-center gap-4 py-4 text-center">
      <CategoryBadge category={slide.category} />

      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        className="game-card w-full max-w-2xl space-y-3 px-5 py-5"
      >
        <h2 className={`leading-snug font-black wrap-break-word ${questionTextClass(slide.text.length)}`}>{slide.text}</h2>
        {body && <p className="leading-relaxed font-semibold wrap-break-word whitespace-pre-line text-gray-700">{body}</p>}
      </motion.div>

      {slide.image_url && <ZoomableImage src={slide.image_url} variant="inline" />}

      <p className="flex items-center gap-2 pt-2 text-base font-bold text-white/80">
        <Presentation className="size-5" aria-hidden />
        Učiteľ bude pokračovať o chvíľu
      </p>
    </div>
  )
}
