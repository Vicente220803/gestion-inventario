<!-- Ruta: src/views/IncomingsView.vue (VERSIÓN FINAL CON NOTIFICACIÓN) -->
<script setup>
import { ref, computed } from 'vue';
import { useInventory } from '../composables/useInventory';
import { useToasts } from '../composables/useToasts';

const { productsWithSku, addMovement } = useInventory();
const { showSuccess, showError } = useToasts();

const incomingDate = ref(new Date().toISOString().slice(0, 10));
const incomingPallets = ref(1);
const incomingItem = ref('');
const incomingSku = ref('');

const productNames = computed(() => Object.keys(productsWithSku.value));

function updateIncomingSku() {
  const product = productsWithSku.value[incomingItem.value];
  incomingSku.value = product ? product.sku : '';
}

async function registerIncoming() {
  if (!incomingDate.value || !incomingItem.value || !incomingSku.value || incomingPallets.value <= 0) {
    return showError('Por favor, completa todos los campos correctamente.');
  }

  const movementData = {
    fechaPedido: incomingDate.value,
    fechaEntrega: null,
    comentarios: null, // Lo enviamos como null para que la BD lo acepte
    pallets: Number(incomingPallets.value),
    items: [{ desc: incomingItem.value, sku: incomingSku.value, cantidad: Number(incomingPallets.value) }],
    tipo: 'Entrada',
  };

  // addMovement ya se encarga de mostrar el error si algo falla
  await addMovement(movementData);

  // =================================================================
  // == AQUÍ AÑADIMOS LA NOTIFICACIÓN DE ÉXITO ==
  // =================================================================
  // (Nota: addMovement ya recarga los datos, pero la notificación de éxito
  // la ponemos aquí para que sea específica de esta acción)
  showSuccess(`Entrada de ${movementData.pallets} pallets registrada con éxito.`);


  // Reseteamos el formulario
  incomingItem.value = '';
  incomingSku.value = '';
  incomingPallets.value = 1;
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold text-gray-800">Registrar Entrada de Material</h2>

    <datalist id="products-incomings">
      <option v-for="name in productNames" :key="name" :value="name"></option>
    </datalist>

    <div>
      <label class="block text-sm font-medium text-gray-700">Fecha de Entrada</label>
      <input type="date" v-model="incomingDate" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border">
    </div>
    
    <div>
      <label class="block text-sm font-medium text-gray-700">Cantidad de Pallets que entraron</label>
      <input type="number" v-model="incomingPallets" min="1" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border">
    </div>
    
    <div class="mt-4">
      <label class="block text-sm font-medium text-gray-700">Descripción del Artículo</label>
      <input type="text" list="products-incomings" v-model="incomingItem" @input="updateIncomingSku" placeholder="Escribe para buscar..." class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border">
    </div>
    
    <div class="mt-4">
      <label class="block text-sm font-medium text-gray-700">SKU / Código</label>
      <input type="text" v-model="incomingSku" placeholder="Código" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border" readonly>
    </div>
    
    <div class="text-center mt-6">
      <button @click="registerIncoming" class="w-full md:w-auto px-8 py-3 bg-green-600 text-white font-semibold rounded-full shadow-lg hover:bg-green-700">
        Registrar Entrada
      </button>
    </div>
  </div>
</template>