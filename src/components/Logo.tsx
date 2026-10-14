/** Logo "Kvízovka" – štyri tvary odpovedí + názov. */
export function Logo({ className = '', light = true, size = 'md' }: { className?: string; light?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const text = { sm: 'text-xl', md: 'text-3xl', lg: 'text-5xl sm:text-6xl' }[size]
  const mark = { sm: 'size-7', md: 'size-10', lg: 'size-14 sm:size-16' }[size]
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 64 64" className={mark} aria-hidden>
        <rect width="64" height="64" rx="14" fill={light ? 'white' : '#46178f'} />
        <path d="M18 29 L28 12 L38 29 Z" fill="#e21b3c" />
        <rect x="38" y="13" width="14" height="14" rx="1" transform="rotate(45 45 20)" fill="#1368ce" />
        <circle cx="22" cy="45" r="8" fill="#d89e00" />
        <rect x="37" y="37" width="15" height="15" rx="1.5" fill="#26890c" />
      </svg>
      <span className={`font-black tracking-tight ${text} ${light ? 'text-white text-shadow' : 'text-brand-700'}`}>
        Kvízovka
      </span>
    </div>
  )
}
