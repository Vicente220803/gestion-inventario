<!-- RUTA: /inventario-vue/src/views/StockView.vue (CORREGIDO) -->
<script setup>
import { ref, computed, onMounted } from 'vue';
import { useInventory } from '../composables/useInventory';
import { useConfirm } from '../composables/useConfirm';
import { useAuth } from '../composables/useAuth';
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/vue/24/outline';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const {
  materialStock,
  productsWithSku,
  recordManualInventoryCount,
  loadFromServer
} = useInventory();
const { showConfirm } = useConfirm();
const { profile } = useAuth();

const isModalVisible = ref(false);
const editedStock = ref({});
const adjustmentReason = ref('');
const searchQuery = ref('');
const stockFilter = ref('all'); // all, low, out

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

const allItems = computed(() => {
  return Object.entries(skuToDesc.value).map(([sku, desc]) => ({
    sku,
    desc,
    stock: materialStock.value[sku] || 0,
    image: productsWithSku.value[desc]?.url_imagen
  }));
});

const filteredItems = computed(() => {
  console.log('Computing filteredItems, materialStock:', materialStock.value);
  let items = allItems.value;
  console.log('Filtered items:', items);

  // Filter by search
  if (searchQuery.value) {
    items = items.filter(item =>
      item.desc.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }

  // Filter by stock level
  if (stockFilter.value === 'low') {
    items = items.filter(item => item.stock > 0 && item.stock < 10);
  } else if (stockFilter.value === 'out') {
    items = items.filter(item => item.stock === 0);
  }

  return items;
});

const totalPallets = computed(() => {
  return Object.values(materialStock.value).reduce((sum, qty) => sum + (qty || 0), 0);
});

function openAdjustmentModal() {
  const currentStockValues = {};
  if (materialStock.value) {
    for (const sku in materialStock.value) {
      currentStockValues[sku] = Number(materialStock.value[sku] || 0);
    }
  }
  editedStock.value = currentStockValues;
  adjustmentReason.value = '';
  isModalVisible.value = true;
}

// === FUNCIÓN CORREGIDA ===
function handleSaveStock() {
  console.log('handleSaveStock called');
  if (!adjustmentReason.value.trim()) {
    alert('El motivo del ajuste es obligatorio.');
    return;
  }

  showConfirm(
    'Confirmar Ajuste de Inventario',
    '¿Estás seguro de que quieres guardar este recuento? La acción se registrará en el historial y no se puede deshacer.',
    // 1. Convertimos la función de callback a 'async' para poder usar 'await'
    async () => {
      console.log('Confirm callback executed');
      
      // 2. Usamos 'await' para esperar a que la función de guardado TERMINE
      await recordManualInventoryCount(editedStock.value, adjustmentReason.value);
      
      // 3. Una vez terminado el guardado, volvemos a cargar los datos del servidor
      await loadFromServer();

      // 4. Solo cerramos el modal cuando todo ha terminado con éxito
      isModalVisible.value = false;
    }
  );
}

function generatePDF() {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Inventario de Stock', 20, 20);
  doc.setFontSize(12);
  doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`, 20, 30);
  doc.text(`Total Pallets Disponibles: ${totalPallets.value}`, 20, 40);

  const tableData = allItems.value.map(item => [
    item.sku,
    item.desc,
    item.stock
  ]);

  autoTable(doc, {
    head: [['SKU', 'Descripción', 'Cantidad']],
    body: tableData,
    startY: 50,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });

  doc.save('inventario.pdf');
}

onMounted(() => {
  loadFromServer();
});
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Inventario</h1>
      <div class="flex space-x-2">
        <button
          v-if="profile?.role !== 'operario'"
          @click="generatePDF"
          class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Generar PDF
        </button>
        <button
          v-if="profile && profile.role === 'admin'"
          @click="openAdjustmentModal"
          class="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
        >
          Registrar Ajuste
        </button>
      </div>
    </div>

    <!-- Stock Summary -->
    <div class="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg mb-6">
      <h2 class="text-lg font-semibold text-blue-800 dark:text-blue-200">Resumen de Stock</h2>
      <p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{{ totalPallets }} Pallets Disponibles</p>
    </div>

    <!-- Search and Filters -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
      <div class="flex flex-col md:flex-row gap-4">
        <div class="flex-1 relative">
          <MagnifyingGlassIcon class="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por nombre o SKU..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
        </div>
        <div class="flex items-center gap-2">
          <FunnelIcon class="w-5 h-5 text-gray-400" />
          <select
            v-model="stockFilter"
            class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">Todos</option>
            <option value="low">Stock Bajo (<10)</option>
            <option value="out">Sin Stock</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Imagen
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Material
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                SKU
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Stock
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="item in filteredItems" :key="item.sku" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                  <img v-if="item.image" :src="item.image" :alt="item.desc" class="w-full h-full object-cover">
                  <div v-else class="text-gray-400 text-xs">Sin imagen</div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                {{ item.desc }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {{ item.sku }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-semibold">
                {{ item.stock }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Adjustment Modal -->
    <div v-if="isModalVisible" class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Registrar Ajuste de Inventario</h3>
        <div class="p-3 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 text-sm text-yellow-800 dark:text-yellow-200 rounded-md mb-4">
          <strong>Atención:</strong> Introduce el stock **"real"** que has contado. El sistema creará un movimiento de ajuste para corregir la diferencia.
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Motivo del Ajuste (Obligatorio)</label>
            <input
              type="text"
              v-model="adjustmentReason"
              class="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
          </div>
          <h4 class="font-semibold text-gray-900 dark:text-white">Cantidades Reales Contadas:</h4>
          <div class="space-y-2 max-h-60 overflow-y-auto pr-2">
            <div v-for="item in filteredItems" :key="item.sku" class="grid grid-cols-2 items-center gap-4">
              <label :for="item.sku" class="text-sm text-gray-700 dark:text-gray-300">{{ item.desc }}</label>
              <input
                :id="item.sku"
                type="number"
                v-model.number="editedStock[item.sku]"
                class="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
            </div>
          </div>
        </div>
        <div class="mt-6 flex justify-end space-x-4">
          <button
            @click="isModalVisible = false"
            class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
          >
            Cancelar
          </button>
          <button
            @click="handleSaveStock"
            class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  </div>
</template>