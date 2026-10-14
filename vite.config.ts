import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
})
