import { CircleAlert, RefreshCw } from 'lucide-react'
import { Button } from '../../../components/Button'

/** Chybové hlásenie s tlačidlom „Skúsiť znova“. */
export function ErrorState({
  title = 'Nepodarilo sa načítať údaje',
  message,
  onRetry,
  className = '',
}: {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center rounded-2xl border border-red-100 bg-white px-6 py-10 text-center ${className}`}
    >
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-red-50 text-ans-red">
        <CircleAlert className="size-6" />
      </span>
      <h3 className="text-lg font-extrabold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-gray-600">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry} icon={<RefreshCw className="size-4" />}>
          Skúsiť znova
        </Button>
      )}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200/80 ${className}`} aria-hidden />
}

/** Malé chybové hlásenie nad už načítaným obsahom (napr. zlyhalo obnovenie). */
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-semibold text-ans-red"
    >
      <CircleAlert className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-bold underline underline-offset-2 hover:no-underline">
          Skúsiť znova
        </button>
      )}
    </div>
  )
}
