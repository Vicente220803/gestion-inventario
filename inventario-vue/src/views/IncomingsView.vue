<script setup>
import { ref } from 'vue';
import { useInventory } from '@/composables/useInventory';
import { useConfirm } from '@/composables/useConfirm';
import { useAuth } from '@/composables/useAuth';
// Importamos el componente para las entradas desde Excel
import EntradasPendientesExcel from '@/components/EntradasPendientes.vue';

const { profile } = useAuth();

// Hemos limpiado esto para quitar la lógica de 'pendingIncomings' que ya no se usa
const { 
  productsWithSku,
  addMovement
} = useInventory();
const { showConfirm } = useConfirm();

// --- ESTADO PARA EL FORMULARIO DE ENTRADA MANUAL ---
const manualFechaEntrada = ref(new Date().toISOString().slice(0, 10));
const manualItems = ref([{ sku: '', desc: '', cantidad: null }]);

// --- LÓGICA PARA EL FORMULARIO MANUAL (sin cambios) ---
function addManualRow() {
  manualItems.value.push({ sku: '', desc: '', cantidad: null });
}

function updateManualSku(item) {
  const selectedProduct = Object.entries(productsWithSku.value).find(([desc, data]) => desc === item.desc);
  if (selectedProduct) {
    item.sku = selectedProduct[1].sku;
  }
}

function resetManualForm() {
  manualFechaEntrada.value = new Date().toISOString().slice(0, 10);
  manualItems.value = [{ sku: '', desc: '', cantidad: null }];
}

function handleManualSubmit() {
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
    () => {
      addMovement(newMovement);
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
        <div v-for="(item, index) in manualItems" :key="index" class="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
          <select v-model="item.desc" @change="updateManualSku(item)" class="md:col-span-3 mt-1 block w-full p-2 border rounded-md">
            <option disabled value="">Selecciona un material</option>
            <option v-for="(data, desc) in productsWithSku" :key="desc">{{ desc }}</option>
          </select>
          <input type="text" :value="item.sku" readonly placeholder="SKU" class="mt-1 block w-full p-2 border rounded-md bg-gray-100 text-gray-500" />
          <input type="number" v-model="item.cantidad" placeholder="Cantidad" class="mt-1 block w-full p-2 border rounded-md" />
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
    <div v-if="profile?.value?.role !== 'operario'">
      <!-- El componente se encarga de mostrar su propio título y contenido -->
      <EntradasPendientesExcel />
    </div>

  </div>
</template>