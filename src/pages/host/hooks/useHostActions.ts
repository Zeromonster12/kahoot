import { useCallback, useRef, useState } from 'react'
import { getGame } from '../../../lib/api'
import { errorMessage, stateKey } from '../utils'

export interface RunOptions {
  /** automatický prechod (časovač) – pre daný kľúč sa vyžiada najviac raz */
  auto?: boolean
  /**
   * Pred volaním over čerstvým načítaním, že hra je stále v tomto stave
   * (ochrana pred zastaraným druhým oknom hosta – RPC nemajú index otázky).
   */
  expect?: string
}

export interface Toast {
  id: number
  message: string
  retry?: () => void
}

/**
 * Spúšťa prechody hry (RPC hosta). Každý kľúč (napr. "question:3:reveal") beží
 * najviac raz naraz; automatické prechody sa po chybe neopakujú samé –
 * zobrazí sa chybové hlásenie s tlačidlom "Skúsiť znova".
 */
export function useHostActions(gameId: string, reload: () => Promise<void>) {
  const done = useRef(new Set<string>())
  const inflight = useRef(new Set<string>())
  const [busy, setBusy] = useState<readonly string[]>([])
  const [toast, setToast] = useState<Toast | null>(null)
  const toastId = useRef(0)

  const notify = useCallback((message: string, retry?: () => void) => {
    setToast({ id: ++toastId.current, message, retry })
  }, [])

  const dismiss = useCallback(() => setToast(null), [])

  const run = useCallback(
    async function exec(key: string, fn: () => Promise<unknown>, opts: RunOptions = {}): Promise<void> {
      if (inflight.current.has(key)) return
      if (opts.auto && done.current.has(key)) return
      done.current.add(key)
      inflight.current.add(key)
      setBusy([...inflight.current])
      try {
        if (opts.expect) {
          const fresh = await getGame(gameId)
          if (!fresh || stateKey(fresh) !== opts.expect) {
            await reload() // stav sa medzitým zmenil (napr. v inom okne)
            return
          }
        }
        await fn()
        await reload()
      } catch (e) {
        const id = ++toastId.current
        setToast({
          id,
          message: errorMessage(e),
          retry: () => {
            setToast((t) => (t?.id === id ? null : t))
            exec(key, fn, { ...opts, auto: false })
          },
        })
      } finally {
        inflight.current.delete(key)
        setBusy([...inflight.current])
      }
    },
    [gameId, reload],
  )

  const isBusy = useCallback((key: string) => busy.includes(key), [busy])

  return { run, isBusy, toast, notify, dismiss }
}
