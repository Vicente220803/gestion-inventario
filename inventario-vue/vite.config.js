import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path' // Importa el módulo 'path' de Node.js

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    // --- AQUÍ ESTÁ LA CONFIGURACIÓN CLAVE ---
    // Le decimos a Vite que el alias '@' se corresponde
    // con la ruta a la carpeta 'src' de nuestro proyecto.
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})