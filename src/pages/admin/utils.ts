import { ApiError, toApiError } from '../../lib/api'

/** UUID v4 – crypto.randomUUID funguje len na https/localhost, preto záložné riešenie. */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function isUuid(s: string | undefined): s is string {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

/** Odstráni diakritiku, zmenší písmená a zjednotí medzery. */
export function normalizeKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function slugify(s: string, fallback = 'kviz'): string {
  const slug = normalizeKey(s).replace(/ /g, '-').slice(0, 60).replace(/-+$/, '')
  return slug || fallback
}

const dateFmt = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('sk-SK', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso))
}

/** Zrozumiteľná slovenská správa pre ľubovoľnú chybu (Supabase, Storage, sieť…). */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError && e.code !== 'unknown') return e.message
  const raw =
    e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e)
  if (/fetch|network/i.test(raw)) return 'Nepodarilo sa spojiť so serverom. Skontroluj pripojenie na internet.'
  if (/jwt|token.*expired|not authenticated/i.test(raw)) return 'Prihlásenie vypršalo. Obnov stránku a prihlás sa znova.'
  if (/row-level security|permission denied|not_authorized/i.test(raw)) return 'Na túto akciu nemáš oprávnenie.'
  if (/maximum allowed size|too large|payload/i.test(raw)) return 'Súbor je príliš veľký (max. 5 MB).'
  if (/mime type/i.test(raw)) return 'Tento formát obrázka nie je podporovaný.'
  if (/bucket not found/i.test(raw)) return 'Úložisko obrázkov nie je nastavené (chýba bucket „quiz-images“).'
  if (/check constraint|violates/i.test(raw)) return 'Údaje nespĺňajú pravidlá databázy (napr. príliš dlhý alebo prázdny text).'
  if (e instanceof ApiError) return e.message
  return raw ? `Nastala chyba: ${raw}` : 'Nastala neznáma chyba.'
}

/** Vyhodí chybu z výsledku Supabase volania. */
export function check<T extends { error: { message?: string } | null }>(res: T): T {
  if (res.error) throw toApiError(res.error)
  return res
}
