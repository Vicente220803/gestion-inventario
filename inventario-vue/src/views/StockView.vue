<!-- Ruta: src/views/StockView.vue (VERSIÓN CON AJUSTE DE INVENTARIO) -->
<script setup>
import { ref, computed } from 'vue';
import { useInventory } from '../composables/useInventory';
import { useToasts } from '../composables/useToasts';
import AppModal from '../components/AppModal.vue';

const { productsWithSku, materialStock, addMovement } = useInventory();
const { showSuccess, showError } = useToasts();

const isAdjustModalVisible = ref(false);
const adjustmentReason = ref('');
// 'editableStock' ahora representa el stock REAL que hemos contado
const realStockCount = ref({});

const productNames = computed(() => Object.keys(productsWithSku.value));

function openAdjustModal() {
  // Rellenamos el formulario con los valores que el sistema CREE que hay
  realStockCount.value = JSON.parse(JSON.stringify(materialStock.value));
  adjustmentReason.value = ''; // Limpiamos el motivo
  isAdjustModalVisible.value = true;
}

async function handleStockAdjustment() {
  if (!adjustmentReason.value) {
    return showError('Debes especificar un motivo para el ajuste.');
  }

  // Calculamos la diferencia para cada producto
  const adjustments = [];
  let totalAdjustmentPallets = 0;

  for (const desc in productsWithSku.value) {
    const sku = productsWithSku.value[desc].sku;
    const systemStock = materialStock.value[sku] || 0;
    const realStock = realStockCount.value[sku] || 0;
    const difference = realStock - systemStock;

    if (difference !== 0) {
      adjustments.push({
        desc: desc,
        sku: sku,
        cantidad: Math.abs(difference) // La cantidad en el item es siempre positiva
      });
      totalAdjustmentPallets += difference; // El total sí puede ser negativo
    }
  }

  if (adjustments.length === 0) {
    isAdjustModalVisible.value = false;
    return showSuccess('No se detectaron diferencias. No se ha registrado ningún ajuste.');
  }

  // Creamos un único movimiento de tipo "Ajuste"
  const movementData = {
    fechaPedido: new Date().toISOString().slice(0, 10), // Fecha del ajuste
    fechaEntrega: new Date().toISOString().slice(0, 10), // Usamos la misma fecha para que el efecto sea inmediato
    comentarios: `Ajuste de inventario: ${adjustmentReason.value}`,
    // El tipo de movimiento será 'Entrada' o 'Salida' según el ajuste total
    tipo: totalAdjustmentPallets > 0 ? 'Entrada' : 'Salida',
    pallets: Math.abs(totalAdjustmentPallets),
    items: adjustments,
    isAdjustment: true, // Propiedad especial para identificarlo
  };

  await addMovement(movementData);
  
  showSuccess('Ajuste de inventario registrado con éxito en el historial.');
  isAdjustModalVisible.value = false;
}
</script>

<template>
  <div class="text-center">
    <h2 class="text-2xl font-bold text-gray-800 mb-4">Stock Actual por Material</h2>
    <div class="mb-4">
      <button @click="openAdjustModal" class="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700">
        Registrar Ajuste de Inventario
      </button>
    </div>
    <!-- ... (La tabla de stock no cambia) ... -->
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

  <!-- NUEVO MODAL DE AJUSTE -->
  <AppModal 
    v-if="isAdjustModalVisible" 
    title="Registrar Ajuste de Inventario"
    @close="isAdjustModalVisible = false"
    @confirm="handleStockAdjustment"
  >
    <p class="text-sm text-orange-600 bg-orange-100 p-3 rounded-md mb-4">
      <strong>Atención:</strong> Introduce el stock **real** que has contado. El sistema creará un movimiento de ajuste para corregir la diferencia. Esta acción quedará registrada en el historial.
    </p>
    <div class="space-y-2">
      <div>
        <label class="block text-sm font-medium text-gray-700">Motivo del Ajuste (Obligatorio)</label>
        <input type="text" v-model="adjustmentReason" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border">
      </div>
      <div class="space-y-4 max-h-80 overflow-y-auto mt-4 border-t pt-4">
        <h4 class="font-semibold">Cantidades Reales Contadas:</h4>
        <div v-for="(product, desc) in productsWithSku" :key="product.sku">
          <label class="block text-sm font-medium text-gray-700">{{ desc }}</label>
          <input type="number" v-model.number="realStockCount[product.sku]" min="0" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border">
        </div>
      </div>
    </div>
  </AppModal>
</template>