import { Volume2, VolumeX } from 'lucide-react'
import { useMuted } from '../lib/sound'

export function MuteButton({ className = '' }: { className?: string }) {
  const [muted, setMuted] = useMuted()
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      className={`inline-flex size-11 items-center justify-center rounded-full bg-black/20 text-white transition hover:bg-black/30 ${className}`}
      title={muted ? 'Zapnúť zvuk' : 'Stlmiť zvuk'}
      aria-label={muted ? 'Zapnúť zvuk' : 'Stlmiť zvuk'}
    >
      {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
    </button>
  )
}
