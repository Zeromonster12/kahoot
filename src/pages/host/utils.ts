import type { Game } from '../../lib/types'

/** Kľúč stavu hry – každý prechod sa žiada najviac raz pre daný kľúč. */
export function stateKey(g: Pick<Game, 'status' | 'question_index'>): string {
  return `${g.status}:${g.question_index}`
}

/** "123456" → "123 456" */
export function formatPin(pin: string): string {
  return pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * Prehrá zvuk len vtedy, keď už používateľ so stránkou interagoval. Inak by sa
 * zvuky nahromadili v uspanom AudioContexte a zazneli naraz po prvom kliknutí.
 */
export function playSound(fn: () => void) {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
  if (activation && !activation.hasBeenActive) return
  fn()
}

const TEAM_COLORS = [
  '#e21b3c',
  '#1368ce',
  '#c88a00',
  '#26890c',
  '#0a8f8f',
  '#d6457d',
  '#7a3fc9',
  '#d46a00',
  '#2b6fd6',
  '#b33a0b',
]

/** Stabilná farba čipu tímu podľa jeho id. */
export function teamColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return TEAM_COLORS[h % TEAM_COLORS.length]
}

/** Veľkosť písma otázky podľa dĺžky textu (otázka môže mať až 400 znakov). */
export function questionTextClass(text: string, large = false): string {
  const n = text.length
  if (large) {
    if (n <= 40) return 'text-[4.5rem] leading-[1.1]'
    if (n <= 90) return 'text-[3.75rem] leading-[1.12]'
    if (n <= 160) return 'text-[3rem] leading-tight'
    if (n <= 260) return 'text-[2.5rem] leading-snug'
    return 'text-[2.1rem] leading-snug'
  }
  if (n <= 50) return 'text-[3.1rem] leading-tight'
  if (n <= 100) return 'text-[2.6rem] leading-tight'
  if (n <= 180) return 'text-[2.15rem] leading-snug'
  if (n <= 280) return 'text-[1.8rem] leading-snug'
  return 'text-[1.55rem] leading-snug'
}

/** Veľkosť písma odpovede podľa dĺžky textu. */
export function answerTextClass(text: string): string {
  const n = text.length
  if (n <= 24) return 'text-[2.5rem]'
  if (n <= 48) return 'text-[2.1rem]'
  if (n <= 90) return 'text-[1.7rem]'
  return 'text-[1.4rem]'
}

/** "… a ďalší 1 tím", "… a ďalšie 3 tímy", "… a ďalších 7 tímov" */
export function moreTeams(n: number): string {
  if (n === 1) return '… a ďalší 1 tím'
  if (n >= 2 && n <= 4) return `… a ďalšie ${n} tímy`
  return `… a ďalších ${n} tímov`
}

/** Spoločné poradie pri zhode bodov (1, 2, 2, 4 …) ako rank() na serveri. */
export function withRanks<T>(sorted: T[], score: (item: T) => number): (T & { rank: number })[] {
  let rank = 0
  let last: number | null = null
  return sorted.map((item, i) => {
    const s = score(item)
    if (s !== last) {
      rank = i + 1
      last = s
    }
    return { ...item, rank }
  })
}
