import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, MotionConfig, motion, useAnimate } from 'motion/react'
import { ArrowLeft, Dices, Play } from 'lucide-react'
import { ApiError, findGameByPin, getGame, joinGame } from '../../lib/api'
import { clearTeamSession, loadTeamSession, saveTeamSession, type TeamSession } from '../../lib/session'
import type { Game } from '../../lib/types'
import { Button } from '../../components/Button'
import { GameBackground } from '../../components/GameBackground'
import { Logo } from '../../components/Logo'
import { randomTeamName } from './teamNames'

const NAME_MAX = 24

const inputClass =
  'h-14 w-full rounded-lg border-2 border-gray-200 bg-white px-3 text-center text-ink outline-none transition-colors placeholder:text-gray-400 focus:border-brand-500 aria-[invalid=true]:border-ans-red'

/** Úvodná obrazovka hráča: PIN hry → názov tímu → /play. */
export function JoinPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [scope, animate] = useAnimate<HTMLDivElement>()

  const [step, setStep] = useState<'pin' | 'name'>('pin')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [game, setGame] = useState<Game | null>(null)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [rolls, setRolls] = useState(0)
  const [resume, setResume] = useState<TeamSession | null>(null)

  const shake = useCallback(() => {
    if (scope.current) void animate(scope.current, { x: [0, -14, 14, -10, 10, -5, 5, 0] }, { duration: 0.45 })
  }, [animate, scope])

  const checkPin = useCallback(
    async (value: string) => {
      if (!/^\d{6}$/.test(value)) {
        setPinError('PIN má 6 číslic – nájdete ho na projektore.')
        shake()
        return
      }
      setChecking(true)
      setPinError(null)
      try {
        const g = await findGameByPin(value)
        if (!g) {
          setPinError(`Hru s PIN-om ${value} sme nenašli. Skontrolujte ho na projektore.`)
          shake()
          return
        }
        setGame(g)
        setNameError(null)
        setStep('name')
      } catch (e) {
        setPinError(e instanceof Error ? e.message : 'PIN sa nepodarilo overiť.')
        shake()
      } finally {
        setChecking(false)
      }
    },
    [shake],
  )

  // PIN z QR kódu na projektore: /?pin=123456
  const autoChecked = useRef(false)
  useEffect(() => {
    if (autoChecked.current) return
    autoChecked.current = true
    const fromUrl = (searchParams.get('pin') ?? '').replace(/\D/g, '').slice(0, 6)
    if (!fromUrl) return
    setPin(fromUrl)
    if (fromUrl.length === 6) void checkPin(fromUrl)
  }, [searchParams, checkPin])

  // Rozohraná hra uložená v prehliadači (napr. po obnovení stránky)
  useEffect(() => {
    const saved = loadTeamSession()
    if (!saved) return
    let cancelled = false
    getGame(saved.gameId)
      .then((g) => {
        if (cancelled) return
        if (g && g.status !== 'finished') setResume(saved)
        else clearTeamSession()
      })
      .catch(() => {
        // bez spojenia nevieme overiť – ponúkneme pokračovanie, /play si poradí
        if (!cancelled) setResume(saved)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const leaveSaved = () => {
    clearTeamSession()
    setResume(null)
  }

  const submitPin = (e: FormEvent) => {
    e.preventDefault()
    if (!checking) void checkPin(pin)
  }

  const backToPin = () => {
    setStep('pin')
    setGame(null)
    setNameError(null)
  }

  const rollName = () => {
    setName(randomTeamName(name))
    setNameError(null)
    setRolls((r) => r + 1)
  }

  const join = async (e: FormEvent) => {
    e.preventDefault()
    if (joining) return
    const clean = name.replace(/\s+/g, ' ').trim()
    if (!clean) {
      setNameError('Zadajte názov tímu.')
      shake()
      return
    }
    setJoining(true)
    setNameError(null)
    try {
      const r = await joinGame(pin, clean)
      saveTeamSession({ gameId: r.game_id, teamId: r.team_id, token: r.token, name: r.name, pin })
      navigate('/play')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'game_not_found') {
        backToPin()
        setPinError('Hra medzitým skončila alebo neexistuje. Skontrolujte PIN.')
      } else {
        setNameError(err instanceof Error ? err.message : 'Pripojenie sa nepodarilo. Skúste znova.')
      }
      shake()
      setJoining(false)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <GameBackground className="flex flex-col">
        <main className="flex flex-1 flex-col items-center justify-center gap-6 pt-[max(2rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-6 pl-[max(1rem,env(safe-area-inset-left))]">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16 }}
          >
            <Logo size="lg" />
          </motion.div>

          <AnimatePresence>
            {resume && (
              <motion.div
                key="resume"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: -24 }}
                className="w-full max-w-sm"
              >
                <div className="game-card space-y-2 p-3">
                  <p className="px-1 text-xs font-extrabold tracking-widest text-gray-500 uppercase">Máte rozohranú hru</p>
                  <button
                    type="button"
                    onClick={() => navigate('/play')}
                    className="btn-3d flex w-full touch-manipulation items-center gap-3 rounded-lg bg-brand-700 px-4 py-3 text-left text-white"
                  >
                    <Play className="size-6 shrink-0 fill-current" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-white/80">Pokračovať ako tím</span>
                      <span className="block truncate text-lg font-black">{resume.name}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={leaveSaved}
                    className="w-full touch-manipulation py-1 text-sm font-bold text-gray-500 hover:text-ink"
                  >
                    Odísť z hry
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={scope} className="w-full max-w-sm">
            <AnimatePresence mode="wait" initial={false}>
              {step === 'pin' ? (
                <motion.form
                  key="pin"
                  noValidate
                  onSubmit={submitPin}
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.2 }}
                  className="game-card space-y-3 p-4"
                >
                  <label htmlFor="pin" className="sr-only">
                    PIN hry
                  </label>
                  <input
                    id="pin"
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                      setPinError(null)
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    maxLength={6}
                    placeholder="PIN hry"
                    aria-invalid={pinError ? true : undefined}
                    aria-describedby={pinError ? 'pin-error' : undefined}
                    className={`${inputClass} text-2xl font-black tracking-[0.3em] placeholder:font-bold placeholder:tracking-normal`}
                  />
                  {pinError && (
                    <p id="pin-error" role="alert" className="text-center text-sm font-bold text-ans-red">
                      {pinError}
                    </p>
                  )}
                  <Button type="submit" variant="primary" size="lg" loading={checking} className="w-full touch-manipulation">
                    Vstúpiť
                  </Button>
                </motion.form>
              ) : (
                <motion.form
                  key="name"
                  noValidate
                  onSubmit={join}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ duration: 0.2 }}
                  className="game-card space-y-3 p-4"
                >
                  <div className="text-center">
                    <p className="text-xs font-extrabold tracking-widest text-gray-500 uppercase">Kvíz</p>
                    <h2 className="text-xl leading-tight font-black wrap-break-word text-brand-700">{game?.quiz_title}</h2>
                    {game && game.status !== 'lobby' && (
                      <p className="mt-1 text-xs font-bold text-gray-500">Hra už prebieha – pripojíte sa rovno do nej.</p>
                    )}
                  </div>

                  <div>
                    <div className="mb-1 flex items-end justify-between px-0.5">
                      <label htmlFor="team-name" className="text-sm font-extrabold">
                        Názov tímu
                      </label>
                      <span className="text-xs font-bold text-gray-400 tabular-nums" aria-hidden>
                        {name.length}/{NAME_MAX}
                      </span>
                    </div>
                    <input
                      id="team-name"
                      autoFocus
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value.slice(0, NAME_MAX))
                        setNameError(null)
                      }}
                      maxLength={NAME_MAX}
                      autoComplete="off"
                      autoCapitalize="sentences"
                      enterKeyHint="go"
                      placeholder="napr. Múdre sovy"
                      aria-invalid={nameError ? true : undefined}
                      aria-describedby={nameError ? 'name-error' : undefined}
                      className={`${inputClass} text-xl font-extrabold placeholder:font-semibold`}
                    />
                    {nameError && (
                      <p id="name-error" role="alert" className="mt-1.5 text-sm font-bold text-ans-red">
                        {nameError}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    className="w-full touch-manipulation"
                    onClick={rollName}
                    icon={
                      <motion.span
                        className="inline-flex"
                        animate={{ rotate: rolls * 360 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      >
                        <Dices className="size-5" aria-hidden />
                      </motion.span>
                    }
                  >
                    Náhodný názov
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={joining}
                    disabled={!name.trim()}
                    className="w-full touch-manipulation"
                  >
                    Pripojiť sa
                  </Button>

                  <button
                    type="button"
                    onClick={backToPin}
                    className="mx-auto flex touch-manipulation items-center gap-1 py-1 text-sm font-bold text-gray-500 hover:text-ink"
                  >
                    <ArrowLeft className="size-4" aria-hidden />
                    Zmeniť PIN
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </main>

        <footer className="flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link to="/admin" className="rounded-md px-3 py-2 text-sm font-bold text-white/70 transition-colors hover:text-white">
            Pre učiteľov →
          </Link>
        </footer>
      </GameBackground>
    </MotionConfig>
  )
}
