// Ruta: vite.config.js (VERSIÓN CORREGIDA CON ALIAS)

import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      // AQUÍ ESTÁ LA MAGIA: Le decimos que '@' es un atajo para la carpeta './src'
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})