/** 'slide' = informačná snímka medzi otázkami (bez odpovedí, učiteľ pokračuje ručne) */
export type GameStatus = 'lobby' | 'slide' | 'preview' | 'question' | 'reveal' | 'scoreboard' | 'finished'

/** Položka kvízu: otázka, alebo snímka (nadpis + text + obrázok, bez odpovedí a bodov). */
export type ItemKind = 'question' | 'slide'

export type PointsMode = 0 | 1000 | 2000

/** Otázka uložená v kvíze (tabuľka questions) – vidí len admin. */
export interface Question {
  id: string
  quiz_id: string
  position: number
  /** otázka alebo snímka; pri snímke je text = nadpis, explanation = text snímky */
  kind: ItemKind
  category: string
  text: string
  image_url: string | null
  answers: string[]
  /** index správnej odpovede v poli answers */
  correct: number
  /** sekundy, 5 – 240 */
  time_limit: number
  points: PointsMode
  /** vysvetlenie po odhalení odpovede ('' = žiadne) */
  explanation: string
  /** vlastný obrázok k vysvetleniu */
  explanation_image_url: string | null
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
  /** chýba v hrách spustených pred zavedením snímok = 'question' */
  kind?: ItemKind
  /** poradie otázky bez snímok (1 = prvá otázka); pri snímke chýba */
  number?: number
  /** počet otázok v hre (bez snímok) */
  total?: number
  /** text snímky */
  body?: string
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
  /** vysvetlenie správnej odpovede ('' = žiadne) */
  explanation?: string
  /** obrázok k vysvetleniu (až od stavu 'reveal') */
  explanation_image_url?: string | null
}

export interface Game {
  id: string
  quiz_id: string | null
  quiz_title: string
  status: GameStatus
  /** zamknutá hra neprijíma nové tímy (PIN je v neverejnej tabuľke game_pins) */
  locked: boolean
  /** index aktuálnej položky (otázky alebo snímky); -1 v lobby */
  question_index: number
  /** počet otázok (bez snímok) */
  question_count: number
  /** počet položiek vrátane snímok; null v hrách spustených pred zavedením snímok (= question_count) */
  item_count: number | null
  question: PublicQuestion | null
  /** ISO čas, kedy sa v stave 'preview' má otvoriť odpovedanie */
  preview_ends_at: string | null
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

/** Výsledok RPC find_game – bežiaca hra nájdená podľa PIN-u. */
export interface FoundGame {
  id: string
  status: GameStatus
  locked: boolean
  quiz_title: string
}

export interface JoinResult {
  game_id: string
  team_id: string
  token: string
  name: string
}
