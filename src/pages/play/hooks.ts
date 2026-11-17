import { useEffect, useState } from 'react'
import { advanceGame, getLeaderboard } from '../../lib/api'
import { serverNow } from '../../lib/clock'
import type { Game, LeaderboardEntry } from '../../lib/types'

/** Rezervy po termíne – projektor hru normálne posunie skôr, mobily len keď nebeží. */
const ADVANCE_PREVIEW_GRACE_MS = 2000
const ADVANCE_REVEAL_GRACE_MS = 2500
/** rozptyl, aby 30 mobilov nevolalo server v tej istej milisekunde */
const ADVANCE_JITTER_MS = 1000
const ADVANCE_RETRY_MS = 4000

/**
 * Keď projektor (karta učiteľa) nebeží, mobil hráča po uplynutí času sám požiada
 * server o ďalšiu fázu: otvorenie odpovedí po úvode otázky a vyhodnotenie po konci
 * času. Server urobí len to, čo by aj tak spravil časovač – nič neurýchli.
 */
export function useAutoAdvance(game: Game | null | undefined, reload: () => Promise<void>) {
  const id = game?.id
  const status = game?.status
  const deadline = status === 'preview' ? game?.preview_ends_at : status === 'question' ? game?.ends_at : null
  const grace = status === 'preview' ? ADVANCE_PREVIEW_GRACE_MS : ADVANCE_REVEAL_GRACE_MS

  useEffect(() => {
    if (!id || !deadline) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const fire = async () => {
      try {
        await advanceGame(id)
        await reload()
      } catch {
        // výpadok siete – skúsi sa znova
      }
      // ak sa fáza zmenila, efekt sa zrušil; inak (napr. chyba) skús znova
      if (alive) timer = setTimeout(fire, ADVANCE_RETRY_MS)
    }
    const due = new Date(deadline).getTime() + grace + Math.random() * ADVANCE_JITTER_MS
    timer = setTimeout(fire, Math.max(0, due - serverNow()))
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [id, deadline, grace, reload])
}

/**
 * true, keď serverový čas prekročil `iso`. Na rozdiel od useCountdown
 * prekreslí komponent len pri zmene výsledku.
 */
export function useIsPast(iso: string | null | undefined): boolean {
  const end = iso ? new Date(iso).getTime() : null
  const [state, setState] = useState(() => ({ end, past: end !== null && serverNow() >= end }))

  useEffect(() => {
    const check = () => {
      const past = end !== null && serverNow() >= end
      setState((s) => (s.end === end && s.past === past ? s : { end, past }))
    }
    check()
    if (end === null) return
    const id = setInterval(check, 250)
    return () => clearInterval(id)
  }, [end])

  // kým efekt nedobehne pre nový čas, nepoužívaj výsledok pre starý
  if (state.end !== end) return end !== null && serverNow() >= end
  return state.past
}

/** Rebríček hry; načíta sa znova pri zmene `key` (pri chybe sa opakuje). */
export function useLeaderboard(gameId: string, key: string): LeaderboardEntry[] | null {
  const [data, setData] = useState<{ key: string; entries: LeaderboardEntry[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      try {
        const entries = await getLeaderboard(gameId)
        if (!cancelled) setData({ key, entries })
      } catch {
        if (!cancelled) timer = setTimeout(load, 4000)
      }
    }
    void load()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [gameId, key])

  return data && data.key === key ? data.entries : null
}
