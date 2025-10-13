import { createApp } from 'vue'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import App from './App.vue'
import router from './router'
import './assets/index.css'

// 1. Creamos la instancia de la aplicación
const app = createApp(App)

// 2. Le decimos a la app que use los plugins (Router y Toast)
app.use(router)
app.use(Toast, {
  position: "top-right",
  timeout: 4000,
})

// 3. (LA PARTE CLAVE) Esperamos a que el router esté listo
// router.isReady() devuelve una promesa que se resuelve cuando la navegación
// inicial (incluyendo el guardia `beforeEach` asíncrono) ha terminado.
router.isReady().then(() => {
  // 4. Solo entonces, montamos la aplicación en el DOM.
  app.mount('#app')
})