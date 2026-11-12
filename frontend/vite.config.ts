import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { createMockApi } from './mocks/payment-api.ts'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'pauseguard-local-payment-fixture',
      configureServer(server) {
        server.middlewares.use(createMockApi())
      },
      configurePreviewServer(server) {
        server.middlewares.use(createMockApi())
      },
    },
  ],
})
