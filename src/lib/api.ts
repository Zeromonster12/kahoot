import { supabase } from './supabase'
import type { AnswerRow, Game, JoinResult, LeaderboardEntry, Team, TeamState } from './types'

const MESSAGES: Record<string, string> = {
  not_authorized: 'Na túto akciu nemáš oprávnenie.',
  quiz_not_found: 'Kvíz neexistuje.',
  quiz_empty: 'Kvíz nemá žiadne otázky.',
  game_not_found: 'Hra s týmto PIN-om neexistuje alebo už skončila.',
  game_finished: 'Hra už skončila.',
  game_full: 'Hra je plná.',
  invalid_index: 'Otázka neexistuje.',
  invalid_name: 'Názov tímu musí mať 1 – 24 znakov.',
  name_taken: 'Tím s týmto názvom už v hre je. Vyberte si iný.',
  team_not_found: 'Tím už v hre nie je.',
  not_accepting: 'Na túto otázku sa už nedá odpovedať.',
  time_up: 'Čas vypršal.',
  invalid_answer: 'Neplatná odpoveď.',
  already_answered: 'Už ste odpovedali.',
}

/** Chyba z API so strojovým kódom (napr. 'name_taken') a slovenskou správou. */
export class ApiError extends Error {
  code: string
  constructor(code: string, message?: string) {
    super(message ?? MESSAGES[code] ?? code)
    this.code = code
  }
}

export function toApiError(error: { message?: string } | null | undefined): ApiError {
  const raw = error?.message ?? 'unknown'
  const code = Object.keys(MESSAGES).find((c) => raw === c || raw.includes(c))
  if (code) return new ApiError(code)
  if (/fetch|network|Failed to fetch|NetworkError/i.test(raw)) {
    return new ApiError('network', 'Nepodarilo sa spojiť so serverom. Skontroluj pripojenie.')
  }
  return new ApiError('unknown', raw)
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw toApiError(error)
  return data as T
}

// ---------------------------------------------------------------------------
// Verejné (hráči)
// ---------------------------------------------------------------------------

export async function getServerNow(): Promise<number> {
  return new Date(await rpc<string>('server_now')).getTime()
}

export async function getGame(gameId: string): Promise<Game | null> {
  const { data, error } = await supabase.from('games').select('*').eq('id', gameId).maybeSingle()
  if (error) throw toApiError(error)
  return data as Game | null
}

/** Nájde aktívnu (nie ukončenú) hru podľa PIN-u. */
export async function findGameByPin(pin: string): Promise<Game | null> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('pin', pin.trim())
    .neq('status', 'finished')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw toApiError(error)
  return data as Game | null
}

export function joinGame(pin: string, name: string) {
  return rpc<JoinResult>('join_game', { p_pin: pin, p_name: name })
}

export function submitAnswer(teamId: string, token: string, answer: number) {
  return rpc<{ ok: true }>('submit_answer', { p_team_id: teamId, p_token: token, p_answer: answer })
}

export function getTeamState(teamId: string, token: string) {
  return rpc<TeamState>('team_state', { p_team_id: teamId, p_token: token })
}

export function getLeaderboard(gameId: string) {
  return rpc<LeaderboardEntry[]>('get_leaderboard', { p_game_id: gameId })
}

// ---------------------------------------------------------------------------
// Host (prihlásený admin)
// ---------------------------------------------------------------------------

export function createGame(quizId: string) {
  return rpc<string>('create_game', { p_quiz_id: quizId })
}

/** Zobrazí otázku s indexom `index` (stav 'preview'). */
export function hostShowQuestion(gameId: string, index: number) {
  return rpc<void>('host_show_question', { p_game_id: gameId, p_index: index })
}

/** Otvorí odpovedanie a spustí časovač (stav 'question'). */
export function hostOpenAnswers(gameId: string) {
  return rpc<void>('host_open_answers', { p_game_id: gameId })
}

/** Ukončí odpovedanie, pripočíta body, odhalí správnu odpoveď (stav 'reveal'). Idempotentné. */
export function hostReveal(gameId: string) {
  return rpc<void>('host_reveal', { p_game_id: gameId })
}

/** Priebežné poradie (stav 'scoreboard'). */
export function hostScoreboard(gameId: string) {
  return rpc<void>('host_scoreboard', { p_game_id: gameId })
}

/** Ukončí hru – stupne víťazov (stav 'finished'). */
export function hostFinish(gameId: string) {
  return rpc<void>('host_finish', { p_game_id: gameId })
}

export async function listTeams(gameId: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, game_id, name, score, created_at')
    .eq('game_id', gameId)
    .order('created_at')
  if (error) throw toApiError(error)
  return data as Team[]
}

export async function kickTeam(teamId: string): Promise<void> {
  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  if (error) throw toApiError(error)
}

export async function listAnswers(gameId: string, questionIdx?: number): Promise<AnswerRow[]> {
  let q = supabase.from('answers').select('*').eq('game_id', gameId)
  if (questionIdx !== undefined) q = q.eq('question_idx', questionIdx)
  const { data, error } = await q.order('created_at')
  if (error) throw toApiError(error)
  return data as AnswerRow[]
}

export async function isAdmin(): Promise<boolean> {
  return rpc<boolean>('is_admin')
}
