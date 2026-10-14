import { useCallback, useRef, useState, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Modal } from './Modal'

export interface ConfirmOptions {
  title: ReactNode
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** červené potvrdzovacie tlačidlo (mazanie) */
  danger?: boolean
}

export function ConfirmDialog({
  open,
  options,
  onResult,
}: {
  open: boolean
  options: ConfirmOptions | null
  onResult: (ok: boolean) => void
}) {
  const o = options ?? { title: '' }
  return (
    <Modal
      open={open}
      onClose={() => onResult(false)}
      size="sm"
      title={o.title}
      icon={
        o.danger ? (
          <span className="flex size-10 items-center justify-center rounded-full bg-red-50 text-ans-red">
            <TriangleAlert className="size-5" />
          </span>
        ) : undefined
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onResult(false)} data-autofocus>
            {o.cancelLabel ?? 'Zrušiť'}
          </Button>
          <Button variant={o.danger ? 'danger' : 'brand'} size="sm" onClick={() => onResult(true)}>
            {o.confirmLabel ?? 'Potvrdiť'}
          </Button>
        </>
      }
    >
      {o.message && <div className="text-[15px] leading-relaxed text-gray-600">{o.message}</div>}
    </Modal>
  )
}

/**
 * Potvrdzovacie okno ako Promise:
 *   const [confirm, confirmDialog] = useConfirm()
 *   if (!(await confirm({ title: 'Zmazať?', danger: true }))) return
 * a {confirmDialog} vykresli niekde v komponente.
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [state, setState] = useState<{ open: boolean; options: ConfirmOptions | null }>({ open: false, options: null })
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    resolver.current?.(false)
    setState({ open: true, options })
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const onResult = useCallback((ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setState((s) => ({ ...s, open: false }))
  }, [])

  return [confirm, <ConfirmDialog open={state.open} options={state.options} onResult={onResult} />]
}
