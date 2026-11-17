import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { getGame } from './api'
import type { Game } from './types'

const POLL_MS = 4000

/**
 * Živý stav hry: realtime odber zmien riadku games + záložné dopytovanie
 * (školská WiFi vie realtime spojenie potichu prerušiť).
 *
 * `game` je undefined počas prvého načítania, null ak hra neexistuje.
 */
export function useGame(gameId: string | null | undefined) {
  const [game, setGame] = useState<Game | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef<Game | null | undefined>(undefined)

  const apply = useCallback((g: Game | null) => {
    // Neprepisuj novší stav starším (poll môže doraziť po realtime udalosti)
    const cur = latest.current
    if (g && cur && g.id === cur.id && isOlder(g, cur)) return
    latest.current = g
    setGame(g)
  }, [])

  const reload = useCallback(async () => {
    if (!gameId) return
    try {
      apply(await getGame(gameId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [gameId, apply])

  useEffect(() => {
    if (!gameId) return
    latest.current = undefined
    setGame(undefined)
    reload()

    const channel = supabase
      .channel(`game:${gameId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => apply(payload.new as Game),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') reload()
      })

    const poll = setInterval(reload, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', reload)

    return () => {
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', reload)
      supabase.removeChannel(channel)
    }
  }, [gameId, reload, apply])

  return { game, error, reload }
}

// v rámci jednej položky; snímka má len stav 'slide'
const STATUS_ORDER = { lobby: 0, slide: 1, preview: 1, question: 2, reveal: 3, scoreboard: 4, finished: 5 } as const

function isOlder(a: Game, b: Game): boolean {
  if (b.status === 'finished') return a.status !== 'finished'
  if (a.status === 'finished') return false
  if (a.question_index !== b.question_index) return a.question_index < b.question_index
  return STATUS_ORDER[a.status] < STATUS_ORDER[b.status]
}
