import { LoaderCircle } from 'lucide-react'

export function Spinner({ className = 'size-6' }: { className?: string }) {
  return <LoaderCircle className={`animate-spin ${className}`} aria-label="Načítava sa" />
}

export function FullScreenSpinner({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`flex min-h-dvh items-center justify-center ${dark ? 'bg-brand-700 text-white' : 'text-brand-700'}`}>
      <Spinner className="size-10" />
    </div>
  )
}
