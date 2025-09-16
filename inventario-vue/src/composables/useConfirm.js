// Ruta: src/composables/useConfirm.js (VERSIÓN FINAL Y CORRECTA)
import { ref, readonly } from 'vue';

// --- ESTADO GLOBAL (fuera de la función principal) ---
// Estas variables son compartidas por toda la aplicación.
const isVisible = ref(false);
const title = ref('');
const message = ref('');

// Callbacks para las acciones de confirmar o cancelar.
let onConfirmCallback = () => {};
let onCancelCallback = () => {};

export function useConfirm() {
  
  /**
   * Muestra el modal de confirmación con un título, mensaje y acciones.
   * Esta es la función que llamaremos desde nuestras vistas (HistoryView, StockView, etc.).
   */
  const showConfirm = (newTitle, newMessage, onOk, onKo = () => {}) => {
    title.value = newTitle;
    message.value = newMessage;
    onConfirmCallback = onOk;
    onCancelCallback = onKo;
    isVisible.value = true;
  };

  /**
   * Función que se ejecuta cuando el usuario hace clic en "Confirmar" DENTRO del modal.
   * Es utilizada por el componente AppModal.vue.
   */
  const onConfirm = () => {
    onConfirmCallback();
    isVisible.value = false;
  };

  /**
   * Función que se ejecuta cuando el usuario cierra el modal o hace clic en "Cancelar".
   * Es utilizada por el componente AppModal.vue.
   */
  const onCancel = () => {
    onCancelCallback();
    isVisible.value = false;
  };

  // Exponemos el estado (como solo lectura para evitar modificaciones accidentales)
  // y las funciones para que cualquier componente pueda usarlas.
  return {
    isVisible: readonly(isVisible),
    title: readonly(title),
    message: readonly(message),
    showConfirm,
    onConfirm,
    onCancel,
  };
}