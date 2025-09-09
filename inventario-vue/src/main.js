// Ruta: src/main.js

import { createApp } from 'vue'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'

import App from './App.vue'
import '@/assets/index.css' // <-- Usando el alias '@'

const app = createApp(App)

app.use(Toast, {
  position: "top-right",
  timeout: 4000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
})

app.mount('#app')