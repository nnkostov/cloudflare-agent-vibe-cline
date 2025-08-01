import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteVersionPlugin } from './vite-version-plugin.js'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), viteVersionPlugin()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
