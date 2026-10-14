import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../../../components/Button'
import { GameBackground } from '../../../components/GameBackground'

/** Samostatná obrazovka so správou (tím odstránený, hra zmazaná…). */
export function MessageScreen({
  icon,
  title,
  text,
  actionLabel = 'Späť',
  onAction,
}: {
  icon: ReactNode
  title: string
  text: string
  actionLabel?: string
  onAction: () => void
}) {
  return (
    <GameBackground className="flex flex-col items-center justify-center px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        className="game-card w-full max-w-sm space-y-4 p-6"
      >
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-700 [&_svg]:size-8">
          {icon}
        </div>
        <h1 className="text-2xl leading-tight font-black">{title}</h1>
        <p className="font-semibold text-gray-600">{text}</p>
        <Button variant="primary" size="lg" className="w-full touch-manipulation" icon={<ArrowLeft className="size-5" />} onClick={onAction}>
          {actionLabel}
        </Button>
      </motion.div>
    </GameBackground>
  )
}
