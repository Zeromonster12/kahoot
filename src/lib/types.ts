export type GameStatus = 'lobby' | 'preview' | 'question' | 'reveal' | 'scoreboard' | 'finished'

export type PointsMode = 0 | 1000 | 2000

/** Otázka uložená v kvíze (tabuľka questions) – vidí len admin. */
export interface Question {
  id: string
  quiz_id: string
  position: number
  category: string
  text: string
  image_url: string | null
  answers: string[]
  /** index správnej odpovede v poli answers */
  correct: number
  /** sekundy, 5 – 240 */
  time_limit: number
  points: PointsMode
}

export interface Quiz {
  id: string
  title: string
  description: string
  created_at: string
  updated_at: string
}

/**
 * Verejné údaje aktuálnej otázky v games.question.
 * correct / counts / answered sú vyplnené až od stavu 'reveal'.
 */
export interface PublicQuestion {
  idx: number
  category: string
  text: string
  image_url: string | null
  answers: string[]
  time_limit: number
  points: PointsMode
  correct?: number
  /** počet tímov, ktoré zvolili danú odpoveď (index = odpoveď) */
  counts?: number[]
  /** koľko tímov odpovedalo */
  answered?: number
}

export interface Game {
  id: string
  quiz_id: string | null
  quiz_title: string
  pin: string
  status: GameStatus
  /** -1 v lobby */
  question_index: number
  question_count: number
  question: PublicQuestion | null
  /** ISO čas, kedy sa otvorilo odpovedanie (stav 'question') */
  started_at: string | null
  /** ISO čas, kedy odpovedanie končí */
  ends_at: string | null
  created_at: string
  finished_at: string | null
}

/** Riadok tabuľky teams – vidí len admin/host. */
export interface Team {
  id: string
  game_id: string
  name: string
  score: number
  created_at: string
}

/** Riadok tabuľky answers – vidí len admin/host. */
export interface AnswerRow {
  id: number
  game_id: string
  team_id: string
  question_idx: number
  answer: number
  correct: boolean
  points: number
  response_ms: number
  created_at: string
}

/** Výsledok RPC team_state – stav tímu z pohľadu hráča. */
export interface TeamState {
  /** fáza hry v čase dopytu – k nej patrí `answer` */
  status: GameStatus
  question_index: number
  team_id: string
  name: string
  score: number
  rank: number
  team_count: number
  /** odpoveď tímu na aktuálnu otázku; correct/points až po odhalení */
  answer: {
    question_idx: number
    answer: number
    correct?: boolean
    points?: number
  } | null
}

export interface LeaderboardEntry {
  team_id: string
  name: string
  score: number
  rank: number
}

export interface JoinResult {
  game_id: string
  team_id: string
  token: string
  name: string
}
