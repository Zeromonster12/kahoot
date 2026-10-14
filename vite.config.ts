import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // .env lokálne + premenné prostredia, napr. z Vercelu (tie majú prednosť)
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [react(), tailwindcss()],
    // Do prehliadača ide len URL a verejný (anon) kľúč – nie celý prefix SUPABASE_*,
    // aby sa tam nikdy nedostal napr. SUPABASE_SERVICE_ROLE_KEY.
    define: {
      'import.meta.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL?.trim() ?? ''),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY?.trim() ?? ''),
    },
    build: {
      // xlsx (~500 kB) sa načítava len v administrácii pri importe/exporte
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            xlsx: ['xlsx'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
  }
})
