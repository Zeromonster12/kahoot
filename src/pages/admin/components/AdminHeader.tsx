import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CircleUser, LogOut } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Logo } from '../../../components/Logo'
import { useAuth } from '../../../lib/auth'

export function AdminHeader() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function onSignOut() {
    setBusy(true)
    try {
      await signOut()
      navigate('/admin/login', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/admin" className="rounded-md" aria-label="Kvízovka – moje kvízy">
          <Logo light={false} size="sm" />
        </Link>
        <span className="hidden rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold tracking-wide text-brand-700 uppercase sm:inline">
          Administrácia
        </span>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {session?.user.email && (
            <span className="hidden min-w-0 items-center gap-1.5 text-sm font-semibold text-gray-600 md:inline-flex">
              <CircleUser className="size-5 shrink-0 text-gray-400" aria-hidden />
              <span className="truncate">{session.user.email}</span>
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={onSignOut} loading={busy} icon={<LogOut className="size-4" />}>
            Odhlásiť
          </Button>
        </div>
      </div>
    </header>
  )
}
