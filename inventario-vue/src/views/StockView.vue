<!-- Ruta: src/views/StockView.vue (VERSIÓN ACTUALIZADA) -->
<script setup>
import { ref, computed } from 'vue';
import { useInventory } from '../composables/useInventory';
import AppModal from '../components/AppModal.vue'; // <-- Importamos nuestro nuevo modal

// --- LÓGICA ---
// Importamos las funciones y datos que necesitamos del "cerebro"
const { productsWithSku, materialStock, updateFullStock } = useInventory();

// Variable para controlar si el modal se muestra o no
const isEditModalVisible = ref(false);

// Creamos una COPIA del stock para editarla en el formulario.
// Así, no modificamos el stock real hasta que le damos a "Guardar".
const editableStock = ref({});

const productNames = computed(() => Object.keys(productsWithSku.value));

// --- FUNCIONES ---
function openEditModal() {
  // Antes de abrir el modal, rellenamos nuestra copia 'editableStock'
  // con los valores actuales del stock real.
  editableStock.value = JSON.parse(JSON.stringify(materialStock.value));
  isEditModalVisible.value = true;
}

function saveStockChanges() {
  // Esta es la advertencia que pediste
  if (confirm('¿Estás seguro? Vas a sobrescribir el stock actual. Esta acción no se puede deshacer.')) {
    // Si el usuario acepta, llamamos a la función del "cerebro" para guardar los cambios
    updateFullStock(editableStock.value);
    isEditModalVisible.value = false; // Cerramos el modal
    alert('¡Stock actualizado con éxito!');
  }
}
</script>

<template>
  <div class="text-center">
    <h2 class="text-2xl font-bold text-gray-800 mb-4">Stock Actual por Material</h2>

    <!-- ESTE ES EL NUEVO BOTÓN PARA EDITAR -->
    <div class="mb-4">
      <button @click="openEditModal" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
        Editar Stock Manualmente
      </button>
    </div>

    <!-- La tabla de stock no cambia -->
    <div class="bg-indigo-100 rounded-xl shadow-inner p-4">
      <table v-if="productNames.length > 0" class="w-full text-left border-collapse table-auto">
        <thead>
          <tr class="text-gray-600">
            <th class="py-2 px-4 bg-gray-200 rounded-tl-lg">Material</th>
            <th class="py-2 px-4 bg-gray-200">SKU</th>
            <th class="py-2 px-4 bg-gray-200 rounded-tr-lg text-right">Stock</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(product, desc) in productsWithSku" :key="product.sku" class="border-t border-gray-300">
            <td class="py-2 px-4">{{ desc }}</td>
            <td class="py-2 px-4">{{ product.sku }}</td>
            <td class="py-2 px-4 text-right">{{ materialStock[product.sku] || 0 }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="text-gray-500 p-8">No hay productos definidos.</p>
    </div>
  </div>

  <!-- AQUÍ USAMOS NUESTRO NUEVO MODAL -->
  <!-- Solo se mostrará si isEditModalVisible es true -->
  <AppModal 
    v-if="isEditModalVisible" 
    title="Editar Stock Manualmente"
    @close="isEditModalVisible = false"
    @confirm="saveStockChanges"
  >
    <!-- Este es el contenido que se inyecta en el <slot> del modal -->
    <p class="text-sm text-red-600 bg-red-100 p-3 rounded-md mb-4">
      <strong>¡Ten cuidado!</strong> Estás a punto de sobrescribir el stock actual. Esta acción es irreversible.
    </p>

    <!-- Formulario dinámico dentro del modal -->
    <div class="space-y-4 max-h-96 overflow-y-auto">
      <div v-for="(product, desc) in productsWithSku" :key="product.sku">
        <label :for="product.sku" class="block text-sm font-medium text-gray-700">{{ desc }}</label>
        <input 
          type="number" 
          :id="product.sku" 
          v-model.number="editableStock[product.sku]" 
          min="0"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border"
        >
      </div>
    </div>
  </AppModal>
</template>