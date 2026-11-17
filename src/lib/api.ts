import { supabase } from './supabase'
import type { AnswerRow, FoundGame, Game, JoinResult, LeaderboardEntry, Team, TeamState } from './types'

const MESSAGES: Record<string, string> = {
  not_authorized: 'Na túto akciu nemáš oprávnenie.',
  quiz_not_found: 'Kvíz neexistuje.',
  quiz_empty: 'Kvíz nemá žiadne otázky.',
  game_not_found: 'Hra s týmto PIN-om neexistuje alebo už skončila.',
  game_finished: 'Hra už skončila.',
  game_full: 'Hra je plná.',
  game_locked: 'Hra je zamknutá – nové tímy sa už nemôžu pripojiť. Požiadajte učiteľa, aby ju odomkol.',
  name_kicked: 'Tím s týmto názvom bol z hry vyhodený. Vyberte si iný názov.',
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
  // napr. "Could not find the 'explanation' column of 'questions' in the schema cache"
  const column = /Could not find the '(\w+)' column|column "?[\w.]*?(\w+)"? does not exist/i.exec(raw)
  if (column) {
    return new ApiError(
      'schema_outdated',
      `Databáza nie je aktuálna (chýba stĺpec „${column[1] ?? column[2]}“). V Supabase → SQL Editor spusti najnovší súbor zo supabase/migrations.`,
    )
  }
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

/** Nájde aktívnu (nie ukončenú) hru podľa PIN-u. PIN-y nie sú verejne čitateľné, len cez túto funkciu. */
export async function findGameByPin(pin: string): Promise<FoundGame | null> {
  return (await rpc<FoundGame | null>('find_game', { p_pin: pin.trim() })) ?? null
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

/**
 * Posunie hru, ak už uplynul čas (otvorenie odpovedí po úvode, vyhodnotenie po konci času).
 * Volajú ho mobily hráčov – hra tak nezamrzne, keď projektor (karta učiteľa) nebeží.
 */
export function advanceGame(gameId: string) {
  return rpc<void>('advance_game', { p_game_id: gameId })
}

/** Tím odíde z rozohranej hry (zmaže sa); s rovnakým názvom sa môže vrátiť. */
export function leaveGame(teamId: string, token: string) {
  return rpc<void>('leave_game', { p_team_id: teamId, p_token: token })
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

/** Vyhodí tím (kedykoľvek počas hry); s rovnakým názvom sa do hry už nepripojí. */
export function kickTeam(teamId: string) {
  return rpc<void>('host_kick_team', { p_team_id: teamId })
}

/** Zamkne / odomkne hru pre nové tímy. */
export function hostSetLocked(gameId: string, locked: boolean) {
  return rpc<void>('host_set_locked', { p_game_id: gameId, p_locked: locked })
}

/** PIN hry – len pre admina (tabuľka game_pins nie je verejná). */
export async function getGamePin(gameId: string): Promise<string | null> {
  const { data, error } = await supabase.from('game_pins').select('pin').eq('game_id', gameId).maybeSingle()
  if (error) throw toApiError(error)
  return (data as { pin: string } | null)?.pin ?? null
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
