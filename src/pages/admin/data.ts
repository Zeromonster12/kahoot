import { toApiError } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import type { Game, Question, Quiz } from '../../lib/types'
import { MAX_TITLE, toRow, type DraftQuestion, type QuestionData } from './model'
import { check, uuid } from './utils'

// Dotazy do databázy pre administráciu (RLS povoľuje adminovi priamy prístup k tabuľkám).

export interface QuizSummary extends Quiz {
  questionCount: number
  categories: string[]
  /** prvý obrázok v kvíze – použije sa ako obálka karty */
  cover: string | null
}

interface QuizListRow extends Quiz {
  questions: { category: string; image_url: string | null; position: number }[] | null
}

export async function listQuizzes(): Promise<QuizSummary[]> {
  const { data } = check(
    await supabase
      .from('quizzes')
      .select('id, title, description, created_at, updated_at, questions(category, image_url, position)')
      .order('updated_at', { ascending: false }),
  )
  return ((data ?? []) as QuizListRow[]).map(({ questions, ...quiz }) => {
    const qs = [...(questions ?? [])].sort((a, b) => a.position - b.position)
    const seen = new Map<string, string>()
    for (const q of qs) {
      const c = q.category?.trim()
      if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c)
    }
    return {
      ...quiz,
      questionCount: qs.length,
      categories: [...seen.values()],
      cover: qs.find((q) => q.image_url)?.image_url ?? null,
    }
  })
}

export async function getQuiz(quizId: string): Promise<Quiz | null> {
  const { data } = check(await supabase.from('quizzes').select('*').eq('id', quizId).maybeSingle())
  return (data as Quiz | null) ?? null
}

export async function getQuestions(quizId: string): Promise<Question[]> {
  const { data } = check(
    await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
  )
  return (data ?? []) as Question[]
}

/** Vytvorí kvíz (voliteľne aj s otázkami) a vráti jeho id. */
export async function createQuiz(title: string, description = '', questions: QuestionData[] = []): Promise<string> {
  // id generujeme na klientovi – netreba ho čítať späť z odpovede
  const quizId = uuid()
  check(
    await supabase
      .from('quizzes')
      .insert({ id: quizId, title: title.trim().slice(0, MAX_TITLE) || 'Nový kvíz', description: description.trim() }),
  )
  if (questions.length) {
    const { error } = await supabase.from('questions').insert(questions.map((q, i) => toRow(q, quizId, i)))
    if (error) {
      // otázky sa nepodarilo vložiť – nenecháme po sebe prázdny kvíz
      await supabase.from('quizzes').delete().eq('id', quizId)
      throw toApiError(error)
    }
  }
  return quizId
}

export async function duplicateQuiz(quizId: string): Promise<string> {
  const [quiz, questions] = await Promise.all([getQuiz(quizId), getQuestions(quizId)])
  if (!quiz) throw new Error('Kvíz sa nenašiel. Možno ho medzitým niekto zmazal.')
  const suffix = ' (kópia)'
  const title = quiz.title.slice(0, MAX_TITLE - suffix.length) + suffix
  return createQuiz(title, quiz.description, questions)
}

export async function deleteQuiz(quizId: string): Promise<void> {
  check(await supabase.from('quizzes').delete().eq('id', quizId))
}

/**
 * Uloží kvíz: názov + popis, všetky otázky (upsert, position = poradie)
 * a zmaže otázky, ktoré v editore už nie sú.
 */
export async function saveQuiz(
  quizId: string,
  title: string,
  description: string,
  questions: DraftQuestion[],
  removedIds: string[],
): Promise<void> {
  const { data } = check(
    await supabase
      .from('quizzes')
      .update({ title: title.trim(), description: description.trim() })
      .eq('id', quizId)
      .select('id'),
  )
  if (!data?.length) throw new Error('Kvíz sa nenašiel. Možno ho medzitým niekto zmazal.')
  if (questions.length) {
    check(await supabase.from('questions').upsert(questions.map((q, i) => toRow(q, quizId, i, q.id))))
  }
  if (removedIds.length) {
    check(await supabase.from('questions').delete().eq('quiz_id', quizId).in('id', removedIds))
  }
}

export interface GameSummary extends Pick<Game, 'id' | 'quiz_id' | 'quiz_title' | 'pin' | 'status' | 'created_at' | 'finished_at' | 'question_count' | 'question_index'> {
  teamCount: number
}

export async function listRecentGames(limit = 15): Promise<GameSummary[]> {
  const { data } = check(
    await supabase
      .from('games')
      .select('id, quiz_id, quiz_title, pin, status, created_at, finished_at, question_count, question_index, teams(count)')
      .order('created_at', { ascending: false })
      .limit(limit),
  )
  type Row = Omit<GameSummary, 'teamCount'> & { teams: { count: number }[] | null }
  return ((data ?? []) as Row[]).map(({ teams, ...g }) => ({ ...g, teamCount: teams?.[0]?.count ?? 0 }))
}

export async function deleteGame(gameId: string): Promise<void> {
  check(await supabase.from('games').delete().eq('id', gameId))
}
