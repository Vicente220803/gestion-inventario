<script setup>
import { ref, watch, computed } from 'vue';
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

const editedStock = ref({});
const skuToDesc = ref({});

// --- WATCH CORREGIDO Y MÁS ROBUSTO ---
watch([materialStock, productsWithSku], ([newStock, newProducts]) => {
  // Solo ejecutamos la lógica si AMBOS objetos de datos tienen contenido.
  if (Object.keys(newStock).length > 0 && Object.keys(newProducts).length > 0) {
    const stockData = {};
    const descMap = {};

    for (const desc in newProducts) {
      // Nos aseguramos de que el producto exista antes de intentar acceder a él
      if (newProducts[desc] && newProducts[desc].sku) {
        const sku = newProducts[desc].sku;
        descMap[sku] = desc;
        stockData[sku] = Number(newStock[sku] || 0);
      }
    }
    
    skuToDesc.value = descMap;
    editedStock.value = stockData;
  }
}, { immediate: true, deep: true });


function handleSaveStock() {
  showConfirm(
    'Confirmar Cambios de Stock',
    '¿Estás seguro de que quieres guardar estos cambios? Esta acción se registrará en el historial.',
    () => {
      recordManualInventoryCount(editedStock.value, 'Ajuste manual desde la tabla de stock.');
    }
  );
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold text-gray-800">Stock Actual por Material</h2>

    <!-- TU TABLA DE STOCK EDITABLE (RESTAURADA) -->
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
          <tr v-for="(desc, sku) in skuToDesc" :key="sku" class="border-t">
            <td class="py-3 px-4">{{ desc }}</td>
            <td class="py-3 px-4 text-gray-600">{{ sku }}</td>
            <td class="py-3 px-4">
              <!-- Hacemos el campo de stock editable si es admin -->
              <input 
                v-if="profile && profile.role === 'admin'"
                type="number"
                v-model.number="editedStock[sku]"
                class="p-1 border rounded-md w-24"
              />
              <!-- El operario solo ve el número, no puede editar -->
              <span v-else>{{ materialStock[sku] || 0 }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- BOTÓN DE GUARDAR (SOLO PARA ADMIN) -->
    <!-- 3. ¡LA LÓGICA DE PERMISOS AÑADIDA A TU BOTÓN! -->
    <div v-if="profile && profile.role === 'admin'" class="text-right">
      <button @click="handleSaveStock" class="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700">
        Guardar Cambios
      </button>
    </div>
  </div>
</template>