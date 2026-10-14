import type { PointsMode, Question } from '../../lib/types'
import { uuid } from './utils'

export const MAX_TITLE = 120
export const MAX_DESCRIPTION = 500
export const MAX_CATEGORY = 60
export const MAX_QUESTION = 400
export const MAX_ANSWER = 120
export const MIN_ANSWERS = 2
export const MAX_ANSWERS = 4
export const DEFAULT_TIME = 20
export const DEFAULT_POINTS: PointsMode = 1000

/** Otázka v editore (bez quiz_id a position – tie sa doplnia pri ukladaní). */
export interface DraftQuestion {
  id: string
  category: string
  text: string
  image_url: string | null
  answers: string[]
  correct: number
  time_limit: number
  points: PointsMode
}

/** Otázka bez id – výsledok importu z Excelu. */
export type QuestionData = Omit<DraftQuestion, 'id'>

export function newQuestion(prev?: Pick<DraftQuestion, 'category' | 'time_limit'>): DraftQuestion {
  return {
    id: uuid(),
    category: prev?.category ?? '',
    text: '',
    image_url: null,
    answers: ['', '', '', ''],
    correct: 0,
    time_limit: prev?.time_limit ?? DEFAULT_TIME,
    points: DEFAULT_POINTS,
  }
}

export function fromQuestion(q: Question): DraftQuestion {
  return {
    id: q.id,
    category: q.category ?? '',
    text: q.text ?? '',
    image_url: q.image_url || null,
    answers: [...(q.answers ?? [])],
    correct: q.correct ?? 0,
    time_limit: q.time_limit ?? DEFAULT_TIME,
    points: q.points ?? DEFAULT_POINTS,
  }
}

/** Orezané hodnoty – to, čo sa reálne uloží. */
export function normalizeQuestion<T extends QuestionData>(q: T): T {
  return {
    ...q,
    category: q.category.trim().slice(0, MAX_CATEGORY),
    text: q.text.trim(),
    image_url: q.image_url?.trim() || null,
    answers: q.answers.map((a) => a.trim()),
  }
}

/** Riadok tabuľky questions pripravený na insert/upsert. */
export function toRow(q: QuestionData, quizId: string, position: number, id?: string) {
  const n = normalizeQuestion(q)
  return {
    ...(id ? { id } : {}),
    quiz_id: quizId,
    position,
    category: n.category,
    text: n.text,
    image_url: n.image_url,
    answers: n.answers,
    correct: n.correct,
    time_limit: n.time_limit,
    points: n.points,
  }
}

export interface QuestionIssues {
  text: string | null
  /** chyba pre každú odpoveď (index = odpoveď) */
  answers: (string | null)[]
  /** zhrnutie pre zoznam chýb */
  summary: string[]
}

export function validateQuestion(q: DraftQuestion): QuestionIssues | null {
  const text = q.text.trim()
  const textIssue = !text
    ? 'Napíš text otázky.'
    : text.length > MAX_QUESTION
      ? `Otázka môže mať najviac ${MAX_QUESTION} znakov.`
      : null
  const answerIssues = q.answers.map((a, i) => {
    const t = a.trim()
    if (!t) return i >= MIN_ANSWERS ? 'Vyplň odpoveď alebo ju odstráň.' : 'Vyplň odpoveď.'
    if (t.length > MAX_ANSWER) return `Najviac ${MAX_ANSWER} znakov.`
    return null
  })
  const summary: string[] = []
  if (textIssue) summary.push(text ? 'príliš dlhý text' : 'chýba text otázky')
  const emptyCount = answerIssues.filter(Boolean).length
  if (emptyCount) summary.push(emptyCount === 1 ? 'nevyplnená odpoveď' : 'nevyplnené odpovede')
  if (q.correct < 0 || q.correct >= q.answers.length) summary.push('nie je označená správna odpoveď')
  if (!summary.length) return null
  return { text: textIssue, answers: answerIssues, summary }
}

/** Odstráni odpoveď na indexe a posunie ostatné (bez medzier), upraví správnu odpoveď. */
export function removeAnswer(q: DraftQuestion, index: number): DraftQuestion {
  if (q.answers.length <= MIN_ANSWERS) return q
  const answers = q.answers.filter((_, i) => i !== index)
  const correct = q.correct === index ? 0 : q.correct > index ? q.correct - 1 : q.correct
  return { ...q, answers, correct }
}

export function addAnswer(q: DraftQuestion): DraftQuestion {
  if (q.answers.length >= MAX_ANSWERS) return q
  return { ...q, answers: [...q.answers, ''] }
}

export function isBlank(q: DraftQuestion): boolean {
  return !q.text.trim() && !q.image_url && q.answers.every((a) => !a.trim())
}

/** Stabilný reťazec stavu – na porovnanie, či sú neuložené zmeny. */
export function snapshot(title: string, description: string, questions: DraftQuestion[]): string {
  return JSON.stringify({
    t: title.trim(),
    d: description.trim(),
    q: questions.map((q) => normalizeQuestion(q)),
  })
}

/** Unikátne kategórie v poradí výskytu. */
export function uniqueCategories(list: { category: string }[]): string[] {
  const seen = new Map<string, string>()
  for (const q of list) {
    const c = q.category.trim()
    if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c)
  }
  return [...seen.values()]
}
