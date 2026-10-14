import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, animate, motion } from 'motion/react'
import { Ban, Maximize2, X, Zap } from 'lucide-react'
import { AnswerShape } from '../../components/AnswerShape'
import { Spinner } from '../../components/Spinner'
import { ANSWER_STYLES, formatScore } from '../../lib/theme'

/** Prebije farbu GameBackground farbou zvolenej odpovede (A–D). */
export const ANSWER_BG_OVERRIDE = ['bg-ans-red!', 'bg-ans-blue!', 'bg-ans-yellow!', 'bg-ans-green!']

/** "1 bod", "2 body", "5 bodov" (bez čísla) */
export function pluralPoints(n: number): string {
  const a = Math.abs(n)
  if (a === 1) return 'bod'
  if (a >= 2 && a <= 4) return 'body'
  return 'bodov'
}

/** "z 1 tímu", "z 8 tímov" */
export function ofTeams(n: number): string {
  return `z ${n} ${n === 1 ? 'tímu' : 'tímov'}`
}

export function questionsLeftText(n: number): string {
  if (n <= 0) return 'To bola posledná otázka!'
  if (n === 1) return 'Zostáva posledná otázka.'
  if (n <= 4) return `Zostávajú ešte ${n} otázky.`
  return `Zostáva ešte ${n} otázok.`
}

/** Veľkosť písma otázky podľa dĺžky textu. */
export function questionTextClass(length: number, compact = false): string {
  if (compact) {
    if (length <= 60) return 'text-lg sm:text-xl'
    if (length <= 140) return 'text-base sm:text-lg'
    return 'text-sm sm:text-base'
  }
  if (length <= 60) return 'text-2xl sm:text-3xl'
  if (length <= 120) return 'text-xl sm:text-2xl'
  if (length <= 220) return 'text-lg sm:text-xl'
  return 'text-base sm:text-lg'
}

/** Stabilný "náhodný" výber podľa seedu (rovnaký aj po obnovení stránky). */
export function pickStable<T>(list: T[], seed: string): T {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return list[h % list.length]
}

/**
 * Text, ktorý zmenší písmo tak, aby sa zmestil do dostupného miesta
 * (rodič musí mať pevnú výšku – napr. bunka mriežky).
 */
export function FitText({ text, max, min = 12, className = '' }: { text: string; max: number; min?: number; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const box = boxRef.current
    const el = textRef.current
    if (!box || !el) return
    let alive = true
    let frame = 0

    const fits = (size: number) => {
      el.style.fontSize = `${size}px`
      return el.scrollHeight <= box.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1
    }
    const fit = () => {
      if (!alive || box.clientHeight === 0 || box.clientWidth === 0) return
      // najprv skúšame bez lámania slov – radšej menšie písmo ako roztrhnuté slovo
      el.style.overflowWrap = 'normal'
      if (fits(max)) return
      let lo = min
      let hi = max
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2)
        if (fits(mid)) lo = mid
        else hi = mid
      }
      if (!fits(lo)) el.style.overflowWrap = 'anywhere'
    }

    fit()
    const ro =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(fit)
          })
    ro?.observe(box)
    // po načítaní písma Montserrat sa rozmery textu zmenia
    document.fonts?.ready.then(fit).catch(() => {})
    return () => {
      alive = false
      ro?.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [text, max, min])

  return (
    <div ref={boxRef} className="flex min-h-0 w-full min-w-0 flex-1 items-center overflow-hidden">
      <div ref={textRef} className={`w-full min-w-0 text-center ${className}`} style={{ fontSize: max }}>
        {text}
      </div>
    </div>
  )
}

/** Číslo, ktoré "nabehne" od nuly. */
export function CountUp({ value, duration = 1.1, delay = 0 }: { value: number; duration?: number; delay?: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      delay,
      ease: 'easeOut',
      onUpdate: (v) => setShown(Math.round(v)),
    })
    return () => controls.stop()
  }, [value, duration, delay])
  return <>{formatScore(shown)}</>
}

/** Štyri tvary odpovedí poskakujúce vo vlne – "čakáme". */
export function ShapesLoader({ className = 'size-6' }: { className?: string }) {
  return (
    <div className="flex items-end gap-2.5" aria-hidden>
      {ANSWER_STYLES.map((s, i) => (
        <motion.div
          key={s.letter}
          className={`rounded-lg p-1.5 shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)] ${s.bg}`}
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity, repeatDelay: 0.6, ease: 'easeInOut' }}
        >
          <AnswerShape shape={s.shape} className={className} />
        </motion.div>
      ))}
    </div>
  )
}

/** Štítok "2× body" / "Bez bodov" (štandardné body sa neoznačujú). */
export function PointsBadge({ points }: { points: number }) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold uppercase tracking-wide text-white shadow-[0_3px_0_rgb(0_0_0/0.2)] [&_svg]:size-4'
  if (points === 2000) {
    return (
      <span className={`${base} bg-ans-yellow`}>
        <Zap aria-hidden />2× body
      </span>
    )
  }
  if (points === 0) {
    return (
      <span className={`${base} bg-gray-600`}>
        <Ban aria-hidden />
        Bez bodov
      </span>
    )
  }
  return null
}

export function ScreenLoading({ label }: { label?: string }) {
  return (
    <div className="my-auto flex flex-col items-center gap-3 py-10 text-center">
      <Spinner className="size-10" />
      {label && <p className="font-bold text-white/85">{label}</p>}
    </div>
  )
}

/** Obrázok otázky – po ťuknutí sa zobrazí zväčšený cez celú obrazovku. */
export function ZoomableImage({ src, variant }: { src: string; variant: 'thumb' | 'inline' }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Zväčšiť obrázok"
        className={`relative shrink-0 touch-manipulation overflow-hidden bg-black/10 ${
          variant === 'thumb' ? 'size-16 rounded-lg sm:size-20' : 'max-w-full rounded-xl shadow-[0_6px_0_rgb(0_0_0/0.18)]'
        }`}
      >
        <img
          src={src}
          alt="Obrázok k otázke"
          draggable={false}
          className={variant === 'thumb' ? 'size-full object-cover' : 'max-h-[28dvh] max-w-full object-contain'}
        />
        <span className="absolute right-1 bottom-1 rounded-md bg-black/55 p-1 text-white">
          <Maximize2 className="size-3.5" aria-hidden />
        </span>
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="zoom"
              role="dialog"
              aria-modal="true"
              aria-label="Obrázok k otázke"
              className="fixed inset-0 z-50 flex touch-manipulation items-center justify-center bg-black/90 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            >
              <motion.img
                src={src}
                alt="Obrázok k otázke"
                className="max-h-full max-w-full rounded-lg object-contain"
                initial={{ scale: 0.85 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.85 }}
                draggable={false}
              />
              <button
                type="button"
                aria-label="Zavrieť"
                className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] flex size-11 items-center justify-center rounded-full bg-white/15 text-white"
              >
                <X className="size-6" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
