import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // En desarrollo el frontend llama a /api/... y Vite lo reenvía al backend.
  // Así navegador y API comparten origen: las cookies httpOnly de la Fase 2
  // funcionan sin configuraciones especiales de CORS.
  // 127.0.0.1 y no "localhost": Node 22 resuelve localhost primero como IPv6 (::1)
  // y el backend escucha en IPv4, lo que produce un 502 en el proxy.
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:4001'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: false },
      },
    },
    preview: { port: 4173, strictPort: true },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.js'],
      css: false,
      restoreMocks: true,
      // Las pruebas de pantallas completas (varios pasos de un formulario) pasan de 5 s cuando corren
      // todas a la vez en un equipo ocupado: se les da más margen (las del backend tienen 20 s)
      testTimeout: 15000,
    },
  }
})
