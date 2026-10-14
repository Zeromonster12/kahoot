import type { ShapeKind } from '../lib/theme'

/** Biely symbol odpovede (▲ ◆ ● ■) ako v Kahoote. */
export function AnswerShape({ shape, className = 'size-8' }: { shape: ShapeKind; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={`shrink-0 drop-shadow-[0_2px_0_rgb(0_0_0/0.2)] ${className}`} aria-hidden>
      {shape === 'triangle' && <path d="M16 3 L30 28 H2 Z" fill="white" />}
      {shape === 'diamond' && <path d="M16 1 L31 16 L16 31 L1 16 Z" fill="white" />}
      {shape === 'circle' && <circle cx="16" cy="16" r="14" fill="white" />}
      {shape === 'square' && <rect x="3" y="3" width="26" height="26" rx="2" fill="white" />}
    </svg>
  )
}
