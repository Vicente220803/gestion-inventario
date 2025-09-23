import { createApp } from 'vue'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import App from './App.vue'
import router from './router'
import { supabase } from './supabase'
import { user, profile, isSessionLoading } from './authState'
import './assets/index.css'

const app = createApp(App)
app.use(router)
app.use(Toast, {
  position: "top-right",
  timeout: 4000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
})

isSessionLoading.value = false; // Disable loading to show login

app.mount('#app')