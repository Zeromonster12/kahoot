import { useEffect, useState } from 'react'
import { getServerNow } from './api'

// Hodiny mobilov a notebookov sa môžu rozchádzať o sekundy, preto počítame
// odpočet podľa serverového času: serverNow() = Date.now() + offset.
let offset = 0
let syncing: Promise<void> | null = null

export function syncClock(): Promise<void> {
  if (!syncing) {
    syncing = (async () => {
      let best = { rtt: Infinity, offset: 0 }
      for (let i = 0; i < 3; i++) {
        try {
          const t0 = Date.now()
          const server = await getServerNow()
          const t1 = Date.now()
          const rtt = t1 - t0
          if (rtt < best.rtt) best = { rtt, offset: server - (t0 + t1) / 2 }
        } catch {
          // pri chybe ostane posledný známy offset
        }
      }
      if (best.rtt !== Infinity) offset = best.offset
    })().finally(() => {
      setTimeout(() => (syncing = null), 60_000)
    })
  }
  return syncing
}

export function serverNow(): number {
  return Date.now() + offset
}

/**
 * Zostávajúci čas v ms do `endsAt` (ISO) podľa serverového času.
 * Prekresľuje sa ~10× za sekundu; vráti null, ak endsAt nie je zadané.
 */
export function useCountdown(endsAt: string | null | undefined): number | null {
  const end = endsAt ? new Date(endsAt).getTime() : null
  const [remaining, setRemaining] = useState<number | null>(end === null ? null : Math.max(0, end - serverNow()))

  useEffect(() => {
    if (end === null) {
      setRemaining(null)
      return
    }
    const tick = () => setRemaining(Math.max(0, end - serverNow()))
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [end])

  return remaining
}
