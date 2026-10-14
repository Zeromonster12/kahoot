import { motion } from 'motion/react'
import { Hourglass } from 'lucide-react'

/** Čas vypršal bez odpovede (alebo server odpoveď neprijal, lebo prišla neskoro). */
export function TimeUpScreen({ late }: { late: boolean }) {
  return (
    <div className="my-auto flex flex-col items-center gap-4 py-6 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 15 }}
        className="flex size-24 items-center justify-center rounded-full bg-white/15"
      >
        <motion.div
          animate={{ rotate: [0, 0, 180, 180] }}
          transition={{ duration: 2.4, times: [0, 0.4, 0.6, 1], repeat: Infinity, ease: 'easeInOut' }}
        >
          <Hourglass className="size-12" aria-hidden />
        </motion.div>
      </motion.div>
      <h1 className="text-3xl font-black text-shadow">{late ? 'Nestihli ste odpovedať' : 'Čas vypršal…'}</h1>
      <p className="text-lg font-bold text-white/85">Čakáme na vyhodnotenie…</p>
    </div>
  )
}
