import type { ItemKind, PointsMode, Question } from '../../lib/types'
import { pluralQuestions } from '../../lib/theme'
import { uuid } from './utils'

export const MAX_TITLE = 120
export const MAX_DESCRIPTION = 500
export const MAX_CATEGORY = 60
export const MAX_QUESTION = 400
export const MAX_ANSWER = 120
export const MAX_EXPLANATION = 300
export const MIN_ANSWERS = 2
export const MAX_ANSWERS = 4
export const DEFAULT_TIME = 20
export const DEFAULT_POINTS: PointsMode = 1000

/**
 * Položka v editore (bez quiz_id a position – tie sa doplnia pri ukladaní).
 * Otázka, alebo snímka: pri snímke je `text` nadpis, `explanation` text snímky,
 * `image_url` obrázok; odpovede, čas a body sa nepoužívajú.
 */
export interface DraftQuestion {
  id: string
  kind: ItemKind
  category: string
  text: string
  image_url: string | null
  answers: string[]
  correct: number
  time_limit: number
  points: PointsMode
  /** vysvetlenie po odhalení odpovede – nepovinné */
  explanation: string
  /** vlastný obrázok k vysvetleniu – nepovinný */
  explanation_image_url: string | null
}

/** Otázka bez id – výsledok importu z Excelu. */
export type QuestionData = Omit<DraftQuestion, 'id'>

export function newQuestion(prev?: Pick<DraftQuestion, 'category' | 'time_limit' | 'kind'>): DraftQuestion {
  return {
    id: uuid(),
    kind: 'question',
    category: prev?.category ?? '',
    text: '',
    image_url: null,
    answers: ['', '', '', ''],
    // žiadna predvolená správna odpoveď – učiteľ ju musí označiť (inak validácia nepustí uložiť)
    correct: -1,
    time_limit: prev?.kind === 'question' ? prev.time_limit : DEFAULT_TIME,
    points: DEFAULT_POINTS,
    explanation: '',
    explanation_image_url: null,
  }
}

/** Nová snímka – nadpis, text a obrázok; bez odpovedí a bodov. */
export function newSlide(fields: Partial<Pick<DraftQuestion, 'category' | 'text' | 'explanation'>> = {}): DraftQuestion {
  return {
    id: uuid(),
    kind: 'slide',
    category: fields.category ?? '',
    text: fields.text ?? '',
    image_url: null,
    answers: [],
    correct: 0,
    time_limit: DEFAULT_TIME,
    points: 0,
    explanation: fields.explanation ?? '',
    explanation_image_url: null,
  }
}

export const isSlide = (q: Pick<DraftQuestion, 'kind'>): boolean => q.kind === 'slide'

export function fromQuestion(q: Question): DraftQuestion {
  return {
    id: q.id,
    kind: q.kind === 'slide' ? 'slide' : 'question',
    category: q.category ?? '',
    text: q.text ?? '',
    image_url: q.image_url || null,
    answers: [...(q.answers ?? [])],
    correct: q.correct ?? 0,
    time_limit: q.time_limit ?? DEFAULT_TIME,
    points: q.points ?? DEFAULT_POINTS,
    explanation: q.explanation ?? '',
    explanation_image_url: q.explanation_image_url || null,
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
    explanation: q.explanation.trim().slice(0, MAX_EXPLANATION),
    explanation_image_url: q.explanation_image_url?.trim() || null,
  }
}

/** Riadok tabuľky questions pripravený na insert/upsert. */
export function toRow(q: QuestionData, quizId: string, position: number, id?: string) {
  const n = normalizeQuestion(q)
  if (n.kind === 'slide') {
    // snímka: bez odpovedí, času a bodov (databáza pri snímke odpovede nedovolí)
    return {
      ...(id ? { id } : {}),
      quiz_id: quizId,
      position,
      kind: 'slide' as const,
      category: n.category,
      text: n.text,
      image_url: n.image_url,
      answers: [],
      correct: 0,
      time_limit: DEFAULT_TIME,
      points: 0,
      explanation: n.explanation,
      explanation_image_url: null,
    }
  }
  return {
    ...(id ? { id } : {}),
    quiz_id: quizId,
    position,
    kind: 'question' as const,
    category: n.category,
    text: n.text,
    image_url: n.image_url,
    answers: n.answers,
    correct: n.correct,
    time_limit: n.time_limit,
    points: n.points,
    explanation: n.explanation,
    explanation_image_url: n.explanation_image_url,
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
  if (q.kind === 'slide') {
    const title = q.text.trim()
    if (title && title.length <= MAX_QUESTION) return null
    const issue = title ? `Nadpis môže mať najviac ${MAX_QUESTION} znakov.` : 'Napíš nadpis snímky.'
    return { text: issue, answers: [], summary: [title ? 'príliš dlhý nadpis' : 'chýba nadpis snímky'] }
  }
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

/**
 * Odstráni odpoveď na indexe a posunie ostatné (bez medzier), upraví správnu odpoveď.
 * Pri zmazaní správnej odpovede sa označenie zruší (-1) – nikdy sa potichu nepresunie na inú.
 */
export function removeAnswer(q: DraftQuestion, index: number): DraftQuestion {
  if (q.answers.length <= MIN_ANSWERS) return q
  const answers = q.answers.filter((_, i) => i !== index)
  const correct = q.correct === index ? -1 : q.correct > index ? q.correct - 1 : q.correct
  return { ...q, answers, correct }
}

export function addAnswer(q: DraftQuestion): DraftQuestion {
  if (q.answers.length >= MAX_ANSWERS) return q
  return { ...q, answers: [...q.answers, ''] }
}

export function isBlank(q: DraftQuestion): boolean {
  return (
    !q.text.trim() &&
    !q.image_url &&
    !q.explanation.trim() &&
    !q.explanation_image_url &&
    q.answers.every((a) => !a.trim())
  )
}

/** Stabilný reťazec stavu – na porovnanie, či sú neuložené zmeny. */
export function snapshot(title: string, description: string, questions: DraftQuestion[]): string {
  return JSON.stringify({
    t: title.trim(),
    d: description.trim(),
    q: questions.map((q) => normalizeQuestion(q)),
  })
}

// ---------------------------------------------------------------------------
// Zoradenie podľa kategórií

export interface GroupOptions {
  /** kategórie podľa abecedy (inak v poradí, v akom sa v kvíze prvýkrát objavia) */
  alphabetical?: boolean
  /** pred každú kategóriu pridať úvodnú snímku (ak ju ešte nemá) */
  introSlides?: boolean
}

/**
 * Zoskupí položky podľa kategórie. Poradie vnútri kategórie ostáva.
 * Snímka s kategóriou patrí do svojej kategórie a ide na jej začiatok (úvod kategórie);
 * snímka bez kategórie ostáva pred položkou, ktorá za ňou nasledovala.
 * Otázky bez kategórie idú na koniec.
 */
export function groupByCategory(items: DraftQuestion[], opts: GroupOptions = {}): DraftQuestion[] {
  const keyOf = (q: DraftQuestion) => q.category.trim().toLowerCase()
  type Unit = { key: string; intro: boolean; items: DraftQuestion[] }
  const units: Unit[] = []
  let pending: DraftQuestion[] = []
  for (const q of items) {
    if (q.kind === 'slide' && !keyOf(q)) {
      pending.push(q)
      continue
    }
    units.push({ key: keyOf(q), intro: q.kind === 'slide', items: [...pending, q] })
    pending = []
  }

  const groups = new Map<string, { name: string; intro: Unit[]; rest: Unit[] }>()
  for (const u of units) {
    let g = groups.get(u.key)
    if (!g) {
      const named = u.items.find((x) => keyOf(x) === u.key)
      g = { name: named?.category.trim() ?? '', intro: [], rest: [] }
      groups.set(u.key, g)
    }
    ;(u.intro ? g.intro : g.rest).push(u)
  }

  const keys = [...groups.keys()].filter((k) => k)
  if (opts.alphabetical) keys.sort((a, b) => groups.get(a)!.name.localeCompare(groups.get(b)!.name, 'sk'))
  if (groups.has('')) keys.push('')

  const out: DraftQuestion[] = []
  for (const k of keys) {
    const g = groups.get(k)!
    const questions = g.rest.flatMap((u) => u.items).filter((x) => x.kind === 'question').length
    if (opts.introSlides && k && g.intro.length === 0 && questions > 0) {
      out.push(newSlide({ category: g.name, text: g.name, explanation: pluralQuestions(questions) }))
    }
    for (const u of [...g.intro, ...g.rest]) out.push(...u.items)
  }
  out.push(...pending)
  return out
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
