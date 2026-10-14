import { motion } from 'motion/react'
import { ShapesLoader } from '../ui'

export function LobbyScreen({ teamName, quizTitle }: { teamName: string; quizTitle: string }) {
  return (
    <div className="my-auto flex flex-col items-center gap-5 py-6 text-center">
      <motion.h1
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 16 }}
        className="text-4xl font-black text-shadow sm:text-5xl"
      >
        Ste v hre!
      </motion.h1>

      <motion.div
        initial={{ scale: 0.7, opacity: 0, rotate: -4 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.15 }}
        className="game-card max-w-full px-6 py-4"
      >
        <p className="text-xs font-extrabold tracking-widest text-gray-500 uppercase">Váš tím</p>
        <p className="text-3xl font-black wrap-break-word text-brand-700 sm:text-4xl">{teamName}</p>
      </motion.div>

      <p className="max-w-xs text-lg leading-snug font-bold text-white/90 sm:max-w-md">
        Pozrite sa na projektor – váš tím by mal byť na obrazovke.
      </p>

      <div className="mt-3 flex flex-col items-center gap-4">
        <ShapesLoader />
        <p className="font-bold text-white/80">Čakáme, kým učiteľ spustí kvíz…</p>
      </div>

      {quizTitle && (
        <p className="max-w-full text-sm wrap-break-word text-white/60">
          Kvíz: <span className="font-bold text-white/80">{quizTitle}</span>
        </p>
      )}
    </div>
  )
}
