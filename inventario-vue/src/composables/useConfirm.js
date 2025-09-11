// Ruta: src/composables/useConfirm.js
import { ref } from 'vue';

const isVisible = ref(false);
const title = ref('');
const message = ref('');
let resolvePromise = null;

export function useConfirm() {
  const show = (newTitle, newMessage) => {
    title.value = newTitle;
    message.value = newMessage;
    isVisible.value = true;
    return new Promise((resolve) => {
      resolvePromise = resolve;
    });
  };

  const onConfirm = () => {
    isVisible.value = false;
    if (resolvePromise) resolvePromise(true);
  };

  const onCancel = () => {
    isVisible.value = false;
    if (resolvePromise) resolvePromise(false);
  };

  return { isVisible, title, message, show, onConfirm, onCancel };
  
}