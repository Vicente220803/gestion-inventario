<script setup>
import { ref, computed } from 'vue';
import { useInventory } from '../composables/useInventory';

// 1. Obtenemos las funciones y el estado que necesitamos del "cerebro" de la app.
const { productsWithSku, addMovement } = useInventory();

// 2. Definimos el estado LOCAL de este componente (los campos del formulario).
const incomingDate = ref(new Date().toISOString().slice(0, 10)); // Fecha de hoy por defecto
const incomingPallets = ref(1);
const incomingItem = ref('');
const incomingSku = ref('');

// 3. Creamos una propiedad computada para el autocompletado, igual que en NewOrderView.
const productNames = computed(() => Object.keys(productsWithSku.value));

// 4. Métodos del componente.
function updateIncomingSku() {
  // Actualiza el SKU automáticamente cuando el usuario selecciona un producto.
  const product = productsWithSku.value[incomingItem.value];
  incomingSku.value = product ? product.sku : '';
}

function registerIncoming() {
  // Validamos que todos los campos estén completos.
  if (!incomingDate.value || !incomingItem.value || !incomingSku.value || incomingPallets.value <= 0) {
    alert('Por favor, completa todos los campos correctamente.');
    return;
  }

  // Creamos el objeto del movimiento.
  const movementData = {
    fechaPedido: incomingDate.value, // Para entradas, la fecha del pedido es la fecha de entrada
    fechaEntrega: null,
    pallets: Number(incomingPallets.value),
    items: [{ desc: incomingItem.value, sku: incomingSku.value, cantidad: Number(incomingPallets.value) }],
    tipo: 'Entrada',
  };

  // Usamos la función del composable para añadir el movimiento y actualizar el stock.
  addMovement(movementData);

  // Informamos al usuario y reseteamos el formulario para la siguiente entrada.
  alert(`Entrada de ${movementData.pallets} pallets registrada con éxito.`);
  incomingItem.value = '';
  incomingSku.value = '';
  incomingPallets.value = 1;
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold text-gray-800">Registrar Entrada de Material</h2>

    <!-- Datalist para el autocompletado -->
    <datalist id="products-incomings">
      <option v-for="name in productNames" :key="name" :value="name"></option>
    </datalist>

    <div>
      <label for="incomingDate" class="block text-sm font-medium text-gray-700">Fecha de Entrada</label>
      <input type="date" id="incomingDate" v-model="incomingDate" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border">
    </div>
    
    <div>
      <label for="incomingPallets" class="block text-sm font-medium text-gray-700">Cantidad de Pallets que entraron</label>
      <input type="number" id="incomingPallets" v-model="incomingPallets" min="1" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border">
    </div>
    
    <div class="mt-4">
      <label for="incomingItem" class="block text-sm font-medium text-gray-700">Descripción del Artículo</label>
      <input type="text" id="incomingItem" list="products-incomings" v-model="incomingItem" @input="updateIncomingSku" placeholder="Escribe para buscar..." class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border">
    </div>
    
    <div class="mt-4">
      <label for="incomingSku" class="block text-sm font-medium text-gray-700">SKU / Código</label>
      <input type="text" id="incomingSku" v-model="incomingSku" placeholder="Código" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border" readonly>
    </div>
    
    <div class="text-center mt-6">
      <button @click="registerIncoming" class="w-full md:w-auto px-8 py-3 bg-green-600 text-white font-semibold rounded-full shadow-lg hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-500 transition-all duration-300">
        Registrar Entrada
      </button>
    </div>
  </div>
</template>