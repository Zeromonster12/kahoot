/** Kruhový odpočet s číslom sekúnd v strede. */
export function CountdownRing({
  remainingMs,
  totalMs,
  size = 96,
  className = '',
}: {
  remainingMs: number
  totalMs: number
  size?: number
  className?: string
}) {
  const r = 44
  const c = 2 * Math.PI * r
  const ratio = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0
  const seconds = Math.ceil(remainingMs / 1000)
  const urgent = seconds <= 5 && remainingMs > 0
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }} role="timer" aria-label={`Zostáva ${seconds} s`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r + 4} fill="#46178f" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(255 255 255 / 0.2)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={urgent ? '#ff3355' : 'white'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 100ms linear, stroke 200ms' }}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-black text-white tabular-nums ${urgent ? 'animate-pulse' : ''}`}
        style={{ fontSize: size * 0.38 }}
      >
        {seconds}
      </span>
    </div>
  )
}
