<script setup>
import { ref } from 'vue';
import { useInventory } from '../composables/useInventory'; // Ruta corregida si es necesario
import { useConfirm } from '../composables/useConfirm';
import { useToasts } from '../composables/useToasts';
import { profile } from '../authState'; // <-- CORRECCIÓN: Importamos desde authState
// Importamos el componente para las entradas desde Excel
import EntradasPendientesExcel from '../components/EntradasPendientes.vue'; // Ruta corregida si es necesario

// const { profile } = useAuth(); // <-- LÍNEA ELIMINADA

const {
  productsWithSku,
  addMovement
} = useInventory();
const { showConfirm } = useConfirm();
const { showSuccess } = useToasts();

// --- ESTADO PARA EL FORMULARIO DE ENTRADA MANUAL ---
const manualFechaEntrada = ref(new Date().toISOString().slice(0, 10));
const manualItems = ref([{ sku: '', desc: '', cantidad: null, unidades_por_pallet: null, unidades_estandar: null }]);

// --- LÓGICA PARA EL FORMULARIO MANUAL ---
function addManualRow() {
  manualItems.value.push({ sku: '', desc: '', cantidad: null, unidades_por_pallet: null, unidades_estandar: null });
}

function updateManualSku(item) {
  const selectedProduct = Object.entries(productsWithSku.value).find(([desc, data]) => desc === item.desc);
  if (selectedProduct) {
    item.sku = selectedProduct[1].sku;
    item.unidades_estandar = selectedProduct[1].unidades_por_pallet || 1;
    // Auto-rellenar con el estándar
    if (!item.unidades_por_pallet) {
      item.unidades_por_pallet = item.unidades_estandar;
    }
  }
}

function resetManualForm() {
  manualFechaEntrada.value = new Date().toISOString().slice(0, 10);
  manualItems.value = [{ sku: '', desc: '', cantidad: null, unidades_por_pallet: null, unidades_estandar: null }];
}

async function handleManualSubmit() {
  const validItems = manualItems.value
    .filter(i => i.desc && i.cantidad > 0)
    .map(i => ({...i, cantidad: Number(i.cantidad)}));

  if (validItems.length === 0) {
    alert('Debes añadir al menos un artículo con cantidad mayor que cero.');
    return;
  }

  const totalQuantity = validItems.reduce((sum, item) => sum + item.cantidad, 0);

  const newMovement = {
    fechaPedido: manualFechaEntrada.value,
    fechaEntrega: manualFechaEntrada.value,
    comentarios: 'Entrada manual registrada desde la aplicación.',
    tipo: 'Entrada',
    items: validItems,
    pallets: totalQuantity
  };

  showConfirm(
    'Registrar Entrada Manual',
    '¿Estás seguro de que quieres registrar esta entrada? La acción actualizará el stock inmediatamente.',
    async () => {
      await addMovement(newMovement);
      showSuccess('Entrada manual registrada correctamente.');
      resetManualForm();
    }
  );
}
</script>

<template>
  <div class="space-y-8">

    <!-- SECCIÓN DE ENTRADA MANUAL (se mantiene) -->
    <div>
      <h2 class="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Registrar Nueva Entrada Manual</h2>
      <div class="p-4 bg-gray-50 rounded-lg border space-y-4">
        
        <div>
          <label class="block text-sm font-medium text-gray-700">Fecha de Entrada</label>
          <input type="date" v-model="manualFechaEntrada" class="mt-1 block w-full md:w-1/3 p-2 border rounded-md" />
        </div>
        
        <h3 class="font-semibold text-gray-700">Artículos</h3>
        <datalist id="materials">
          <option v-for="(data, desc) in productsWithSku" :key="desc" :value="desc" />
        </datalist>
        <div v-for="(item, index) in manualItems" :key="index" class="grid grid-cols-1 md:grid-cols-7 gap-2 items-center p-3 bg-white rounded border">
          <input type="text" v-model="item.desc" list="materials" @change="updateManualSku(item)" placeholder="Buscar o seleccionar material" class="md:col-span-2 mt-1 block w-full p-2 border rounded-md" />
          <input type="text" :value="item.sku" readonly placeholder="SKU" class="mt-1 block w-full p-2 border rounded-md bg-gray-100 text-gray-500 text-sm" />
          <input type="number" v-model.number="item.cantidad" placeholder="Pallets" class="mt-1 block w-full p-2 border rounded-md" />
          <div class="relative">
            <input
              type="number"
              v-model.number="item.unidades_por_pallet"
              placeholder="Uds/pallet"
              class="mt-1 block w-full p-2 border rounded-md"
              :class="{ 'border-orange-400 bg-orange-50': item.unidades_por_pallet && item.unidades_estandar && item.unidades_por_pallet !== item.unidades_estandar }"
            />
            <span v-if="item.unidades_estandar" class="text-xs text-gray-500 absolute -bottom-5 left-0">Est: {{ item.unidades_estandar }}</span>
          </div>
          <div class="text-sm text-gray-600 font-semibold">
            <span v-if="item.cantidad && item.unidades_por_pallet">
              = {{ (item.cantidad * item.unidades_por_pallet).toLocaleString() }} uds
            </span>
          </div>
          <button @click="manualItems.splice(index, 1)" v-if="manualItems.length > 1" class="text-red-600 hover:text-red-800 text-sm">Eliminar</button>
        </div>
        <button @click="addManualRow" class="text-sm text-blue-600 hover:underline">+ Añadir otro artículo</button>

        <div class="text-right">
          <button @click="handleManualSubmit" class="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700">
            Registrar Entrada
          </button>
        </div>
      </div>
    </div>
    
    <!-- SECCIÓN DE ENTRADAS DESDE EXCEL (la nueva funcionalidad) -->
    <!-- CORRECCIÓN: El v-if estaba mal. Debe ser profile.role y no profile.value.role -->
    <div v-if="profile?.role !== 'operario'">
      <!-- El componente se encarga de mostrar su propio título y contenido -->
      <EntradasPendientesExcel />
    </div>

  </div>
</template>