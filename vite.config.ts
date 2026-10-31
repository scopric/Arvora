import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // O plugin do React Router não roda dentro do vitest.
  plugins: [tailwindcss(), process.env.VITEST ? react() : reactRouter()],
  server: { port: 5190, strictPort: true },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'] },
})
