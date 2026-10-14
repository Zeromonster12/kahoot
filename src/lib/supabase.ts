import { createClient } from '@supabase/supabase-js'

// hodnoty vkladá vite.config.ts (define) z premenných SUPABASE_URL a SUPABASE_ANON_KEY
const url = import.meta.env.SUPABASE_URL as string | undefined
const key = import.meta.env.SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && key)

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 20 } },
})

export const IMAGE_BUCKET = 'quiz-images'
