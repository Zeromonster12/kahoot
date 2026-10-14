import { Ban, Zap } from 'lucide-react'
import type { PointsMode } from '../../../lib/types'

/** Štítok špeciálneho bodovania: "2× body" alebo "Bez bodov" (štandard sa nezobrazí). */
export function PointsBadge({ points, large = false }: { points: PointsMode; large?: boolean }) {
  if (points === 1000) return null
  const size = large ? 'gap-3 px-7 py-3 text-[2rem] [&_svg]:size-8' : 'gap-2 px-5 py-2 text-xl [&_svg]:size-5'
  const tone = points === 2000 ? 'bg-amber-400 text-ink' : 'bg-gray-700 text-white'
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-black tracking-wide uppercase shadow-[0_3px_0_rgb(0_0_0/0.25)] ${size} ${tone}`}
    >
      {points === 2000 ? <Zap aria-hidden fill="currentColor" /> : <Ban aria-hidden />}
      {points === 2000 ? '2× body' : 'Bez bodov'}
    </span>
  )
}
