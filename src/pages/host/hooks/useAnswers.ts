import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { listAnswers } from '../../../lib/api'
import type { AnswerRow } from '../../../lib/types'

const POLL_MS = 3000
const EMPTY: AnswerRow[] = []

interface State {
  idx: number
  rows: AnswerRow[]
  /** odpovede pre idx sa aspoň raz úspešne načítali z DB */
  ready: boolean
}

/**
 * Odpovede na aktuálnu otázku: načítanie + realtime INSERT (filtrované podľa hry,
 * iné otázky sa ignorujú) + záložné dopytovanie, keď je `poll` (stav 'question').
 * Odpovede sa nemenia, preto stačí zjednotenie podľa id.
 */
export function useAnswers(gameId: string, idx: number, poll: boolean) {
  const [state, setState] = useState<State>({ idx: -1, rows: EMPTY, ready: false })
  const idxRef = useRef(idx)

  const merge = useCallback((target: number, incoming: AnswerRow[], complete: boolean) => {
    setState((prev) => {
      const same = prev.idx === target
      const rows = same ? prev.rows : EMPTY
      const known = new Set(rows.map((r) => r.id))
      const added = incoming.filter((r) => r.question_idx === target && !known.has(r.id))
      const ready = (same && prev.ready) || complete
      if (same && added.length === 0 && ready === prev.ready) return prev
      return { idx: target, rows: added.length ? [...rows, ...added] : rows, ready }
    })
  }, [])

  const fetchFor = useCallback(
    async (target: number) => {
      if (target < 0) return
      try {
        const rows = await listAnswers(gameId, target)
        if (idxRef.current === target) merge(target, rows, true)
      } catch {
        // skúsi sa znova pri ďalšom polli / zmene stavu
      }
    },
    [gameId, merge],
  )

  useEffect(() => {
    idxRef.current = idx
    fetchFor(idx)
  }, [idx, fetchFor])

  useEffect(() => {
    const channel = supabase
      .channel(`host-answers:${gameId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'answers', filter: `game_id=eq.${gameId}` },
        (payload) => {
          const row = payload.new as AnswerRow
          if (row.question_idx === idxRef.current) merge(row.question_idx, [row], false)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') fetchFor(idxRef.current)
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId, merge, fetchFor])

  useEffect(() => {
    if (!poll) return
    const id = setInterval(() => fetchFor(idxRef.current), POLL_MS)
    return () => clearInterval(id)
  }, [poll, fetchFor])

  const refetch = useCallback(() => fetchFor(idxRef.current), [fetchFor])
  const current = state.idx === idx
  return { rows: current ? state.rows : EMPTY, ready: current && state.ready, refetch }
}
