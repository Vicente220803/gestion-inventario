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

  const showInfo = (message) => {
    toast.info(message)
  }

  const showWarning = (message) => {
    toast.warning(message)
  }

  return { showSuccess, showError, showInfo, showWarning }
}