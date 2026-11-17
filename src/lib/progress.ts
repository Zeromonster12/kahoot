import type { Game } from './types'

// Hra sa skladá z položiek (otázky + snímky). Navigácia ide po položkách,
// číslovanie „Otázka 3 / 10“ ráta len otázky.

/** Počet položiek hry (otázky + snímky). Staršie hry nemajú item_count – vtedy sú to len otázky. */
export function itemCount(g: Pick<Game, 'item_count' | 'question_count'>): number {
  return g.item_count ?? g.question_count
}

/** Je aktuálna položka posledná v hre? */
export function isLastItem(g: Pick<Game, 'item_count' | 'question_count' | 'question_index'>): boolean {
  return g.question_index >= itemCount(g) - 1
}

/** Poradie aktuálnej otázky (1 = prvá) a počet otázok – bez snímok. */
export function questionProgress(g: Pick<Game, 'question' | 'question_index' | 'question_count'>): { number: number; total: number } {
  return {
    number: g.question?.number ?? g.question_index + 1,
    total: g.question?.total ?? g.question_count,
  }
}
