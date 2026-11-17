import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { RotateCcw } from 'lucide-react'
import { Button } from '../../components/Button'
import { GameBackground } from '../../components/GameBackground'
import { FullScreenSpinner } from '../../components/Spinner'
import { getGamePin, hostFinish, hostOpenAnswers, hostReveal, hostScoreboard, hostSetLocked, hostShowQuestion } from '../../lib/api'
import { serverNow, syncClock } from '../../lib/clock'
import { PREVIEW_SECONDS } from '../../lib/theme'
import { sound } from '../../lib/sound'
import type { GameStatus, Team } from '../../lib/types'
import { useGame } from '../../lib/useGame'
import { useWakeLock } from '../../lib/useWakeLock'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ErrorToast } from './components/ErrorToast'
import { HostHeader } from './components/HostHeader'
import { StatusPage } from './components/StatusPage'
import { TeamsDialog } from './components/TeamsDialog'
import { useAnswers } from './hooks/useAnswers'
import { useFullscreen } from './hooks/useFullscreen'
import { useHostActions } from './hooks/useHostActions'
import { useHostKeys } from './hooks/useHostKeys'
import { useProjectorScale } from './hooks/useProjectorScale'
import { useTeams } from './hooks/useTeams'
import { ExplanationScreen } from './screens/ExplanationScreen'
import { LobbyScreen } from './screens/LobbyScreen'
import { PodiumScreen } from './screens/PodiumScreen'
import { PreviewScreen } from './screens/PreviewScreen'
import { QuestionScreen } from './screens/QuestionScreen'
import { ScoreboardScreen } from './screens/ScoreboardScreen'
import { errorMessage, hasExplanation, stateKey } from './utils'

/** Rezerva po konci času – server prijíma odpovede ešte 1 s po ends_at. */
const REVEAL_GRACE_MS = 1000
/** Keď odpovedali všetci, chvíľu nechaj vidieť plné počítadlo. */
const ALL_ANSWERED_DELAY_MS = 800

export default function HostPage() {
  const { gameId = '' } = useParams()
  // nová hra = čistý stav (refy, časovače, odbery)
  return <HostGame key={gameId} gameId={gameId} />
}

function HostGame({ gameId }: { gameId: string }) {
  const { game, error, reload } = useGame(gameId)
  const pin = useGamePin(gameId, game != null)
  const rem = useProjectorScale()
  useWakeLock(true)
  const clockReady = useClockReady()
  useSoundUnlock()
  useDocumentTitle(game?.quiz_title)

  const status = game?.status
  const idx = game?.question_index ?? -1
  const key = game ? stateKey(game) : ''

  // počas otázky sa tímy tiež dopytujú – odchod/vyhodenie tímu musí hneď znížiť počet,
  // na ktorý čaká automatické vyhodnotenie „odpovedali všetci“
  const { teams, refetch: refetchTeams, kick } = useTeams(gameId, status === 'lobby' || status === 'question')
  const answers = useAnswers(gameId, idx, status === 'question')
  const { run, isBusy, toast, notify, dismiss } = useHostActions(gameId, reload)
  const fullscreen = useFullscreen()
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [teamsOpen, setTeamsOpen] = useState(false)

  // prvý videný stav – ak je hra už ukončená, stupne víťazov bez dramatickej sekvencie
  const [initialStatus, setInitialStatus] = useState<GameStatus | null>(null)
  if (game && initialStatus === null) setInitialStatus(game.status)

  // pri každej zmene stavu načítaj čerstvé tímy (skóre po odhalení) aj odpovede
  const refetchAnswers = answers.refetch
  useEffect(() => {
    if (!key) return
    refetchTeams()
    refetchAnswers()
  }, [key, refetchTeams, refetchAnswers])

  // chybové hlásenie k predošlému stavu už nie je aktuálne
  useEffect(() => {
    dismiss()
  }, [key, dismiss])

  const teamCount = teams?.length ?? 0
  const answeredCount = useMemo(() => {
    const ids = new Set((teams ?? []).map((t) => t.id))
    return new Set(answers.rows.filter((a) => ids.has(a.team_id)).map((a) => a.team_id)).size
  }, [teams, answers.rows])

  // --- automatické prechody ---------------------------------------------

  // preview: termín otvorenia odpovedí (po obnovení stránky sa 5 s začne odznova)
  const [preview, setPreview] = useState<{ key: string; at: number } | null>(null)
  if (status === 'preview' && preview?.key !== key) setPreview({ key, at: Date.now() + PREVIEW_SECONDS * 1000 })
  const previewAt = status === 'preview' && preview?.key === key ? preview.at : null

  useEffect(() => {
    if (previewAt === null) return
    const t = setTimeout(
      () => run(`${key}:open`, () => hostOpenAnswers(gameId), { auto: true, expect: key }),
      Math.max(0, previewAt - Date.now()),
    )
    return () => clearTimeout(t)
  }, [previewAt, key, gameId, run])

  // question: koniec času (podľa serverových hodín)
  const endsAt = status === 'question' ? (game?.ends_at ?? null) : null
  useEffect(() => {
    if (!endsAt || !clockReady) return
    const delay = new Date(endsAt).getTime() + REVEAL_GRACE_MS - serverNow()
    const t = setTimeout(
      () => run(`${key}:reveal`, () => hostReveal(gameId), { auto: true, expect: key }),
      Math.max(0, delay),
    )
    return () => clearTimeout(t)
  }, [endsAt, clockReady, key, gameId, run])

  // question: odpovedali všetky tímy
  const allAnswered = status === 'question' && teamCount > 0 && answeredCount >= teamCount
  useEffect(() => {
    if (!allAnswered) return
    const t = setTimeout(
      () => run(`${key}:reveal`, () => hostReveal(gameId), { auto: true, expect: key }),
      ALL_ANSWERED_DELAY_MS,
    )
    return () => clearTimeout(t)
  }, [allAnswered, key, gameId, run])

  // --- akcie hosta ---------------------------------------------------------

  const startKey = `${key}:start`
  const start = useCallback(() => {
    sound.unlock()
    run(startKey, () => hostShowQuestion(gameId, 0))
  }, [run, startKey, gameId])

  const skipKey = `${key}:reveal`
  const skip = useCallback(() => {
    run(skipKey, () => hostReveal(gameId), { expect: key })
  }, [run, skipKey, key, gameId])

  // vysvetlenie je samostatná obrazovka po odhalení – len na projektore, server o nej nevie
  const explainable = hasExplanation(game?.question)
  const [explainedKey, setExplainedKey] = useState<string | null>(null)
  const explaining = status === 'reveal' && explainable && explainedKey === key

  const nextKey = `${key}:next`
  const questionCount = game?.question_count ?? 0
  const next = useCallback(() => {
    if (status === 'reveal' && explainable && !explaining) {
      setExplainedKey(key)
    } else if (status === 'reveal') {
      const last = idx >= questionCount - 1
      run(nextKey, () => (last ? hostFinish(gameId) : hostScoreboard(gameId)), { expect: key })
    } else if (status === 'scoreboard') {
      const last = idx + 1 >= questionCount
      run(nextKey, () => (last ? hostFinish(gameId) : hostShowQuestion(gameId, idx + 1)), { expect: key })
    }
  }, [status, explainable, explaining, idx, questionCount, run, nextKey, key, gameId])

  const endGame = useCallback(() => {
    setConfirmEnd(false)
    const wasQuestion = status === 'question'
    run('end', async () => {
      // rozbehnutá otázka sa najprv vyhodnotí, aby sa započítali už odoslané odpovede
      if (wasQuestion) await hostReveal(gameId)
      await hostFinish(gameId)
    })
  }, [status, run, gameId])

  const locked = game?.locked ?? false
  const toggleLock = useCallback(() => {
    run('lock', () => hostSetLocked(gameId, !locked))
  }, [run, gameId, locked])

  const kickTeam = async (team: Team): Promise<void> => {
    try {
      await kick(team.id)
    } catch (e) {
      notify(`Tím „${team.name}“ sa nepodarilo vyhodiť: ${errorMessage(e)}`, () => {
        dismiss()
        kickTeam(team)
      })
    }
  }

  const primary =
    status === 'lobby' ? (teamCount > 0 ? start : null) : status === 'reveal' || status === 'scoreboard' ? next : null
  useHostKeys({ primary, fullscreen: fullscreen.toggle })

  // --- vykreslenie ---------------------------------------------------------

  if (game === undefined) {
    if (error) {
      return (
        <StatusPage title="Hru sa nepodarilo načítať">
          <p>{error}</p>
          <Button variant="brand" size="lg" icon={<RotateCcw className="size-5" />} onClick={reload}>
            Skúsiť znova
          </Button>
        </StatusPage>
      )
    }
    return <FullScreenSpinner dark />
  }

  if (game === null) {
    return (
      <StatusPage title="Hra sa nenašla">
        <p>Odkaz je neplatný alebo hra bola vymazaná.</p>
        <Link to="/admin" className="btn-3d inline-flex h-14 items-center rounded-lg bg-brand-700 px-6 text-lg font-bold text-white">
          Späť do administrácie
        </Link>
      </StatusPage>
    )
  }

  let screenKey: string
  let screen: ReactNode
  switch (game.status) {
    case 'lobby':
      screenKey = 'lobby'
      screen = <LobbyScreen game={game} pin={pin} teams={teams} starting={isBusy(startKey)} onStart={start} onKick={kickTeam} />
      break
    case 'preview':
      screenKey = `preview:${idx}`
      screen = <PreviewScreen game={game} endsAt={previewAt ?? Date.now() + PREVIEW_SECONDS * 1000} />
      break
    case 'question':
    case 'reveal':
      if (explaining) {
        screenKey = `explain:${idx}`
        screen = <ExplanationScreen game={game} busy={isBusy(nextKey)} onNext={next} />
        break
      }
      // otázka a jej vyhodnotenie zdieľajú obrazovku – dlaždice plynulo prejdú do odhalenia
      screenKey = `stage:${idx}`
      screen = (
        <QuestionScreen
          game={game}
          teamCount={teamCount}
          answeredCount={answeredCount}
          answers={answers.rows}
          rem={rem}
          skipping={isBusy(skipKey)}
          onSkip={skip}
          nextBusy={isBusy(nextKey)}
          onNext={next}
        />
      )
      break
    case 'scoreboard':
      screenKey = `scoreboard:${idx}`
      screen = (
        <ScoreboardScreen
          teams={teams}
          answers={answers.rows}
          answersReady={answers.ready}
          expectedAnswers={game.question?.answered ?? 0}
          busy={isBusy(nextKey)}
          onNext={next}
        />
      )
      break
    case 'finished':
      screenKey = 'finished'
      screen = <PodiumScreen gameId={gameId} game={game} animated={initialStatus !== 'finished'} />
      break
  }

  return (
    <GameBackground className="h-dvh">
      <div className="flex h-dvh flex-col">
        <HostHeader
          game={game}
          pin={pin}
          ending={isBusy('end')}
          onEnd={() => setConfirmEnd(true)}
          locking={isBusy('lock')}
          onToggleLock={toggleLock}
          onTeams={() => setTeamsOpen(true)}
          teamCount={teamCount}
        />
        <main className="relative min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={screenKey}
              className="absolute inset-0"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {screen}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        title="Ukončiť hru?"
        message="Hra sa skončí pre všetky tímy a zobrazia sa výsledky. Toto sa nedá vrátiť späť."
        confirmLabel="Ukončiť hru"
        danger
        onConfirm={endGame}
        onCancel={() => setConfirmEnd(false)}
      />
      <TeamsDialog
        open={teamsOpen && game.status !== 'lobby' && game.status !== 'finished'}
        teams={teams}
        onKick={kickTeam}
        onClose={() => setTeamsOpen(false)}
      />
      <ErrorToast toast={toast} onDismiss={dismiss} />
    </GameBackground>
  )
}

/** PIN hry z neverejnej tabuľky game_pins (len admin). Načíta sa, keď je hra načítaná. */
function useGamePin(gameId: string, ready: boolean): string | null {
  const [pin, setPin] = useState<string | null>(null)
  useEffect(() => {
    if (!ready || pin) return
    let alive = true
    let retry: ReturnType<typeof setTimeout> | undefined
    const load = () => {
      getGamePin(gameId)
        .then((p) => {
          if (alive && p) setPin(p)
        })
        .catch(() => {
          if (alive) retry = setTimeout(load, 3000) // výpadok siete – skús znova
        })
    }
    load()
    return () => {
      alive = false
      clearTimeout(retry)
    }
  }, [gameId, ready, pin])
  return pin
}

/** Synchronizácia hodín so serverom; do jej dokončenia sa podľa času neodhaľuje. */
function useClockReady(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    syncClock().finally(() => {
      if (alive) setReady(true)
    })
    return () => {
      alive = false
    }
  }, [])
  return ready
}

/** Prvé kliknutie / kláves kdekoľvek odomkne zvuk (napr. po obnovení stránky). */
function useSoundUnlock() {
  useEffect(() => {
    const unlock = () => sound.unlock()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])
}

function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = `${title} · Kvízovka`
    return () => {
      document.title = previous
    }
  }, [title])
}
