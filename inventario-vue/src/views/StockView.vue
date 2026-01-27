<script setup>
import { ref, computed, onMounted } from 'vue';
import { useInventory } from '../composables/useInventory';
import { useConfirm } from '../composables/useConfirm';
import { profile } from '../authState'; // <-- CORRECCIÓN: Importamos desde authState
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/vue/24/outline';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ImageModal from '../components/ImageModal.vue';

const {
  materialStock,
  productsWithSku,
  stockConUnidades,
  recordManualInventoryCount,
  loadFromServer,
  updateCounter,
  updateUnidadesPorPallet,
  ajustarUnidadesReales
} = useInventory();
const { showConfirm } = useConfirm();
// const { profile } = useAuth(); // <-- LÍNEA ELIMINADA

const isModalVisible = ref(false);
const editedStock = ref({});
const adjustmentReason = ref('');
const searchQuery = ref('');
const stockFilter = ref('all'); // all, low, out

// Estado para el modal de imagen
const isImageModalVisible = ref(false);
const selectedImageUrl = ref('');

// Estado para edición de unidades por pallet
const editingUnidades = ref({});
const editingProduct = ref(null);

// Estado para modal de ajuste de pallets incompletos
const isAjusteModalVisible = ref(false);
const ajusteData = ref({
  sku: '',
  desc: '',
  stockTotal: 0,
  unidadesEstandar: 1,
  palletsCompletos: 0,
  palletsIncompletos: 0,
  unidadesPalletsIncompletos: 0,
  motivo: 'Ajuste de inventario inicial: registro de pallets incompletos'
});

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
  return Object.entries(skuToDesc.value).map(([sku, desc]) => {
    const stockInfo = stockConUnidades.value[sku] || {};
    const unidadesPorPallet = Number(productsWithSku.value[desc]?.unidades_por_pallet) || 1;
    const pallets = Number(materialStock.value[sku]) || 0;

    const unidadesTotales = stockInfo.tiene_discrepancias ? Number(stockInfo.unidades_totales) : (pallets * unidadesPorPallet);
    const precioUnitario = Number(productsWithSku.value[desc]?.precio_unitario) || 0;

    return {
      sku,
      desc,
      stock: pallets,
      unidades_por_pallet: unidadesPorPallet,
      unidades_totales: unidadesTotales,
      tiene_discrepancias: stockInfo.tiene_discrepancias || false,
      image: productsWithSku.value[desc]?.url_imagen,
      precio_unitario: precioUnitario,
      valor_total: unidadesTotales * precioUnitario
    };
  });
});

const filteredItems = computed(() => {
  let items = allItems.value;

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
  // Depend on updateCounter to force re-evaluation
  updateCounter.value;
  const sum = Object.values(materialStock.value).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
  console.log('[DEBUG] totalPallets calculated:', sum, 'materialStock:', materialStock.value);
  return sum;
});

const totalUnidades = computed(() => {
  updateCounter.value;
  return allItems.value.reduce((sum, item) => sum + (Number(item.unidades_totales) || 0), 0);
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

function handleSaveStock() {
  if (!adjustmentReason.value.trim()) {
    alert('El motivo del ajuste es obligatorio.');
    return;
  }

  showConfirm(
    'Confirmar Ajuste de Inventario',
    '¿Estás seguro de que quieres guardar este recuento? La acción se registrará en el historial y no se puede deshacer.',
    async () => {
      await recordManualInventoryCount(editedStock.value, adjustmentReason.value);
      await loadFromServer();
      isModalVisible.value = false;
    }
  );
}

function showLargeImage(url) {
  if (url) {
    selectedImageUrl.value = url;
    isImageModalVisible.value = true;
  }
}

function startEditingUnidades(sku, currentUnidades) {
  editingProduct.value = sku;
  editingUnidades.value[sku] = currentUnidades;
}

function cancelEditingUnidades() {
  editingProduct.value = null;
  editingUnidades.value = {};
}

async function saveUnidades(sku) {
  const newUnidades = editingUnidades.value[sku];
  if (!newUnidades || newUnidades <= 0) {
    alert('Las unidades por pallet deben ser mayor que 0');
    return;
  }

  await updateUnidadesPorPallet(sku, newUnidades);
  editingProduct.value = null;
  editingUnidades.value = {};
}

function abrirModalAjuste(item) {
  ajusteData.value = {
    sku: item.sku,
    desc: item.desc,
    stockTotal: item.stock,
    unidadesEstandar: item.unidades_por_pallet,
    palletsCompletos: item.stock,
    palletsIncompletos: 0,
    unidadesPalletsIncompletos: 0,
    motivo: 'Ajuste de inventario inicial: registro de pallets incompletos'
  };
  isAjusteModalVisible.value = true;
}

function cerrarModalAjuste() {
  isAjusteModalVisible.value = false;
}

const totalPalletsAjuste = computed(() => {
  return ajusteData.value.palletsCompletos + ajusteData.value.palletsIncompletos;
});

const unidadesTotalesCalculadas = computed(() => {
  return (ajusteData.value.palletsCompletos * ajusteData.value.unidadesEstandar) +
         (ajusteData.value.palletsIncompletos * ajusteData.value.unidadesPalletsIncompletos);
});

async function guardarAjusteUnidades() {
  if (totalPalletsAjuste.value !== ajusteData.value.stockTotal) {
    alert(`El total de pallets (${totalPalletsAjuste.value}) debe ser igual al stock actual (${ajusteData.value.stockTotal})`);
    return;
  }

  if (ajusteData.value.palletsIncompletos > 0 && ajusteData.value.unidadesPalletsIncompletos <= 0) {
    alert('Debes especificar las unidades reales de los pallets incompletos');
    return;
  }

  if (ajusteData.value.palletsIncompletos > 0 && ajusteData.value.unidadesPalletsIncompletos >= ajusteData.value.unidadesEstandar) {
    alert('Los pallets incompletos deben tener menos unidades que el estándar');
    return;
  }

  await ajustarUnidadesReales(
    ajusteData.value.sku,
    ajusteData.value.palletsCompletos,
    ajusteData.value.palletsIncompletos,
    ajusteData.value.unidadesPalletsIncompletos,
    ajusteData.value.motivo
  );

  isAjusteModalVisible.value = false;
}

function generatePDF() {
  const doc = new jsPDF('l');
  const valorTotalInventario = allItems.value.reduce((sum, item) => sum + (item.valor_total || 0), 0);

  doc.setFontSize(18);
  doc.text('Inventario de Stock', 20, 20);
  doc.setFontSize(12);
  doc.text(`Fecha y hora de generación: ${new Date().toLocaleString('es-ES')}`, 20, 30);
  doc.text(`Total Pallets Disponibles: ${totalPallets.value}  |  Valor Total Inventario: ${valorTotalInventario.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, 20, 40);

  const formatNumber = (num) => Number(num).toLocaleString('es-ES');
  const formatCurrency = (num) => Number(num).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const tableData = allItems.value.map(item => [
    item.sku,
    item.desc,
    formatNumber(item.stock),
    formatNumber(item.unidades_totales),
    item.precio_unitario > 0 ? formatCurrency(item.precio_unitario) : '-',
    item.valor_total > 0 ? formatCurrency(item.valor_total) : '-',
    '',
    '[   ]',
    item.tiene_discrepancias ? 'INCOMPLETO' : ''
  ]);

  autoTable(doc, {
    head: [['SKU', 'Descripción', 'Stock', 'Unidades', 'Precio Unit.', 'Total (€)', 'Stock Real', 'Verif.', 'Obs.']],
    body: tableData,
    startY: 50,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });

  // Agregar campo de observaciones
  const yPos = doc.lastAutoTable.finalY + 10;
  const title = 'Observaciones/Incidencias:';
  doc.setFontSize(12);
  const titleWidth = doc.getTextWidth(title);
  doc.setFillColor(41, 128, 185); // Azul de fondo
  doc.rect(20, yPos - 5, titleWidth + 4, 10, 'F'); // Rectángulo ajustado al texto
  doc.setTextColor(255, 255, 255); // Blanco
  doc.text(title, 20, yPos);
  doc.setTextColor(0, 0, 0); // Reset to black
  doc.rect(20, yPos + 5, 250, 30); // Rectángulo para escribir

  doc.save('inventario.pdf');
}
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
      <div class="flex gap-6 mt-2">
        <div>
          <p class="text-sm text-blue-700 dark:text-blue-300">Total Pallets</p>
          <p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{{ totalPallets }}</p>
        </div>
        <div>
          <p class="text-sm text-blue-700 dark:text-blue-300">Total Unidades</p>
          <p class="text-2xl font-bold text-blue-900 dark:text-blue-100">{{ totalUnidades.toLocaleString() }}</p>
        </div>
      </div>
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
                Pallets
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Uds/Pallet
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Total Unidades
              </th>
              <th v-if="profile?.role === 'admin'" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="item in filteredItems" :key="item.sku" class="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-600 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity" @click="showLargeImage(item.image)">
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
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                <!-- Modo visualización normal -->
                <div v-if="editingProduct !== item.sku" class="flex items-center gap-2">
                  <span :class="{ 'text-orange-600 dark:text-orange-400': item.tiene_discrepancias }">
                    {{ item.unidades_por_pallet }}
                    <span v-if="item.tiene_discrepancias" class="ml-1" title="Hay pallets con diferentes unidades">⚠️</span>
                  </span>
                  <button
                    v-if="profile?.role === 'admin'"
                    @click="startEditingUnidades(item.sku, item.unidades_por_pallet)"
                    class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    title="Editar unidades por pallet"
                  >
                    ✏️
                  </button>
                </div>
                <!-- Modo edición -->
                <div v-else class="flex items-center gap-1">
                  <input
                    type="number"
                    v-model.number="editingUnidades[item.sku]"
                    min="1"
                    class="w-20 px-2 py-1 text-xs border rounded focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                    @keyup.enter="saveUnidades(item.sku)"
                    @keyup.esc="cancelEditingUnidades()"
                  />
                  <button
                    @click="saveUnidades(item.sku)"
                    class="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    title="Guardar"
                  >
                    ✓
                  </button>
                  <button
                    @click="cancelEditingUnidades()"
                    class="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                    title="Cancelar"
                  >
                    ✕
                  </button>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-semibold">
                {{ item.unidades_totales.toLocaleString() }}
              </td>
              <td v-if="profile?.role === 'admin'" class="px-6 py-4 whitespace-nowrap text-sm">
                <button
                  v-if="item.stock > 0"
                  @click="abrirModalAjuste(item)"
                  class="px-3 py-1 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors"
                  title="Registrar pallets incompletos"
                >
                  📦 Ajustar Unidades
                </button>
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

    <!-- Modal de Ajuste de Pallets Incompletos -->
    <div v-if="isAjusteModalVisible" class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">📦 Ajustar Unidades Reales - Pallets Incompletos</h3>

        <div class="p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-md mb-4">
          <p class="text-sm text-blue-800 dark:text-blue-200 font-semibold mb-2">Material: {{ ajusteData.desc }}</p>
          <p class="text-sm text-blue-700 dark:text-blue-300">SKU: {{ ajusteData.sku }}</p>
          <p class="text-sm text-blue-700 dark:text-blue-300">Stock actual: {{ ajusteData.stockTotal }} pallets</p>
          <p class="text-sm text-blue-700 dark:text-blue-300">Unidades estándar: {{ ajusteData.unidadesEstandar }} uds/pallet</p>
        </div>

        <div class="p-3 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 text-sm text-yellow-800 dark:text-yellow-200 rounded-md mb-4">
          <strong>📝 Instrucciones:</strong> Separa tus pallets entre completos e incompletos. El total debe coincidir con tu stock actual.
        </div>

        <div class="space-y-4">
          <!-- Pallets Completos -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pallets Completos ({{ ajusteData.unidadesEstandar }} uds/pallet)
            </label>
            <input
              type="number"
              v-model.number="ajusteData.palletsCompletos"
              min="0"
              :max="ajusteData.stockTotal"
              class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              @input="ajusteData.palletsIncompletos = ajusteData.stockTotal - ajusteData.palletsCompletos"
            />
          </div>

          <!-- Pallets Incompletos -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pallets Incompletos
            </label>
            <input
              type="number"
              v-model.number="ajusteData.palletsIncompletos"
              min="0"
              :max="ajusteData.stockTotal"
              class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              @input="ajusteData.palletsCompletos = ajusteData.stockTotal - ajusteData.palletsIncompletos"
            />
          </div>

          <!-- Unidades en Pallets Incompletos -->
          <div v-if="ajusteData.palletsIncompletos > 0">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ¿Cuántas unidades REALES tiene cada pallet incompleto?
            </label>
            <input
              type="number"
              v-model.number="ajusteData.unidadesPalletsIncompletos"
              min="1"
              :max="ajusteData.unidadesEstandar - 1"
              class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Debe ser menor que {{ ajusteData.unidadesEstandar }} (estándar)</p>
          </div>

          <!-- Resumen -->
          <div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
            <p class="text-sm font-semibold text-gray-900 dark:text-white mb-2">📊 Resumen:</p>
            <div class="space-y-1 text-sm text-gray-700 dark:text-gray-300">
              <p>Total pallets: <span :class="{ 'text-red-600 dark:text-red-400 font-bold': totalPalletsAjuste !== ajusteData.stockTotal }">{{ totalPalletsAjuste }}</span> / {{ ajusteData.stockTotal }}</p>
              <p v-if="ajusteData.palletsCompletos > 0">
                Pallets completos: {{ ajusteData.palletsCompletos }} × {{ ajusteData.unidadesEstandar }} = {{ ajusteData.palletsCompletos * ajusteData.unidadesEstandar }} uds
              </p>
              <p v-if="ajusteData.palletsIncompletos > 0">
                Pallets incompletos: {{ ajusteData.palletsIncompletos }} × {{ ajusteData.unidadesPalletsIncompletos }} = {{ ajusteData.palletsIncompletos * ajusteData.unidadesPalletsIncompletos }} uds
              </p>
              <p class="font-semibold text-lg mt-2 pt-2 border-t border-gray-300 dark:border-gray-500">
                Total unidades: {{ unidadesTotalesCalculadas.toLocaleString() }}
              </p>
            </div>
          </div>

          <!-- Motivo -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Motivo del Ajuste
            </label>
            <textarea
              v-model="ajusteData.motivo"
              rows="2"
              class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            ></textarea>
          </div>
        </div>

        <div class="mt-6 flex justify-end space-x-4">
          <button
            @click="cerrarModalAjuste"
            class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
          >
            Cancelar
          </button>
          <button
            @click="guardarAjusteUnidades"
            :disabled="totalPalletsAjuste !== ajusteData.stockTotal"
            :class="[
              'px-4 py-2 rounded-lg transition-colors',
              totalPalletsAjuste === ajusteData.stockTotal
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            ]"
          >
            Guardar Ajuste
          </button>
        </div>
      </div>
    </div>

    <!-- Image Modal -->
    <ImageModal
      v-if="isImageModalVisible"
      :image-url="selectedImageUrl"
      @close="isImageModalVisible = false"
    />
  </div>
</template>