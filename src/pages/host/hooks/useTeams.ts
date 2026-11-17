import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { kickTeam, listTeams } from '../../../lib/api'
import type { Team } from '../../../lib/types'

const POLL_MS = 5000

function toTeam(row: Team): Team {
  // realtime posiela celý riadok (aj token) – necháme si len verejné stĺpce
  return { id: row.id, game_id: row.game_id, name: row.name, score: row.score, created_at: row.created_at }
}

function byJoin(a: Team, b: Team): number {
  return Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id)
}

/**
 * Tímy hry: počiatočné načítanie + realtime INSERT/UPDATE + záložné dopytovanie
 * (len keď `poll`, napr. v lobby). DELETE sa v realtime nedá filtrovať, preto sa
 * po vyhodení tímu načítava znova.
 *
 * `teams` je null, kým sa prvýkrát nenačítajú.
 */
export function useTeams(gameId: string, poll: boolean) {
  const [teams, setTeams] = useState<Team[] | null>(null)
  // realtime udalosti s časom príchodu – aby ich staršia odpoveď z DB neprepísala
  const live = useRef(new Map<string, { team: Team; at: number }>())
  const kicked = useRef(new Set<string>())
  const seq = useRef(0)
  const applied = useRef(0)

  const refetch = useCallback(async () => {
    const id = ++seq.current
    const started = Date.now()
    try {
      const list = await listTeams(gameId)
      if (id < applied.current) return // medzitým sa už použila novšia odpoveď
      applied.current = id
      const map = new Map(list.map((t) => [t.id, t]))
      for (const { team, at } of live.current.values()) {
        if (at < started) continue
        const cur = map.get(team.id)
        // skóre počas hry len rastie, novší údaj = vyššie skóre
        if (!cur || team.score > cur.score) map.set(team.id, team)
      }
      for (const k of kicked.current) map.delete(k)
      setTeams([...map.values()].sort(byJoin))
    } catch {
      // ďalší pokus príde s ďalším pollom / zmenou stavu hry
    }
  }, [gameId])

  const upsert = useCallback((team: Team) => {
    if (kicked.current.has(team.id)) return
    live.current.set(team.id, { team, at: Date.now() })
    setTeams((prev) => {
      if (!prev) return prev
      const i = prev.findIndex((t) => t.id === team.id)
      if (i === -1) return [...prev, team].sort(byJoin)
      const cur = prev[i]
      if (cur.score >= team.score && cur.name === team.name) return prev
      const next = prev.slice()
      next[i] = { ...team, score: Math.max(cur.score, team.score) }
      return next
    })
  }, [])

  useEffect(() => {
    refetch()
    const filter = `game_id=eq.${gameId}`
    const channel = supabase
      .channel(`host-teams:${gameId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'teams', filter }, (payload) =>
        upsert(toTeam(payload.new as Team)),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams', filter }, (payload) =>
        upsert(toTeam(payload.new as Team)),
      )
      // DELETE sa nedá filtrovať podľa hry – pri akomkoľvek odchode/vyhodení tímu načítaj znova
      // (inak by počítadlo „odpovedali všetci“ čakalo na tím, ktorý už v hre nie je)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'teams' }, () => void refetch())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refetch()
      })
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', refetch)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', refetch)
      supabase.removeChannel(channel)
    }
  }, [gameId, refetch, upsert])

  useEffect(() => {
    if (!poll) return
    const id = setInterval(refetch, POLL_MS)
    return () => clearInterval(id)
  }, [poll, refetch])

  /** Vyhodí tím (pri chybe vyhodí výnimku). */
  const kick = useCallback(
    async (teamId: string) => {
      await kickTeam(teamId)
      kicked.current.add(teamId)
      live.current.delete(teamId)
      setTeams((prev) => prev?.filter((t) => t.id !== teamId) ?? prev)
      refetch()
    },
    [refetch],
  )

  return { teams, refetch, kick }
}
