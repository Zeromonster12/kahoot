import type { ReactNode } from 'react'

/**
 * Fialové pozadie hry s jemne sa pohybujúcimi tvarmi (štýl Kahoot).
 * `tone` mení farbu pozadia – napr. zelená/červená po vyhodnotení odpovede.
 */
export function GameBackground({
  children,
  className = '',
  tone = 'brand',
}: {
  children: ReactNode
  className?: string
  tone?: 'brand' | 'correct' | 'wrong' | 'neutral'
}) {
  const bg = {
    brand: 'bg-brand-700',
    correct: 'bg-[#26890c]',
    wrong: 'bg-[#c4122f]',
    neutral: 'bg-[#2d2d3a]',
  }[tone]
  return (
    <div className={`relative isolate min-h-dvh overflow-hidden text-white transition-colors duration-500 ${bg} ${className}`}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -top-[20vmin] -right-[15vmin] size-[60vmin] rotate-12 animate-float-slow rounded-[12%] bg-white/[0.06]" />
        <div
          className="absolute -bottom-[25vmin] -left-[20vmin] size-[70vmin] animate-float-slow rounded-full bg-black/[0.08]"
          style={{ animationDelay: '-9s' }}
        />
        <div className="absolute top-[35%] left-[8%] size-[10vmin] animate-spin-slow rounded-[18%] bg-white/[0.05]" />
      </div>
      {children}
    </div>
  )
}
