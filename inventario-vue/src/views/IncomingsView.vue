<script setup>
import { ref, computed } from 'vue';
import { useInventory } from '@/composables/useInventory';
import { useConfirm } from '@/composables/useConfirm';
import ApprovalModal from '@/components/ApprovalModal.vue';

const { 
  productsWithSku,
  pendingIncomings, 
  approvePendingIncoming,
  addMovement
} = useInventory();
const { showConfirm } = useConfirm();

// --- ESTADO PARA LA SECCIÓN DE REVISIÓN ---
const isModalVisible = ref(false);
const selectedEntry = ref(null);

// --- ESTADO PARA EL FORMULARIO DE ENTRADA MANUAL ---
const manualFechaEntrada = ref(new Date().toISOString().slice(0, 10));
const manualItems = ref([{ sku: '', desc: '', cantidad: null }]);

// --- LÓGICA PARA EL FORMULARIO MANUAL ---
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

// --- LÓGICA PARA LA SECCIÓN DE REVISIÓN ---
function handleApproveClick(entry) {
  selectedEntry.value = entry;
  isModalVisible.value = true;
}

function handleModalClose() {
  isModalVisible.value = false;
  selectedEntry.value = null;
}

function handleFinalApproval(movementDetails) {
  showConfirm(
    'Confirmar Registro de Stock',
    '¿Estás seguro de que quieres registrar esta entrada? La acción actualizará el stock y no se puede deshacer.',
    () => {
      approvePendingIncoming(selectedEntry.value, movementDetails);
      handleModalClose();
    }
  );
}
</script>

<template>
  <div class="space-y-8">

    <!-- SECCIÓN DE ENTRADA MANUAL -->
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
    
    <!-- SECCIÓN DE ENTRADAS PENDIENTES DE REVISIÓN (RESTAURADA) -->
    <div>
      <h2 class="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Entradas Pendientes de Revisión (desde Albarán)</h2>
      
      <div v-if="pendingIncomings.length > 0" class="space-y-4">
        <div v-for="entry in pendingIncomings" :key="entry.id" class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div class="flex justify-between items-start">
            <div>
              <p class="font-semibold">Albarán recibido el: <span class="font-normal">{{ new Date(entry.created_at).toLocaleString() }}</span></p>
              <a :href="entry.file_url" target="_blank" class="text-sm text-blue-600 hover:underline">Ver Albarán Original en Drive</a>
            </div>
            <button @click="handleApproveClick(entry)" class="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">
              Revisar y Aprobar
            </button>
          </div>
        </div>
      </div>
      <div v-else>
        <p class="text-gray-500">No hay nuevas entradas pendientes de revisión.</p>
      </div>
    </div>

    <!-- El modal de aprobación -->
    <ApprovalModal 
      v-if="isModalVisible" 
      :entry="selectedEntry"
      @close="handleModalClose"
      @approved="handleFinalApproval"
    />

  </div>
</template>