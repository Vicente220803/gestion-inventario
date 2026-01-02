<script setup>
// --- 1. IMPORTACIONES ---
import { ref, computed, watch } from 'vue';
import { useInventory } from '../composables/useInventory';
import { useToasts } from '../composables/useToasts';
import { supabase } from '../supabase';
import emailjs from '@emailjs/browser';
import ImageModal from '../components/ImageModal.vue';
// Importamos el nuevo modal de confirmación con calendario
import ConfirmWithCalendarModal from '../components/ConfirmWithCalendarModal.vue';

// --- 2. INICIALIZACIÓN DE COMPOSABLES ---
const { productsWithSku, materialStock, addMovement, obtenerLotesProducto, consumirLoteEspecifico } = useInventory();
const { showSuccess, showError, showInfo } = useToasts();
// Ya no usamos el 'useConfirm' simple para esta acción.

// --- 3. ESTADO DEL FORMULARIO ---
// Intentar cargar datos guardados del localStorage
const savedData = localStorage.getItem('newOrderDraft');
const initialData = savedData ? JSON.parse(savedData) : null;

// IMPORTANTE: fechaPedido siempre es HOY (no se guarda en localStorage)
const fechaPedido = ref(new Date().toISOString().slice(0, 10));
const fechaEntrega = ref(initialData?.fechaEntrega || '');
const comentarios = ref(initialData?.comentarios || '');
const items = ref(initialData?.items || [{ id: 0, desc: '', sku: '', cantidad: 1, url_imagen: null }]);
const isSending = ref(false);

// Autoguardar en localStorage cada vez que cambia algo (excepto fechaPedido)
watch([fechaEntrega, comentarios, items], () => {
  const draftData = {
    fechaEntrega: fechaEntrega.value,
    comentarios: comentarios.value,
    items: items.value
  };
  localStorage.setItem('newOrderDraft', JSON.stringify(draftData));
}, { deep: true });

// --- 4. ESTADO DE LOS MODALES ---
const isImageModalVisible = ref(false);
const selectedImageUrl = ref('');
// Nuevas variables para controlar el modal de confirmación con calendario
const isConfirmModalVisible = ref(false);
const dateForModal = ref('');
// Estado para modal de pallets incompletos
const isPalletIncompletoModalVisible = ref(false);
const palletIncompletoData = ref({
  itemIndex: null,
  desc: '',
  sku: '',
  loteIncompleto: null,
  cantidadSolicitada: 0
});

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
    // Si hay más de 1 item, eliminar el item de la lista
    items.value.splice(index, 1);
  } else {
    // Si solo hay 1 item, limpiar/borrar sus campos en lugar de eliminarlo
    items.value[index] = { id: items.value[index].id, desc: '', sku: '', cantidad: 1, url_imagen: null };
  }
}
function updateSku(item) {
  const productData = productsWithSku.value[item.desc];
  if (productData) {
    const existingItem = items.value.find(i => i.sku === productData.sku && i.id !== item.id);
    if (existingItem) {
      showError('Este material ya está en el pedido. No puedes añadir duplicados.');
      item.desc = '';
      item.sku = '';
      item.url_imagen = null;
      return;
    }
    item.sku = productData.sku;
    item.url_imagen = productData.url_imagen;
  } else {
    item.sku = '';
    item.url_imagen = null;
  }
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

  // Verificar si hay pallets incompletos en los items del pedido
  for (let i = 0; i < validItems.length; i++) {
    const item = validItems[i];
    console.log('[DEBUG] Verificando pallets incompletos para:', item.desc, 'SKU:', item.sku);
    const lotes = await obtenerLotesProducto(item.sku);
    console.log('[DEBUG] Lotes encontrados:', lotes);

    // Buscar si hay algún lote incompleto disponible
    const unidadesEstandar = productsWithSku.value[item.desc]?.unidades_por_pallet || 1;
    console.log('[DEBUG] Unidades estándar:', unidadesEstandar);

    const loteIncompleto = lotes.find(lote => {
      const esIncompleto = lote.pallets > 0 && lote.unidades_por_pallet < unidadesEstandar;
      console.log('[DEBUG] Lote ID:', lote.id, 'Pallets:', lote.pallets, 'Uds/pallet:', lote.unidades_por_pallet, 'Es incompleto:', esIncompleto);
      return esIncompleto;
    });

    if (loteIncompleto && item.cantidad >= 1) {
      console.log('[DEBUG] ¡Pallet incompleto detectado! Mostrando modal...');
      // Hay un pallet incompleto y el usuario está pidiendo al menos 1 pallet
      palletIncompletoData.value = {
        itemIndex: i,
        desc: item.desc,
        sku: item.sku,
        loteIncompleto: loteIncompleto,
        cantidadSolicitada: item.cantidad
      };
      isPalletIncompletoModalVisible.value = true;
      return; // Detener el proceso hasta que el usuario decida
    }
  }

  console.log('[DEBUG] No se encontraron pallets incompletos, procesando pedido normalmente');
  // Si no hay pallets incompletos, proceder normalmente
  procesarPedido();
}

async function procesarPedido() {
  const validItems = items.value.filter(item => item.desc && item.cantidad > 0);
  isSending.value = true;
  
  // Ya no necesitamos la URL base aquí, la eliminamos.
  
  let itemsHtml = '<table style="width: 100%; border-collapse: collapse;">';
  
  for (const item of validItems) {
    // =================== INICIO: CAMBIO CLAVE ===================
    // Como item.url_imagen ya es la URL completa, la usamos directamente.
    const imageUrl = item.url_imagen || '';
    // =================== FIN: CAMBIO CLAVE ===================

    itemsHtml += `
      <tr style="border-bottom: 1px solid #dddddd;">
        <td style="padding: 10px; text-align: left;">
          ${imageUrl ? `<img src="${imageUrl}" alt="Imagen del producto" width="70" style="display: block; border-radius: 8px;">` : ''}
        </td>
        <td style="padding: 10px; vertical-align: middle; font-family: Arial, sans-serif; font-size: 14px;">
          ${item.cantidad} x ${item.desc} (SKU: ${item.sku})
        </td>
      </tr>
    `;
  }
  
  itemsHtml += '</table>';

  const totalPallets = validItems.reduce((sum, item) => sum + Number(item.cantidad), 0);
  
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
    showInfo('Nuevo pedido de traslado creado.');
    // Resetear formulario
    fechaPedido.value = new Date().toISOString().slice(0, 10); // Actualizar a HOY
    fechaEntrega.value = '';
    comentarios.value = '';
    items.value = [{ id: 0, desc: '', sku: '', cantidad: 1, url_imagen: null }];
    // Limpiar el borrador guardado
    localStorage.removeItem('newOrderDraft');
  } catch (error) {
    console.error('Error de EmailJS:', error);
    showError('Hubo un error al enviar el correo. El pedido no se ha registrado.');
  } finally {
    isSending.value = false;
  }
}

// --- 6B. LÓGICA PARA PALLETS INCOMPLETOS ---
async function handleUsarPalletIncompleto() {
  // Usuario quiere despachar el pallet incompleto
  const data = palletIncompletoData.value;
  isPalletIncompletoModalVisible.value = false;

  try {
    // Consumir 1 pallet del lote incompleto
    await consumirLoteEspecifico(data.loteIncompleto.id, 1);

    // Actualizar stock general (restar 1 pallet)
    const { error } = await supabase.rpc('actualizar_stock', {
      sku_producto: data.sku,
      cantidad_cambio: -1
    });

    if (error) throw error;

    showSuccess(`Pallet incompleto de ${data.desc} será despachado (${data.loteIncompleto.unidades_por_pallet} unidades)`);

    // Ajustar la cantidad del item (restar 1 porque ya consumimos el pallet incompleto)
    items.value.find(item => item.sku === data.sku).cantidad -= 1;

    // Continuar verificando si hay más pallets incompletos
    await verificarSiguientePalletIncompleto(data.itemIndex);
  } catch (error) {
    console.error('Error al consumir pallet incompleto:', error);
    showError('Error al procesar el pallet incompleto');
  }
}

function handleNousarPalletIncompleto() {
  // Usuario NO quiere usar el pallet incompleto, continuar con pallets normales
  isPalletIncompletoModalVisible.value = false;

  // Continuar verificando si hay más items con pallets incompletos
  const data = palletIncompletoData.value;
  verificarSiguientePalletIncompleto(data.itemIndex + 1);
}

async function verificarSiguientePalletIncompleto(startIndex) {
  const validItems = items.value.filter(item => item.desc && item.cantidad > 0);

  for (let i = startIndex; i < validItems.length; i++) {
    const item = validItems[i];
    const lotes = await obtenerLotesProducto(item.sku);

    const unidadesEstandar = productsWithSku.value[item.desc]?.unidades_por_pallet || 1;
    const loteIncompleto = lotes.find(lote =>
      lote.pallets > 0 && lote.unidades_por_pallet < unidadesEstandar
    );

    if (loteIncompleto && item.cantidad >= 1) {
      palletIncompletoData.value = {
        itemIndex: i,
        desc: item.desc,
        sku: item.sku,
        loteIncompleto: loteIncompleto,
        cantidadSolicitada: item.cantidad
      };
      isPalletIncompletoModalVisible.value = true;
      return;
    }
  }

  // No hay más pallets incompletos, procesar el pedido
  procesarPedido();
}

// --- 7. NUEVA LÓGICA PARA LA NOTIFICACIÓN "SIN PEDIDO" ---
function sendNoOrderNotification() {
  if (!fechaEntrega.value) {
    showError('Por favor, selecciona una "Fecha de Entrega Deseada" antes de notificar.');
    return;
  }
  dateForModal.value = fechaEntrega.value;
  isConfirmModalVisible.value = true;
}
async function handleNotificationConfirm(modifiedDate) {
  console.log('[DEBUG] handleNotificationConfirm called with modifiedDate:', modifiedDate);
  isConfirmModalVisible.value = false;
  isSending.value = true;
  const templateParams = { fecha_entrega: modifiedDate };
  try {
    await emailjs.send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID,
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID_SIN_PEDIDO,
      templateParams,
      import.meta.env.VITE_EMAILJS_PUBLIC_KEY
    );
    console.log('[DEBUG] Email sent successfully, now registering movement...');
    const registrationDate = new Date().toISOString().slice(0, 10);
    console.log('[DEBUG] Registration date:', registrationDate, 'Order date (from form):', fechaPedido.value, 'Delivery date (from modal):', modifiedDate);
    await addMovement({
      fechaPedido: fechaPedido.value,
      fechaEntrega: modifiedDate,
      pallets: 0,
      comentarios: `Notificación de Sin Pedido de Traslado - Registrado el ${registrationDate}`,
      items: [],
      tipo: 'Sin Pedido',
    });
    console.log('[DEBUG] Movement registered successfully with fechaPedido:', fechaPedido.value, 'fechaEntrega:', modifiedDate);
    showInfo('Notificación de sin pedido registrada.');
  } catch (error) {
    console.error('Error de EmailJS o addMovement:', error);
    showError('Hubo un error al enviar la notificación o registrar el movimiento.');
  } finally {
    isSending.value = false;
  }
}
</script>

<template>
  <div>
    <div class="space-y-6">
      <h2 class="text-2xl font-bold text-gray-800">Salida de Inventario</h2>
      
      <div class="grid md:grid-cols-2 grid-cols-1 gap-6 mb-6">
        <div><label class="block text-sm font-medium text-gray-700">Fecha del Pedido</label><input type="date" v-model="fechaPedido" readonly class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-100 border cursor-not-allowed"></div>
        <div><label class="block text-sm font-medium text-gray-700">Fecha de Entrega Deseada</label><input type="date" v-model="fechaEntrega" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border"></div>
        <div class="md:col-span-2"><label class="block text-sm font-medium text-gray-700">Comentarios</label><textarea rows="3" v-model="comentarios" placeholder="Añade notas o instrucciones especiales aquí..." class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border"></textarea></div>
      </div>
      
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

    <!-- Modal de Confirmación para Pallet Incompleto -->
    <div v-if="isPalletIncompletoModalVisible" class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <div class="flex items-center gap-3 mb-4">
          <span class="text-4xl">⚠️</span>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">Pallet Incompleto Disponible</h3>
        </div>

        <div class="p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-md mb-4">
          <p class="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
            <strong>Material:</strong> {{ palletIncompletoData.desc }}
          </p>
          <p class="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
            Hay un pallet incompleto con <strong>{{ palletIncompletoData.loteIncompleto?.unidades_por_pallet }} unidades</strong>
            (en lugar de {{ productsWithSku[palletIncompletoData.desc]?.unidades_por_pallet }} unidades estándar).
          </p>
          <p class="text-sm text-yellow-800 dark:text-yellow-200 font-semibold">
            ¿Quieres despachar este pallet incompleto primero?
          </p>
        </div>

        <div class="space-y-3 mb-6">
          <div class="p-3 bg-green-50 dark:bg-green-900 rounded-md border border-green-200 dark:border-green-700">
            <p class="text-sm text-green-800 dark:text-green-200">
              <strong>Si eliges "Sí":</strong> Se despachará el pallet incompleto y desaparecerá el símbolo ⚠️ del inventario.
            </p>
          </div>
          <div class="p-3 bg-blue-50 dark:bg-blue-900 rounded-md border border-blue-200 dark:border-blue-700">
            <p class="text-sm text-blue-800 dark:text-blue-200">
              <strong>Si eliges "No":</strong> Se despachará un pallet completo normal y el incompleto quedará en stock.
            </p>
          </div>
        </div>

        <div class="flex justify-end space-x-3">
          <button
            @click="handleNousarPalletIncompleto"
            class="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
          >
            No, usar pallet completo
          </button>
          <button
            @click="handleUsarPalletIncompleto"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Sí, despachar incompleto
          </button>
        </div>
      </div>
    </div>
  </div>
</template>