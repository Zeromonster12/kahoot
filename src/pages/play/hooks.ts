import { useEffect, useState } from 'react'
import { getLeaderboard } from '../../lib/api'
import { serverNow } from '../../lib/clock'
import type { LeaderboardEntry } from '../../lib/types'

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
