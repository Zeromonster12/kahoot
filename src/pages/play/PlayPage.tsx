import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { MotionConfig, motion } from 'motion/react'
import { CircleAlert, UserRoundX } from 'lucide-react'
import { ApiError, submitAnswer } from '../../lib/api'
import { syncClock } from '../../lib/clock'
import { clearTeamSession, loadTeamSession, type TeamSession } from '../../lib/session'
import { vibrate } from '../../lib/sound'
import { useGame } from '../../lib/useGame'
import { useWakeLock } from '../../lib/useWakeLock'
import { GameBackground } from '../../components/GameBackground'
import { PlayHeader } from './PlayHeader'
import { useTeamState } from './useTeamState'
import { useAutoAdvance, useIsPast } from './hooks'
import { ANSWER_BG_OVERRIDE, ScreenLoading } from './ui'
import { LobbyScreen } from './screens/LobbyScreen'
import { PreviewScreen } from './screens/PreviewScreen'
import { QuestionScreen } from './screens/QuestionScreen'
import { AnsweredScreen } from './screens/AnsweredScreen'
import { TimeUpScreen } from './screens/TimeUpScreen'
import { RevealScreen, revealResult } from './screens/RevealScreen'
import { ScoreboardScreen } from './screens/ScoreboardScreen'
import { FinishedScreen } from './screens/FinishedScreen'
import { MessageScreen } from './screens/MessageScreen'
import { SlideScreen } from './screens/SlideScreen'
import { questionProgress } from '../../lib/progress'

type Tone = 'brand' | 'correct' | 'wrong' | 'neutral'

/** Lokálny stav odoslania odpovede na otázku `idx`. */
interface Submission {
  idx: number
  answer: number
  status: 'sending' | 'sent' | 'late' | 'error'
  error?: string
}

export function PlayPage() {
  const navigate = useNavigate()
  const [session] = useState(loadTeamSession)

  useEffect(() => {
    if (!session) navigate('/', { replace: true })
  }, [session, navigate])

  if (!session) return null
  return (
    <MotionConfig reducedMotion="user">
      <PlayGame session={session} />
    </MotionConfig>
  )
}

function PlayGame({ session }: { session: TeamSession }) {
  const navigate = useNavigate()
  const { game, error: connectionError, reload: reloadGame } = useGame(session.gameId)
  // hra pokračuje aj vtedy, keď projektor nebeží (spadnutá alebo zatvorená karta učiteľa)
  useAutoAdvance(game, reloadGame)
  const team = useTeamState(session, game)
  const { refresh } = team
  const [submission, setSubmission] = useState<Submission | null>(null)
  /** otázka, na ktorú sa práve odosiela odpoveď (zámok proti dvojitému ťuknutiu) */
  const sendingIdx = useRef<number | null>(null)
  const timeUp = useIsPast(game?.status === 'question' ? game.ends_at : null)

  // synchronizácia hodín pri načítaní a pred každou otázkou (výsledok sa 60 s cachuje)
  const status = game?.status
  useEffect(() => {
    if (status === undefined || status === 'preview') void syncClock()
  }, [status])
  useWakeLock(true)

  const gone = game === null ? 'game' : team.gone
  useEffect(() => {
    if (gone) clearTeamSession()
  }, [gone])

  const leave = useCallback(() => {
    clearTeamSession()
    navigate('/', { replace: true })
  }, [navigate])

  const submit = useCallback(
    async (idx: number, answer: number) => {
      // stav sa prekreslí až o chvíľu – druhé ťuknutie zastaví ref
      if (sendingIdx.current === idx) return
      sendingIdx.current = idx
      setSubmission({ idx, answer, status: 'sending' })
      vibrate(30)

      let status: Submission['status'] = 'sent'
      let error: string | undefined
      try {
        await submitAnswer(session.teamId, session.token, answer)
      } catch (e) {
        const code = e instanceof ApiError ? e.code : 'unknown'
        if (code === 'already_answered') status = 'sent'
        else if (code === 'time_up' || code === 'not_accepting') status = 'late'
        else {
          status = 'error'
          error =
            code === 'network'
              ? 'Odpoveď sa nepodarilo odoslať. Skontrolujte pripojenie a skúste znova.'
              : 'Odpoveď sa nepodarilo odoslať. Skúste znova.'
        }
      } finally {
        if (sendingIdx.current === idx) sendingIdx.current = null
      }
      setSubmission((s) => (s && s.idx === idx ? { ...s, status, error } : s))
      void refresh()
    },
    [session, refresh],
  )

  if (gone === 'team') {
    return (
      <MessageScreen
        icon={<UserRoundX />}
        title="Váš tím bol z hry odstránený"
        text="Ak ide o omyl, požiadajte učiteľa a pripojte sa znova s PIN-om z projektora."
        onAction={leave}
      />
    )
  }
  if (gone === 'game') {
    return (
      <MessageScreen
        icon={<CircleAlert />}
        title="Hra už neexistuje"
        text="Učiteľ hru ukončil alebo zmazal. Ďakujeme, že ste hrali!"
        onAction={leave}
      />
    )
  }

  const state = team.data?.state ?? null
  const dataKey = team.data?.key ?? null
  let tone: Tone = 'brand'
  let bgOverride = ''
  let counter: string | undefined
  let viewKey = 'loading'
  /** obrazovka s tlačidlami odpovedí – presne na výšku displeja, bez rolovania */
  let fill = false
  let content: ReactNode = <ScreenLoading />

  if (game) {
    const idx = game.question_index
    const q = game.question
    viewKey = `${game.status}:${idx}`
    // číslovanie ráta len otázky (snímky nie)
    const progress = questionProgress(game)
    if ((game.status === 'preview' || game.status === 'question' || game.status === 'reveal') && idx >= 0) {
      counter = `${progress.number} / ${progress.total}`
    }

    switch (game.status) {
      case 'lobby':
        content = <LobbyScreen teamName={state?.name ?? session.name} quizTitle={game.quiz_title} />
        break

      case 'slide':
        if (q) content = <SlideScreen slide={q} />
        break

      case 'preview':
        if (q) content = <PreviewScreen question={q} index={progress.number - 1} count={progress.total} />
        break

      case 'question': {
        if (!q) break
        // odpoveď zo servera prežije obnovenie stránky; lokálna je optimistická
        const serverAnswer = state?.answer && state.answer.question_idx === idx ? state.answer : null
        const local = submission && submission.idx === idx ? submission : null
        const optimistic = local && (local.status === 'sending' || local.status === 'sent') ? local.answer : null
        const picked = serverAnswer ? serverAnswer.answer : optimistic

        if (picked !== null) {
          viewKey += ':answered'
          bgOverride = ANSWER_BG_OVERRIDE[picked] ?? ''
          content = (
            <AnsweredScreen
              answerIndex={picked}
              answerText={q.answers[picked] ?? ''}
              pending={!serverAnswer && local?.status === 'sending'}
              seed={`${session.teamId}:${idx}`}
            />
          )
        } else if (local?.status === 'late' || timeUp) {
          viewKey += ':timeup'
          content = <TimeUpScreen late={local?.status === 'late'} />
        } else if (team.settled) {
          // pred prvým načítaním stavu tímu nevieme, či už tím neodpovedal (obnovenie stránky)
          fill = true
          content = (
            <QuestionScreen
              question={q}
              endsAt={game.ends_at}
              onPick={(answer) => void submit(idx, answer)}
              error={local?.status === 'error' ? (local.error ?? null) : null}
              lastPick={local?.status === 'error' ? local.answer : null}
            />
          )
        }
        break
      }

      case 'reveal':
        // len čerstvé údaje načítané po odhalení – inak by sa ukázal výsledok minulej otázky
        if (q && state && (dataKey === `reveal:${idx}` || dataKey === `scoreboard:${idx}`)) {
          const result = revealResult(state, idx)
          tone = result === 'correct' ? 'correct' : result === 'wrong' ? 'wrong' : 'neutral'
          content = <RevealScreen question={q} state={state} questionIndex={idx} />
        } else {
          viewKey += ':loading'
          content = <ScreenLoading label="Vyhodnocujem…" />
        }
        break

      case 'scoreboard':
        if (state && (dataKey === `scoreboard:${idx}` || dataKey === `reveal:${idx}`)) {
          content = (
            <ScoreboardScreen
              gameId={game.id}
              teamId={session.teamId}
              questionIndex={idx}
              questionsLeft={progress.total - progress.number}
              state={state}
            />
          )
        } else {
          viewKey += ':loading'
        }
        break

      case 'finished':
        content = (
          <FinishedScreen
            gameId={game.id}
            teamId={session.teamId}
            fallback={dataKey?.startsWith('finished:') ? state : null}
            onPlayAgain={leave}
          />
        )
        break
    }
  }

  return (
    <PlayShell
      tone={tone}
      bgOverride={bgOverride}
      viewKey={viewKey}
      fill={fill}
      header={
        <PlayHeader
          name={state?.name ?? session.name}
          score={state?.score ?? null}
          counter={counter}
          reconnecting={Boolean(connectionError)}
        />
      }
    >
      {content}
    </PlayShell>
  )
}

/** Rozloženie na celú výšku obrazovky: hlavička + obsah aktuálnej fázy. */
function PlayShell({
  tone,
  bgOverride,
  viewKey,
  fill,
  header,
  children,
}: {
  tone: Tone
  bgOverride: string
  viewKey: string
  fill: boolean
  header: ReactNode
  children: ReactNode
}) {
  const mainRef = useRef<HTMLElement>(null)

  // nová obrazovka začína hore (predchádzajúca mohla byť odrolovaná)
  useLayoutEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [viewKey])

  return (
    <GameBackground tone={tone} className={`flex h-dvh touch-manipulation flex-col select-none ${bgOverride}`}>
      {header}
      <main
        ref={mainRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))]"
      >
        <motion.div
          key={viewKey}
          className={`flex flex-1 flex-col ${fill ? 'min-h-0' : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
        >
          {children}
        </motion.div>
      </main>
    </GameBackground>
  )
}
