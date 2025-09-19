<!-- RUTA: /inventario-vue/src/views/NewOrderView.vue -->

<script setup>
// --- 1. IMPORTACIONES ---
// Importamos todo lo que necesitamos de Vue y de nuestros composables.
import { ref, computed, watch } from 'vue';
import { useInventory } from '../composables/useInventory';
import { useToasts } from '../composables/useToasts';
import { useConfirm } from '../composables/useConfirm';
import emailjs from '@emailjs/browser';
// Importamos el nuevo componente para visualizar la imagen en grande.
import ImageModal from '../components/ImageModal.vue';

// --- 2. INICIALIZACIÓN DE COMPOSABLES ---
// Preparamos las funciones y datos que usaremos de nuestros "ayudantes".
const { productsWithSku, materialStock, addMovement } = useInventory();
const { showSuccess, showError } = useToasts();
const { showConfirm } = useConfirm();

// --- 3. ESTADO DEL FORMULARIO ---
// Estas son las variables que guardan la información que el usuario introduce.
const fechaPedido = ref(new Date().toISOString().slice(0, 10));
const fechaEntrega = ref('');
const comentarios = ref('');
// El array 'items' ahora también guarda la URL de la imagen para cada producto añadido.
const items = ref([{ id: 0, desc: '', sku: '', cantidad: 1, url_imagen: null }]);
const isSending = ref(false); // Para saber si se está enviando un pedido y desactivar botones.

// --- 4. ESTADO DEL MODAL DE IMAGEN ---
// Variables para controlar si el modal de la imagen está visible y qué imagen mostrar.
const isImageModalVisible = ref(false);
const selectedImageUrl = ref('');

// --- 5. DATOS CALCULADOS ---
// Un 'computed' es una variable que se recalcula automáticamente cuando algo cambia.
// Aquí, obtenemos una lista simple con los nombres de los productos para el autocompletado.
const productNames = computed(() => Object.keys(productsWithSku.value));

// --- 6. FUNCIONES ---

// Se ejecuta cuando se hace clic en una miniatura.
function showLargeImage(url) {
  if (url) { // Solo si el producto tiene una imagen...
    selectedImageUrl.value = url; // ...guardamos su URL...
    isImageModalVisible.value = true; // ...y hacemos visible el modal.
  }
}

// Añade una nueva fila vacía al pedido.
function addItem() {
  const newId = items.value.length > 0 ? Math.max(...items.value.map(i => i.id)) + 1 : 0;
  items.value.push({ id: newId, desc: '', sku: '', cantidad: 1, url_imagen: null });
}

// Elimina una fila del pedido.
function removeItem(index) {
  if (items.value.length > 1) {
    items.value.splice(index, 1);
  } else {
    showError('No puedes eliminar el último artículo.');
  }
}

// Se ejecuta cada vez que el usuario escribe el nombre de un producto.
// Rellena automáticamente el SKU y la URL de la imagen.
function updateSku(item) {
  const productData = productsWithSku.value[item.desc];
  item.sku = productData?.sku || '';
  item.url_imagen = productData?.url_imagen || null;
}

// Lógica para calcular la fecha de entrega automáticamente.
watch(fechaPedido, (nuevaFecha) => {
  if (nuevaFecha) {
    const fechaBase = new Date(nuevaFecha + 'T00:00:00Z');
    const diaDeLaSemana = fechaBase.getUTCDay();
    if (diaDeLaSemana === 5) { // Si es viernes, salta 3 días al lunes.
      fechaBase.setUTCDate(fechaBase.getUTCDate() + 3);
    } else { // Si no, salta 1 día.
      fechaBase.setUTCDate(fechaBase.getUTCDate() + 1);
    }
    fechaEntrega.value = fechaBase.toISOString().slice(0, 10);
  }
}, { immediate: true }); // 'immediate: true' hace que se ejecute una vez al cargar la página.

// Función principal para enviar el pedido.
async function submitOrder() {
  // Validaciones
  if (!fechaEntrega.value) { return showError('Falta la fecha de entrega.'); }
  const validItems = items.value.filter(item => item.desc && item.cantidad > 0);
  if (validItems.length === 0) { return showError('Añade al menos un artículo válido.'); }
  for (const item of validItems) {
    if ((materialStock.value[item.sku] || 0) < item.cantidad) {
      return showError(`Stock insuficiente para ${item.desc}.`);
    }
  }

  isSending.value = true;
  
  // Preparación de datos para el email
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
    // Envío del email usando las claves seguras del archivo .env
    await emailjs.send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID, 
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID_PEDIDO,
      templateParams, 
      import.meta.env.VITE_EMAILJS_PUBLIC_KEY
    );
    
    // Guardado del movimiento en la base de datos
    await addMovement({
      fechaPedido: fechaPedido.value,
      fechaEntrega: fechaEntrega.value,
      pallets: totalPallets,
      comentarios: comentarios.value,
      // Quitamos la url_imagen antes de guardar en la BD, porque no es necesaria allí.
      items: JSON.parse(JSON.stringify(validItems.map(({ url_imagen, ...rest }) => rest))),
      tipo: 'Salida',
    });

    showSuccess('¡Pedido registrado y correo enviado con éxito!');
    
    // Limpieza del formulario
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

// Función para notificar que no hay pedido.
function sendNoOrderNotification() {
  // Muestra el modal de confirmación y solo si el usuario acepta, ejecuta el código.
  showConfirm(
    'Confirmar Notificación',
    `¿Estás seguro de que quieres notificar que no hay pedido de traslado para el día de hoy (${fechaPedido.value})?`,
    async () => {
      isSending.value = true;
      const templateParams = { fecha_actual: fechaPedido.value };
      try {
        // Envío del email usando las claves seguras del archivo .env
        await emailjs.send(
          import.meta.env.VITE_EMAILJS_SERVICE_ID, 
          import.meta.env.VITE_EMAILJS_TEMPLATE_ID_SIN_PEDIDO,
          templateParams, 
          import.meta.env.VITE_EMAILJS_PUBLIC_KEY
        );
        showSuccess(`Notificación de "Sin Pedido" enviada con éxito.`);
      } catch (error) {
        console.error('Error de EmailJS:', error);
        showError('Hubo un error al enviar la notificación.');
      } finally {
        isSending.value = false;
      }
    }
  );
}
</script>

<template>
  <div>
    <div class="space-y-6">
      <h2 class="text-2xl font-bold text-gray-800">Salida de Inventario</h2>
      
      <!-- Campos de Fecha y Comentarios -->
      <div class="grid md:grid-cols-2 grid-cols-1 gap-6 mb-6">
        <div><label class="block text-sm font-medium text-gray-700">Fecha del Pedido</label><input type="date" v-model="fechaPedido" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border"></div>
        <div><label class="block text-sm font-medium text-gray-700">Fecha de Entrega Deseada</label><input type="date" v-model="fechaEntrega" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border"></div>
        <div class="md:col-span-2"><label class="block text-sm font-medium text-gray-700">Comentarios</label><textarea rows="3" v-model="comentarios" placeholder="Añade notas o instrucciones especiales aquí..." class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border"></textarea></div>
      </div>
      
      <!-- Sección de Artículos del Pedido -->
      <div class="space-y-4 mb-6">
        <h3 class="text-lg font-semibold text-gray-800">Artículos del Pedido</h3>
        <datalist id="products"><option v-for="name in productNames" :key="name" :value="name"></option></datalist>
        
        <!-- Fila de un artículo (se repite por cada uno) -->
        <div v-for="(item, index) in items" :key="item.id" class="item-entry grid md:grid-cols-5 grid-cols-2 gap-4 items-center p-4 bg-gray-50 rounded-lg border">
          
          <!-- Columna de la Imagen -->
          <div class="flex flex-col items-center">
            <label class="block text-xs font-medium text-gray-500 mb-1">Imagen</label>
            <div 
              @click="showLargeImage(item.url_imagen)" 
              class="w-16 h-16 rounded-md flex items-center justify-center shadow-sm"
              :class="{ 'cursor-pointer hover:opacity-80 transition-opacity': item.url_imagen, 'bg-gray-200': !item.url_imagen }"
            >
              <!-- Si hay imagen, la mostramos. -->
              <img v-if="item.url_imagen" :src="item.url_imagen" class="w-full h-full object-cover rounded-md">
            </div>
          </div>

          <!-- Resto de Columnas -->
          <div class="md:col-span-1 col-span-1"><label class="block text-xs font-medium text-gray-500">Descripción</label><input type="text" list="products" v-model="item.desc" @input="updateSku(item)" placeholder="Escribe para buscar..." class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border"></div>
          <div><label class="block text-xs font-medium text-gray-500">SKU</label><input type="text" v-model="item.sku" readonly placeholder="Código" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-100"></div>
          <div><label class="block text-xs font-medium text-gray-500">Cantidad</label><input type="number" v-model.number="item.cantidad" min="1" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border"></div>
          <div class="flex justify-self-center md:justify-self-end"><button @click="removeItem(index)" class="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600">Eliminar</button></div>
        </div>
      </div>
      
      <!-- Botones de Acción -->
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

    <!-- El Modal de la Imagen. Solo se muestra si 'isImageModalVisible' es true. -->
    <ImageModal 
      v-if="isImageModalVisible"
      :image-url="selectedImageUrl"
      @close="isImageModalVisible = false"
    />
  </div>
</template>