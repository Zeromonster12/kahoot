import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { ArrowLeft, CircleAlert, Eye, EyeOff, LogOut, ShieldX } from 'lucide-react'
import { Button } from '../../components/Button'
import { GameBackground } from '../../components/GameBackground'
import { Logo } from '../../components/Logo'
import { Spinner } from '../../components/Spinner'
import { useAuth } from '../../lib/auth'

/** Povolí len lokálne cesty (žiadne presmerovanie na cudzí web). */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/admin'
  if (raw.startsWith('/admin/login')) return '/admin'
  return raw
}

export default function LoginPage() {
  const { session, admin, signIn, signOut } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  // po prihlásení môže byť `admin` ešte chvíľu starý (false) – čakáme, kým sa overenie spustí
  const [awaitingCheck, setAwaitingCheck] = useState(false)

  useEffect(() => {
    if (awaitingCheck && admin === undefined) setAwaitingCheck(false)
  }, [awaitingCheck, admin])

  if (session && admin === true) return <Navigate to={next} replace />

  const checking = session === undefined || (!!session && (admin === undefined || awaitingCheck))
  const denied = !!session && admin === false && !awaitingCheck

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Zadaj e-mail aj heslo.')
      return
    }
    setError(null)
    setSubmitting(true)
    setAwaitingCheck(true)
    try {
      await signIn(email, password)
      // presmerovanie zariadi kontrola admin práv vyššie
    } catch (err) {
      setAwaitingCheck(false)
      setError(
        err instanceof Error && !/fetch|network/i.test(err.message)
          ? err.message
          : 'Nepodarilo sa spojiť so serverom. Skontroluj pripojenie.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function onSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      setPassword('')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <GameBackground className="flex flex-col items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex w-full max-w-sm flex-col items-center"
      >
        <Logo size="lg" className="mb-8" />

        <div className="game-card w-full p-6 sm:p-8">
          {checking ? (
            <div className="flex flex-col items-center gap-3 py-8 text-brand-700">
              <Spinner className="size-8" />
              <p className="font-semibold text-gray-600">{session ? 'Overujem prístup…' : 'Načítava sa…'}</p>
            </div>
          ) : denied ? (
            <div className="text-center">
              <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-red-50 text-ans-red">
                <ShieldX className="size-7" />
              </span>
              <h1 className="text-xl font-extrabold">Prístup zamietnutý</h1>
              <p className="mt-2 text-gray-600">Tento účet nemá prístup do administrácie.</p>
              <p className="mt-1 text-sm break-all text-gray-500">
                Prihlásený ako <b className="text-ink">{session?.user.email}</b>
              </p>
              <Button
                variant="primary"
                size="lg"
                className="mt-6 w-full"
                onClick={onSignOut}
                loading={signingOut}
                icon={<LogOut className="size-5" />}
              >
                Odhlásiť sa
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <h1 className="text-center text-2xl font-extrabold">Prihlásenie učiteľa</h1>
              <p className="mt-1 mb-6 text-center text-sm text-gray-500">Správa kvízov a spúšťanie hier</p>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-gray-700">E-mail</span>
                <input
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                  className="h-12 w-full rounded-lg border-2 border-gray-200 px-3 font-semibold outline-none transition focus:border-brand-500"
                  placeholder="ucitel@skola.sk"
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-bold text-gray-700">Heslo</span>
                <span className="relative block">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 w-full rounded-lg border-2 border-gray-200 pr-12 pl-3 font-semibold outline-none transition focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-1.5 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-ink"
                    aria-label={showPassword ? 'Skryť heslo' : 'Zobraziť heslo'}
                    title={showPassword ? 'Skryť heslo' : 'Zobraziť heslo'}
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </span>
              </label>

              {error && (
                <p
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm font-semibold text-ans-red"
                >
                  <CircleAlert className="mt-px size-4 shrink-0" />
                  {error}
                </p>
              )}

              <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" loading={submitting}>
                Prihlásiť sa
              </Button>
            </form>
          )}
        </div>

        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-bold text-white/80 transition hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Späť na pripojenie do hry
        </Link>
      </motion.div>
    </GameBackground>
  )
}
