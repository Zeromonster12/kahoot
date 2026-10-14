import { useSyncExternalStore } from 'react'

// Jednoduché zvukové efekty syntetizované cez Web Audio API (žiadne súbory).
// Prehliadač povolí zvuk až po prvej interakcii používateľa (klik).

const MUTE_KEY = 'kvizovka.muted'
let ctx: AudioContext | null = null
let muted = readMuted()
const listeners = new Set<() => void>()

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function audio(): AudioContext | null {
  if (muted) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', volume = 0.2) {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime + start
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + duration + 0.05)
}

export const sound = {
  /** odomkne zvuk – volaj pri kliknutí (napr. "Spustiť hru") */
  unlock() {
    audio()
  },
  /** nový tím v lobby */
  join() {
    tone(880, 0, 0.12, 'triangle', 0.15)
    tone(1320, 0.08, 0.15, 'triangle', 0.12)
  },
  /** tik posledných sekúnd */
  tick() {
    tone(1000, 0, 0.06, 'square', 0.06)
  },
  /** koniec času */
  timeUp() {
    tone(220, 0, 0.5, 'sawtooth', 0.12)
    tone(165, 0.05, 0.6, 'sawtooth', 0.1)
  },
  /** nová otázka */
  whoosh() {
    tone(392, 0, 0.12, 'triangle', 0.15)
    tone(523, 0.1, 0.12, 'triangle', 0.15)
    tone(659, 0.2, 0.2, 'triangle', 0.15)
  },
  correct() {
    tone(523, 0, 0.12, 'triangle')
    tone(659, 0.1, 0.12, 'triangle')
    tone(784, 0.2, 0.3, 'triangle')
  },
  wrong() {
    tone(311, 0, 0.18, 'square', 0.08)
    tone(233, 0.16, 0.35, 'square', 0.08)
  },
  /** víriace bubny pred vyhlásením miesta */
  drumroll(seconds = 1.6) {
    for (let t = 0; t < seconds; t += 0.05) tone(110 + Math.random() * 30, t, 0.05, 'triangle', 0.05 + (t / seconds) * 0.1)
  },
  fanfare() {
    const notes = [523, 659, 784, 1047, 784, 1047]
    const times = [0, 0.15, 0.3, 0.45, 0.7, 0.85]
    notes.forEach((n, i) => tone(n, times[i], i === notes.length - 1 ? 0.8 : 0.2, 'triangle', 0.18))
  },
  isMuted: () => muted,
  setMuted(value: boolean) {
    muted = value
    try {
      localStorage.setItem(MUTE_KEY, value ? '1' : '0')
    } catch {
      // ignore
    }
    listeners.forEach((l) => l())
  },
}

/** [muted, setMuted] – pre tlačidlo stlmenia */
export function useMuted(): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => muted,
  )
  return [value, sound.setMuted]
}

/** Krátka vibrácia na mobile (ak je podporovaná). */
export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // ignore
  }
}
