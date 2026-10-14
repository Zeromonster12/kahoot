import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { isAdmin } from './api'
import { FullScreenSpinner } from '../components/Spinner'

interface AuthState {
  /** undefined = ešte sa načítava */
  session: Session | null | undefined
  /** undefined = ešte sa overuje */
  admin: boolean | undefined
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [admin, setAdmin] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const loaded = session !== undefined
  useEffect(() => {
    if (!loaded) return
    if (!userId) {
      setAdmin(false)
      return
    }
    let cancelled = false
    setAdmin(undefined)
    isAdmin()
      .then((v) => !cancelled && setAdmin(v))
      .catch(() => !cancelled && setAdmin(false))
    return () => {
      cancelled = true
    }
  }, [userId, loaded])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      throw new Error(
        /invalid login credentials/i.test(error.message)
          ? 'Nesprávny e-mail alebo heslo.'
          : /email not confirmed/i.test(error.message)
            ? 'E-mail ešte nie je potvrdený.'
            : error.message,
      )
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return <AuthContext.Provider value={{ session, admin, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth musí byť vnútri <AuthProvider>')
  return ctx
}

/**
 * Obalí stránky, ktoré vyžadujú prihláseného admina.
 * Neprihláseného presmeruje na /admin/login?next=<aktuálna cesta>.
 * Prihláseného bez admin práv presmeruje na /admin/login?denied=1.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, admin } = useAuth()
  const location = useLocation()
  if (session === undefined || (session && admin === undefined)) return <FullScreenSpinner />
  const next = encodeURIComponent(location.pathname + location.search)
  if (!session) return <Navigate to={`/admin/login?next=${next}`} replace />
  if (!admin) return <Navigate to={`/admin/login?denied=1&next=${next}`} replace />
  return <>{children}</>
}
