<!-- RUTA: /inventario-vue/src/views/NewOrderView.vue -->
<script setup>
// --- 1. IMPORTACIONES ---
import { ref, computed, watch } from 'vue';
import { useInventory } from '../composables/useInventory';
import { useToasts } from '../composables/useToasts';
import emailjs from '@emailjs/browser';
import ImageModal from '../components/ImageModal.vue';
// Importamos el nuevo modal de confirmación con calendario
import ConfirmWithCalendarModal from '../components/ConfirmWithCalendarModal.vue';

// --- 2. INICIALIZACIÓN DE COMPOSABLES ---
const { productsWithSku, materialStock, addMovement } = useInventory();
const { showSuccess, showError } = useToasts();
// Ya no usamos el 'useConfirm' simple para esta acción.

// --- 3. ESTADO DEL FORMULARIO ---
const fechaPedido = ref(new Date().toISOString().slice(0, 10));
const fechaEntrega = ref('');
const comentarios = ref('');
const items = ref([{ id: 0, desc: '', sku: '', cantidad: 1, url_imagen: null }]);
const isSending = ref(false);

// --- 4. ESTADO DE LOS MODALES ---
const isImageModalVisible = ref(false);
const selectedImageUrl = ref('');
// Nuevas variables para controlar el modal de confirmación con calendario
const isConfirmModalVisible = ref(false);
const dateForModal = ref('');

// --- 5. DATOS CALCULADOS ---
const productNames = computed(() => Object.keys(productsWithSku.value));

// --- 6. FUNCIONES (Sin cambios en las funciones del formulario) ---
function showLargeImage(url) {
  if (url) {
    selectedImageUrl.value = url;
    isImageModalVisible.value = true;
  }
}
function addItem() {
  const newId = items.value.length > 0 ? Math.max(...items.value.map(i => i.id)) + 1 : 0;
  items.value.push({ id: newId, desc: '', sku: '', cantidad: 1, url_imagen: null });
}
function removeItem(index) {
  if (items.value.length > 1) {
    items.value.splice(index, 1);
  } else {
    showError('No puedes eliminar el último artículo.');
  }
}
function updateSku(item) {
  const productData = productsWithSku.value[item.desc];
  item.sku = productData?.sku || '';
  item.url_imagen = productData?.url_imagen || null;
}
watch(fechaPedido, (nuevaFecha) => {
  if (nuevaFecha) {
    const fechaBase = new Date(nuevaFecha + 'T00:00:00Z');
    const diaDeLaSemana = fechaBase.getUTCDay();
    if (diaDeLaSemana === 5) {
      fechaBase.setUTCDate(fechaBase.getUTCDate() + 3);
    } else {
      fechaBase.setUTCDate(fechaBase.getUTCDate() + 1);
    }
    fechaEntrega.value = fechaBase.toISOString().slice(0, 10);
  }
}, { immediate: true });

async function submitOrder() {
  if (!fechaEntrega.value) { return showError('Falta la fecha de entrega.'); }
  const validItems = items.value.filter(item => item.desc && item.cantidad > 0);
  if (validItems.length === 0) { return showError('Añade al menos un artículo válido.'); }
  for (const item of validItems) {
    if ((materialStock.value[item.sku] || 0) < item.cantidad) {
      return showError(`Stock insuficiente para ${item.desc}.`);
    }
  }
  isSending.value = true;
  const totalPallets = validItems.reduce((sum, item) => sum + Number(item.cantidad), 0);
  const itemsHtml = `<ul>` + validItems.map(item => `<li>${item.cantidad} x ${item.desc} (SKU: ${item.sku})</li>`).join('') + `</ul>`;
  const templateParams = {
    fecha_pedido: fechaPedido.value,
    fecha_entrega: fechaEntrega.value,
    items_html: itemsHtml,
    total_pallets: totalPallets,
    comentarios: comentarios.value || 'Sin comentarios.',
  };
  try {
    await emailjs.send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID, 
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID_PEDIDO,
      templateParams, 
      import.meta.env.VITE_EMAILJS_PUBLIC_KEY
    );
    await addMovement({
      fechaPedido: fechaPedido.value,
      fechaEntrega: fechaEntrega.value,
      pallets: totalPallets,
      comentarios: comentarios.value,
      items: JSON.parse(JSON.stringify(validItems.map(({ url_imagen, ...rest }) => rest))),
      tipo: 'Salida',
    });
    showSuccess('¡Pedido registrado y correo enviado con éxito!');
    fechaEntrega.value = '';
    comentarios.value = '';
    items.value = [{ id: 0, desc: '', sku: '', cantidad: 1, url_imagen: null }];
  } catch (error) {
    console.error('Error de EmailJS:', error);
    showError('Hubo un error al enviar el correo. El pedido no se ha registrado.');
  } finally {
    isSending.value = false;
  }
}

// --- 7. NUEVA LÓGICA PARA LA NOTIFICACIÓN "SIN PEDIDO" ---

// Esta función ahora solo abre nuestro modal personalizado
function sendNoOrderNotification() {
  if (!fechaEntrega.value) {
    showError('Por favor, selecciona una "Fecha de Entrega Deseada" antes de notificar.');
    return;
  }
  // Pasamos la fecha actual del formulario al modal y lo hacemos visible
  dateForModal.value = fechaEntrega.value;
  isConfirmModalVisible.value = true;
}

// Esta nueva función maneja el envío del correo DESPUÉS de confirmar en el modal
async function handleNotificationConfirm(modifiedDate) {
  // Cerramos el modal
  isConfirmModalVisible.value = false;
  isSending.value = true;
  
  // Usamos la fecha que recibimos del modal (modificada o no)
  const templateParams = { fecha_entrega: modifiedDate };
  
  try {
    await emailjs.send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID, 
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID_SIN_PEDIDO,
      templateParams, 
      import.meta.env.VITE_EMAILJS_PUBLIC_KEY
    );
    showSuccess(`Notificación de "Sin Pedido" para el día ${modifiedDate} enviada con éxito.`);
  } catch (error) {
    console.error('Error de EmailJS:', error);
    showError('Hubo un error al enviar la notificación.');
  } finally {
    isSending.value = false;
  }
}
</script>

<template>
  <div>
    <div class="space-y-6">
      <h2 class="text-2xl font-bold text-gray-800">Salida de Inventario</h2>
      
      <!-- Campos de Fecha y Comentarios (volvemos al input de fecha normal) -->
      <div class="grid md:grid-cols-2 grid-cols-1 gap-6 mb-6">
        <div><label class="block text-sm font-medium text-gray-700">Fecha del Pedido</label><input type="date" v-model="fechaPedido" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border"></div>
        <div><label class="block text-sm font-medium text-gray-700">Fecha de Entrega Deseada</label><input type="date" v-model="fechaEntrega" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border"></div>
        <div class="md:col-span-2"><label class="block text-sm font-medium text-gray-700">Comentarios</label><textarea rows="3" v-model="comentarios" placeholder="Añade notas o instrucciones especiales aquí..." class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border"></textarea></div>
      </div>
      
      <!-- Sección de Artículos del Pedido (Sin cambios) -->
      <div class="space-y-4 mb-6">
        <h3 class="text-lg font-semibold text-gray-800">Artículos del Pedido</h3>
        <datalist id="products"><option v-for="name in productNames" :key="name" :value="name"></option></datalist>
        <div v-for="(item, index) in items" :key="item.id" class="item-entry grid md:grid-cols-5 grid-cols-2 gap-4 items-center p-4 bg-gray-50 rounded-lg border">
          <div class="flex flex-col items-center">
            <label class="block text-xs font-medium text-gray-500 mb-1">Imagen</label>
            <div @click="showLargeImage(item.url_imagen)" class="w-16 h-16 rounded-md flex items-center justify-center shadow-sm" :class="{ 'cursor-pointer hover:opacity-80 transition-opacity': item.url_imagen, 'bg-gray-200': !item.url_imagen }">
              <img v-if="item.url_imagen" :src="item.url_imagen" class="w-full h-full object-cover rounded-md">
            </div>
          </div>
          <div class="md:col-span-1 col-span-1"><label class="block text-xs font-medium text-gray-500">Descripción</label><input type="text" list="products" v-model="item.desc" @input="updateSku(item)" placeholder="Escribe para buscar..." class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border"></div>
          <div><label class="block text-xs font-medium text-gray-500">SKU</label><input type="text" v-model="item.sku" readonly placeholder="Código" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-100"></div>
          <div><label class="block text-xs font-medium text-gray-500">Cantidad</label><input type="number" v-model.number="item.cantidad" min="1" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border"></div>
          <div class="flex justify-self-center md:justify-self-end"><button @click="removeItem(index)" class="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600">Eliminar</button></div>
        </div>
      </div>
      
      <!-- Botones de Acción (Sin cambios) -->
      <div class="flex justify-between items-center mb-6"><button @click="addItem" class="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-md hover:bg-indigo-200">+ Añadir Artículo</button></div>
      <div class="text-center space-y-4 md:space-y-0 md:space-x-4 md:flex md:justify-center">
        <button @click="submitOrder" :disabled="isSending" class="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white font-semibold rounded-full shadow-lg hover:bg-indigo-700 disabled:bg-indigo-400">
          <span v-if="isSending">Enviando...</span>
          <span v-else>Enviar Pedido</span>
        </button>
        <button @click="sendNoOrderNotification" :disabled="isSending" class="w-full md:w-auto px-8 py-3 bg-gray-500 text-white font-semibold rounded-full shadow-lg hover:bg-gray-600 disabled:bg-gray-400">
          <span v-if="isSending">Enviando...</span>
          <span v-else>Sin Pedido de Traslado</span>
        </button>
      </div>
    </div>

    <!-- Modales (Añadimos el nuevo modal de confirmación) -->
    <ImageModal 
      v-if="isImageModalVisible"
      :image-url="selectedImageUrl"
      @close="isImageModalVisible = false"
    />
    
    <ConfirmWithCalendarModal
      :show="isConfirmModalVisible"
      :initial-date="dateForModal"
      @close="isConfirmModalVisible = false"
      @confirm="handleNotificationConfirm"
    />
  </div>
</template>