import type { ReactNode } from 'react'
import { GameBackground } from '../../../components/GameBackground'
import { Logo } from '../../../components/Logo'

/** Celoobrazovková správa (hra neexistuje, chyba načítania). */
export function StatusPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <GameBackground className="flex flex-col items-center justify-center gap-8 p-8">
      <Logo size="lg" />
      <div className="game-card w-full max-w-[44rem] p-10 text-center">
        <h1 className="text-[2.5rem] leading-tight font-black">{title}</h1>
        <div className="mt-4 space-y-6 text-[1.35rem] text-gray-600">{children}</div>
      </div>
    </GameBackground>
  )
}
