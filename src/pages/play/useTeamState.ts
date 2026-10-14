import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ApiError, getGame, getTeamState } from '../../lib/api'
import type { TeamSession } from '../../lib/session'
import type { Game, TeamState } from '../../lib/types'

const REFRESH_MS = 5000
const RETRY_MS = 2000

/** Stav tímu označený fázou hry, v ktorej bol vyžiadaný. */
export interface TaggedTeamState {
  /** `${status}:${question_index}` hry na serveri v čase dopytu */
  key: string
  state: TeamState
}

/** 'team' = tím bol vyhodený, 'game' = hra bola zmazaná */
export type Gone = 'team' | 'game' | null

export function gameKey(game: Game): string {
  return `${game.status}:${game.question_index}`
}

/**
 * Skóre, poradie a odpoveď tímu (RPC team_state). Načíta sa pri každej zmene
 * fázy hry, po odoslaní odpovede a priebežne každých ~5 s. Odpoveď je označená
 * kľúčom fázy, aby sa pri novom odhalení nezobrazil výsledok predchádzajúcej otázky.
 */
export function useTeamState(session: TeamSession, game: Game | null | undefined) {
  const key = game ? gameKey(game) : null
  const finished = game?.status === 'finished'
  const [data, setData] = useState<TaggedTeamState | null>(null)
  /** prvý dopyt už skončil (úspechom aj chybou) */
  const [settled, setSettled] = useState(false)
  const [gone, setGone] = useState<Gone>(null)

  const keyRef = useRef(key)
  const seq = useRef(0)
  const applied = useRef(0)
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const alive = useRef(true)

  useLayoutEffect(() => {
    keyRef.current = key
  }, [key])

  const refresh = useCallback(async () => {
    if (!keyRef.current) return
    clearTimeout(retry.current)
    const id = ++seq.current
    try {
      const state = await getTeamState(session.teamId, session.token)
      // starší dopyt, ktorý dorazil po novšom, ignorujeme
      if (id < applied.current) return
      applied.current = id
      // fázu, ku ktorej údaje patria, hlási server
      setData({ key: `${state.status}:${state.question_index}`, state })
    } catch (e) {
      if (e instanceof ApiError && e.code === 'team_not_found') {
        // tím neexistuje – buď ho učiteľ vyhodil, alebo bola zmazaná celá hra
        const g = await getGame(session.gameId).catch(() => undefined)
        setGone(g === null ? 'game' : 'team')
        return
      }
      // výpadok siete – skúsime skôr ako pri bežnom obnovovaní
      if (alive.current && id === seq.current) retry.current = setTimeout(() => void refresh(), RETRY_MS)
    } finally {
      setSettled(true)
    }
  }, [session])

  useEffect(() => {
    if (key) void refresh()
  }, [key, refresh])

  useEffect(() => {
    if (!key || finished || gone) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [key, finished, gone, refresh])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      clearTimeout(retry.current)
    }
  }, [])

  return { data, settled, gone, refresh }
}
