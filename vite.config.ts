import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves this repo under /quantum2/, so assets must be
// referenced relative to that path. Local dev (base '/') is unaffected
// because the dev server ignores base when it's the default.
export default defineConfig({
  base: '/quantum2/',
  plugins: [react()],
  server: {
    port: 5180,
  },
})
