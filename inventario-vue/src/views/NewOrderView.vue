<!-- RUTA: src/views/NewOrderView.vue (VERSIÓN FINAL COMPLETA) -->
<script setup>
import { ref, computed } from 'vue';
import { useInventory } from '../composables/useInventory';
import { useToasts } from '../composables/useToasts';
import { useConfirm } from '../composables/useConfirm'; // Importamos el modal de confirmación
import emailjs from '@emailjs/browser';

const { productsWithSku, materialStock, addMovement } = useInventory();
const { showSuccess, showError } = useToasts();
const { show: showConfirm } = useConfirm(); // Preparamos la función del modal

const fechaPedido = ref(new Date().toISOString().slice(0, 10));
const fechaEntrega = ref('');
const comentarios = ref('');
const items = ref([{ id: 0, desc: '', sku: '', cantidad: 1 }]);
const isSending = ref(false);

const productNames = computed(() => Object.keys(productsWithSku.value));

function addItem() {
  const newId = items.value.length > 0 ? Math.max(...items.value.map(i => i.id)) + 1 : 0;
  items.value.push({ id: newId, desc: '', sku: '', cantidad: 1 });
}
function removeItem(index) {
  if (items.value.length > 1) {
    items.value.splice(index, 1);
  } else {
    showError('No puedes eliminar el último artículo.');
  }
}
function updateSku(item) {
  item.sku = productsWithSku.value[item.desc]?.sku || '';
}

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
      'service_est8vb5', 
      'template_akvry63', // <-- RECUERDA RELLENAR ESTAS CLAVES
      templateParams, 
      'CfY2CEwXzbg4TVoFn'
    );
    
    await addMovement({
      fechaPedido: fechaPedido.value,
      fechaEntrega: fechaEntrega.value,
      pallets: totalPallets,
      comentarios: comentarios.value,
      items: JSON.parse(JSON.stringify(validItems)),
      tipo: 'Salida',
    });

    showSuccess('¡Pedido registrado y correo enviado con éxito!');
    fechaEntrega.value = '';
    comentarios.value = '';
    items.value = [{ id: 0, desc: '', sku: '', cantidad: 1 }];
  } catch (error) {
    console.error('Error de EmailJS:', error);
    showError('Hubo un error al enviar el correo. El pedido no se ha registrado.');
  } finally {
    isSending.value = false;
  }
}

// FUNCIÓN "SIN PEDIDO" ACTUALIZADA CON EL MODAL
async function sendNoOrderNotification() {
  const confirmed = await showConfirm(
    'Confirmar Notificación', // Título del modal
    `¿Estás seguro de que quieres notificar que no hay pedido de traslado para el día de hoy (${fechaPedido.value})?` // Mensaje
  );
  
  if (confirmed) {
    isSending.value = true;
    const templateParams = {
      fecha_actual: fechaPedido.value,
    };
    try {
      await emailjs.send(
        'service_est8vb5', 
        'template_z1qinpb', // <-- RECUERDA RELLENAR ESTAS CLAVES
        templateParams, 
        'CfY2CEwXzbg4TVoFn'
      );
      showSuccess(`Notificación de "Sin Pedido" enviada con éxito.`);
    } catch (error) {
      console.error('Error de EmailJS:', error);
      showError('Hubo un error al enviar la notificación.');
    } finally {
      isSending.value = false;
    }
  }
}
</script>

<template>
  <div class="space-y-6">
      <h2 class="text-2xl font-bold text-gray-800">Salida de Inventario</h2>
      
      <!-- Formulario -->
      <div class="grid md:grid-cols-2 grid-cols-1 gap-6 mb-6">
        <div><label class="block text-sm font-medium text-gray-700">Fecha del Pedido</label><input type="date" v-model="fechaPedido" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border"></div>
        <div><label class="block text-sm font-medium text-gray-700">Fecha de Entrega Deseada</label><input type="date" v-model="fechaEntrega" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border"></div>
        <div class="md:col-span-2"><label class="block text-sm font-medium text-gray-700">Comentarios</label><textarea rows="3" v-model="comentarios" placeholder="Añade notas o instrucciones especiales aquí..." class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border"></textarea></div>
      </div>
      
      <!-- Items -->
      <div class="space-y-4 mb-6">
        <h3 class="text-lg font-semibold text-gray-800">Artículos del Pedido</h3>
        <datalist id="products"><option v-for="name in productNames" :key="name" :value="name"></option></datalist>
        <div v-for="(item, index) in items" :key="item.id" class="item-entry grid md:grid-cols-4 grid-cols-1 gap-4 items-center p-4 bg-gray-50 rounded-lg border">
          <div><label class="block text-xs font-medium text-gray-500">Descripción del Artículo</label><input type="text" list="products" v-model="item.desc" @input="updateSku(item)" placeholder="Escribe para buscar..." class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border"></div>
          <div><label class="block text-xs font-medium text-gray-500">SKU / Código</label><input type="text" v-model="item.sku" readonly placeholder="Código" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border"></div>
          <div><label class="block text-xs font-medium text-gray-500">Cantidad</label><input type="number" v-model="item.cantidad" min="1" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border"></div>
          <div class="flex justify-end"><button @click="removeItem(index)" class="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600">Eliminar</button></div>
        </div>
      </div>
      
      <div class="flex justify-between items-center mb-6"><button @click="addItem" class="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-md hover:bg-indigo-200">+ Añadir Artículo</button></div>
      
      <!-- SECCIÓN DE BOTONES DE ACCIÓN -->
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
</template>