<!-- Ruta: src/views/NewOrderView.vue -->
<script setup>
import { ref, computed } from 'vue';
import { useInventory } from '../composables/useInventory';
import { useToasts } from '../composables/useToasts'; // <-- Importamos el ayudante
import emailjs from '@emailjs/browser';

const { productsWithSku, materialStock, addMovement } = useInventory();
const { showSuccess, showError } = useToasts(); // <-- Lo preparamos para usar

const fechaPedido = ref(new Date().toISOString().slice(0, 10));
const fechaEntrega = ref('');
const comentarios = ref('');
const items = ref([{ id: 0, desc: '', sku: '', cantidad: 1 }]);
const isSending = ref(false);

const productNames = computed(() => Object.keys(productsWithSku.value));

function addItem() { /* ... (sin cambios) ... */ }
function removeItem(index) { /* ... (sin cambios) ... */ }
function updateSku(item) { /* ... (sin cambios) ... */ }

async function submitOrder() {
  if (!fechaEntrega.value) { return showError('Falta fecha de entrega'); }
  const validItems = items.value.filter(item => item.desc && item.cantidad > 0);
  if (validItems.length === 0) { return showError('Añade al menos un artículo'); }
  for (const item of validItems) {
    if ((materialStock.value[item.sku] || 0) < item.cantidad) {
      return showError(`Stock insuficiente para ${item.desc}`);
    }
  }

  isSending.value = true;
  // ... (código de preparación de emailjs sin cambios) ...

  try {
    await emailjs.send(/* ... */);
    addMovement({ /* ... */ });
    
    showSuccess('¡Pedido registrado y correo enviado con éxito!'); // <-- CAMBIO
    
    // ... (código de reseteo del formulario sin cambios) ...
  } catch (error) {
    console.error('Error de EmailJS:', error);
    showError('Hubo un error al enviar el correo. El pedido no se ha registrado.'); // <-- CAMBIO
  } finally {
    isSending.value = false;
  }
}

async function sendNoOrderNotification() {
  if (!confirm(`¿...`)) { return; } // Dejamos el confirm por ahora
  isSending.value = true;
  // ... (código de preparación de emailjs sin cambios) ...
  try {
    await emailjs.send(/* ... */);
    showSuccess(`Notificación de "Sin Pedido" enviada con éxito.`); // <-- CAMBIO
  } catch (error) {
    console.error('Error de EmailJS:', error);
    showError('Hubo un error al enviar la notificación.'); // <-- CAMBIO
  } finally {
    isSending.value = false;
  }
}
</script>

<template>
  <!-- El template no necesita cambios -->
</template>