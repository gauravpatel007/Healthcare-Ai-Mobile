import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { validateMobileApiUrl } from './src/utils/apiConfig.js'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === 'android') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    validateMobileApiUrl((process.env.VITE_API_URL || env.VITE_API_URL || '').trim());
  }
  return {
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    fs: {
      allow: ['..']
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
  }
})
