// Ruta: src/composables/useToasts.js

import { useToast } from 'vue-toastification'

export function useToasts() {
  const toast = useToast()

  const showSuccess = (message) => {
    toast.success(message)
  }

  const showError = (message) => {
    toast.error(message)
  }

  return { showSuccess, showError }
}