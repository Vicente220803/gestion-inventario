// Ruta: src/main.js

import { createApp } from 'vue'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css' // Importa los estilos CSS

import App from './App.vue'
import './assets/index.css'

const app = createApp(App)

// Configura el plugin de notificaciones
app.use(Toast, {
  position: "top-right",
  timeout: 4000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
})

app.mount('#app')