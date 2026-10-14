export type ShapeKind = 'triangle' | 'diamond' | 'circle' | 'square'

export interface AnswerStyle {
  letter: string
  shape: ShapeKind
  /** farba pozadia tlačidla */
  color: string
  /** Tailwind trieda pozadia */
  bg: string
  /** tmavší odtieň (napr. tieň stĺpca v grafe) */
  dark: string
}

/** Štýly odpovedí v poradí A, B, C, D. */
export const ANSWER_STYLES: AnswerStyle[] = [
  { letter: 'A', shape: 'triangle', color: '#e21b3c', bg: 'bg-ans-red', dark: '#a8122b' },
  { letter: 'B', shape: 'diamond', color: '#1368ce', bg: 'bg-ans-blue', dark: '#0d4d99' },
  { letter: 'C', shape: 'circle', color: '#d89e00', bg: 'bg-ans-yellow', dark: '#a37700' },
  { letter: 'D', shape: 'square', color: '#26890c', bg: 'bg-ans-green', dark: '#1a6008' },
]

const CATEGORY_COLORS = [
  '#0aa3a3', // tyrkys
  '#e5568c', // ružová
  '#2b7bd6', // modrá
  '#e07b00', // oranžová
  '#7a3fc9', // fialová
  '#2f9e44', // zelená
  '#c2410c', // tehlová
  '#0e7490', // petrolejová
]

/** Stabilná farba pre kategóriu podľa jej názvu. */
export function categoryColor(category: string): string {
  const s = category.trim().toLowerCase()
  if (!s) return '#6b7280'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return CATEGORY_COLORS[h % CATEGORY_COLORS.length]
}

export const TIME_LIMITS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240]

export const POINTS_OPTIONS: { value: 0 | 1000 | 2000; label: string }[] = [
  { value: 1000, label: 'Štandardné' },
  { value: 2000, label: 'Dvojnásobné' },
  { value: 0, label: 'Bez bodov' },
]

/** Ako dlho (s) sa zobrazuje otázka pred otvorením odpovedí. */
export const PREVIEW_SECONDS = 5

export function formatScore(n: number): string {
  return n.toLocaleString('sk-SK')
}

/** "1 tím", "2 tímy", "5 tímov" */
export function pluralTeams(n: number): string {
  if (n === 1) return '1 tím'
  if (n >= 2 && n <= 4) return `${n} tímy`
  return `${n} tímov`
}

/** "1 otázka", "2 otázky", "5 otázok" */
export function pluralQuestions(n: number): string {
  if (n === 1) return '1 otázka'
  if (n >= 2 && n <= 4) return `${n} otázky`
  return `${n} otázok`
}
