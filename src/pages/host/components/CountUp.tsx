import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { formatScore } from '../../../lib/theme'

/** Číslo, ktoré sa plynulo "napočíta" z `from` (alebo z predošlej hodnoty) na `value`. */
export function CountUp({
  value,
  from,
  duration = 1.4,
  className = '',
}: {
  value: number
  from?: number
  duration?: number
  className?: string
}) {
  const mv = useMotionValue(from ?? value)
  const text = useTransform(mv, (v) => formatScore(Math.round(v)))

  useEffect(() => {
    const controls = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [mv, value, duration])

  return <motion.span className={className}>{text}</motion.span>
}
