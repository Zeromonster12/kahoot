import type { AnswerRow, LeaderboardEntry } from '../../lib/types'

export interface ResultRow extends LeaderboardEntry {
  /** počet správnych odpovedí; null ak sa nepodarilo načítať */
  correct: number | null
}

export function correctCounts(answers: AnswerRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const a of answers) if (a.correct) map.set(a.team_id, (map.get(a.team_id) ?? 0) + 1)
  return map
}

export function buildResultRows(board: LeaderboardEntry[], correct: Map<string, number> | null): ResultRow[] {
  return board.map((e) => ({ ...e, correct: correct ? (correct.get(e.team_id) ?? 0) : null }))
}

function csvCell(value: string | number): string {
  let s = String(value)
  // ochrana pred vzorcami v Exceli (názov tímu "=…" by sa vykonal)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV pre slovenský Excel: UTF-8 s BOM, oddeľovač ";" */
export function resultsCsv(rows: ResultRow[]): string {
  const lines: (string | number)[][] = [
    ['Poradie', 'Tím', 'Body', 'Správne odpovede'],
    ...rows.map((r) => [r.rank, r.name, r.score, r.correct ?? '']),
  ]
  return '﻿' + lines.map((l) => l.map(csvCell).join(';')).join('\r\n') + '\r\n'
}

export function resultsFileName(title: string, date: Date): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `vysledky-${slug || 'kviz'}-${day}.csv`
}

export function downloadFile(fileName: string, content: string, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
