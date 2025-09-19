<script setup>
import { ref, computed, watch } from 'vue';
import { useInventory } from '@/composables/useInventory';
import { useConfirm } from '@/composables/useConfirm';
import { useAuth } from '@/composables/useAuth';

const { 
  materialStock, 
  productsWithSku, 
  recordManualInventoryCount 
} = useInventory();
const { showConfirm } = useConfirm();
const { profile } = useAuth();

// --- LÓGICA PARA EL MODAL ---
const isModalVisible = ref(false);
const editedStock = ref({});
const adjustmentReason = ref('');

// Mapeo SKU -> Descripción para la UI
const skuToDesc = computed(() => {
  const map = {};
  if (productsWithSku.value) {
    for (const desc in productsWithSku.value) {
      const sku = productsWithSku.value[desc].sku;
      map[sku] = desc;
    }
  }
  return map;
});

// Función para abrir el modal de ajuste
function openAdjustmentModal() {
  // Al abrir, copiamos el stock actual al estado de edición
  const currentStockValues = {};
  for (const sku in materialStock.value) {
    currentStockValues[sku] = Number(materialStock.value[sku] || 0);
  }
  editedStock.value = currentStockValues;
  adjustmentReason.value = ''; // Limpiamos el motivo
  isModalVisible.value = true;
}

// Función para guardar los cambios desde el modal
function handleSaveStock() {
  if (!adjustmentReason.value.trim()) {
    alert('El motivo del ajuste es obligatorio.');
    return;
  }

  showConfirm(
    'Confirmar Ajuste de Inventario',
    '¿Estás seguro de que quieres guardar este recuento? La acción se registrará en el historial y no se puede deshacer.',
    () => {
      recordManualInventoryCount(editedStock.value, adjustmentReason.value);
      isModalVisible.value = false;
    }
  );
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold text-gray-800">Stock Actual por Material</h2>
      <!-- BOTÓN PARA ABRIR EL MODAL (SOLO PARA ADMIN) -->
      <button 
        v-if="profile && profile.role === 'admin'"
        @click="openAdjustmentModal" 
        class="bg-orange-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-700"
      >
        Registrar Ajuste de Inventario
      </button>
    </div>

    <!-- TABLA DE STOCK DE SOLO LECTURA -->
    <div class="overflow-x-auto">
      <table class="min-w-full bg-white border">
        <thead class="bg-gray-100">
          <tr>
            <th class="text-left py-3 px-4 font-semibold text-sm">Material</th>
            <th class="text-left py-3 px-4 font-semibold text-sm">SKU</th>
            <th class="text-left py-3 px-4 font-semibold text-sm">Stock</th>
          </tr>
        </thead>
        <tbody>
          <!-- Usamos un computed para asegurarnos de que los datos existen antes de iterar -->
          <tr v-for="(desc, sku) in skuToDesc" :key="sku" class="border-t">
            <td class="py-3 px-4">{{ desc }}</td>
            <td class="py-3 px-4 text-gray-600">{{ sku }}</td>
            <!-- La cantidad es ahora un texto simple, no un campo de entrada -->
            <td class="py-3 px-4 font-medium">{{ materialStock[sku] || 0 }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL PARA REGISTRAR AJUSTE -->
    <div v-if="isModalVisible" class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h3 class="text-xl font-bold mb-4">Registrar Ajuste de Inventario</h3>
        <div class="p-3 bg-yellow-50 border border-yellow-200 text-sm text-yellow-800 rounded-md mb-4">
          <strong>Atención:</strong> Introduce el stock **"real"** que has contado. El sistema creará un movimiento de ajuste para corregir la diferencia. Esta acción quedará registrada en el historial.
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Motivo del Ajuste (Obligatorio)</label>
            <input type="text" v-model="adjustmentReason" class="mt-1 block w-full p-2 border rounded-md">
          </div>
          <h4 class="font-semibold">Cantidades Reales Contadas:</h4>
          <div class="space-y-2 max-h-60 overflow-y-auto pr-2">
            <div v-for="(desc, sku) in skuToDesc" :key="sku" class="grid grid-cols-2 items-center gap-4">
              <label :for="sku" class="text-sm">{{ desc }}</label>
              <input :id="sku" type="number" v-model.number="editedStock[sku]" class="p-2 border rounded-md">
            </div>
          </div>
        </div>
        <div class="mt-6 flex justify-end space-x-4">
          <button @click="isModalVisible = false" class="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Cancelar</button>
          <button @click="handleSaveStock" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">Guardar Cambios</button>
        </div>
      </div>
    </div>
  </div>
</template>