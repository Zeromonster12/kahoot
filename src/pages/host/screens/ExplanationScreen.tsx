import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronRight, Lightbulb, Trophy } from 'lucide-react'
import { Button } from '../../../components/Button'
import { sound } from '../../../lib/sound'
import type { Game } from '../../../lib/types'
import { AnswerTiles } from '../components/AnswerTiles'
import { playSound, questionTextClass } from '../utils'

interface Props {
  game: Game
  busy: boolean
  onNext: () => void
}

/**
 * Vysvetlenie po odhalení – otázka, obrázok, vysvetlenie a správna odpoveď (len na projektore).
 * Obrázok je vlastný obrázok vysvetlenia, inak obrázok otázky.
 */
export function ExplanationScreen({ game, busy, onNext }: Props) {
  const q = game.question
  const isLast = game.question_index >= game.question_count - 1
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => playSound(sound.whoosh), 0)
    return () => clearTimeout(t)
  }, [])

  if (!q) return null

  const explanation = (q.explanation ?? '').trim()
  const imageUrl = q.explanation_image_url || q.image_url
  const showImage = Boolean(imageUrl) && !imageFailed

  return (
    <div className="flex h-full flex-col gap-4 px-6 pb-6">
      <div className="game-card flex min-h-[7rem] shrink-0 items-center justify-center px-10 py-4 text-center">
        <h2 className={`font-extrabold break-words ${questionTextClass(q.text)}`}>{q.text}</h2>
      </div>

      <div className="flex min-h-0 flex-1 items-stretch gap-6">
        {showImage && (
          <div className="relative min-w-0 flex-1">
            <motion.img
              src={imageUrl ?? undefined}
              alt=""
              onError={() => setImageFailed(true)}
              className="absolute inset-0 size-full object-contain drop-shadow-[0_0.5rem_0.4rem_rgb(0_0_0/0.3)]"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            />
          </div>
        )}

        {/* bez textu (len obrázok k vysvetleniu) ostane obrázok sám */}
        {(explanation || !showImage) && (
          <motion.div
            className="game-card flex min-w-0 flex-1 flex-col gap-4 overflow-hidden px-9 py-7"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.15 }}
          >
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-ans-yellow text-white shadow-[0_0.25rem_0_rgb(0_0_0/0.2)]">
                <Lightbulb className="size-8" strokeWidth={2.5} aria-hidden />
              </span>
              <span className="text-[1.6rem] font-black tracking-wide text-ink/70 uppercase">Vysvetlenie</span>
            </div>
            <div className="flex min-h-0 flex-1 items-center">
              <p className={`leading-snug font-bold wrap-break-word whitespace-pre-line ${explanationTextClass(explanation, !showImage)}`}>
                {explanation}
              </p>
            </div>
          </motion.div>
        )}

        <div className="flex w-[17rem] shrink-0 items-center justify-center">
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

      <AnswerTiles answers={q.answers} correct={q.correct} />
    </div>
  )
}

/** Veľkosť písma vysvetlenia (max. 300 znakov) – bez obrázka má karta dvojnásobnú šírku. */
function explanationTextClass(text: string, wide: boolean): string {
  const n = text.length
  if (wide) {
    if (n <= 80) return 'text-[3.6rem]'
    if (n <= 160) return 'text-[3rem]'
    if (n <= 240) return 'text-[2.6rem]'
    return 'text-[2.3rem]'
  }
  if (n <= 60) return 'text-[3rem]'
  if (n <= 120) return 'text-[2.5rem]'
  if (n <= 200) return 'text-[2.1rem]'
  return 'text-[1.85rem]'
}
