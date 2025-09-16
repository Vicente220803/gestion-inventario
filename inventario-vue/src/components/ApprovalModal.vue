<script setup>
import { ref } from 'vue';
import { useInventory } from '@/composables/useInventory';

const props = defineProps({
  entry: Object, // La entrada pendiente que estamos aprobando
});
const emit = defineEmits(['close', 'approved']);

const { productsWithSku } = useInventory();

const pallets = ref(0);
const items = ref([{ sku: '', desc: '', cantidad: 0 }]);

function addRow() {
  items.value.push({ sku: '', desc: '', cantidad: 0 });
}

function updateSku(item) {
  const selectedProduct = Object.entries(productsWithSku.value).find(([desc, data]) => desc === item.desc);
  if (selectedProduct) {
    item.sku = selectedProduct[1].sku;
  }
}

function submitApproval() {
  const movementDetails = {
    pallets: Number(pallets.value),
    items: items.value.filter(i => i.desc && i.cantidad > 0),
  };
  emit('approved', movementDetails);
}
</script>

<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
    <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
      <h2 class="text-xl font-bold mb-4">Aprobar Entrada y Registrar Stock</h2>
      
      <div class="grid grid-cols-2 gap-4">
        <!-- Columna Izquierda: Texto del Albarán -->
        <div>
          <h3 class="font-semibold text-gray-700 mb-2">Texto del Albarán</h3>
          <pre class="bg-gray-100 p-3 rounded-md text-xs text-gray-700 whitespace-pre-wrap font-mono h-80 overflow-y-auto border">{{ entry.parsed_data.raw_text }}</pre>
        </div>

        <!-- Columna Derecha: Formulario -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Nº de Pallets</label>
            <input type="number" v-model="pallets" class="mt-1 block w-full p-2 border rounded-md" />
          </div>
          
          <h3 class="font-semibold text-gray-700">Materiales a Registrar</h3>
          <div v-for="(item, index) in items" :key="index" class="grid grid-cols-3 gap-2 items-center">
            <select v-model="item.desc" @change="updateSku(item)" class="col-span-2 mt-1 block w-full p-2 border rounded-md">
              <option disabled value="">Selecciona material</option>
              <option v-for="(data, desc) in productsWithSku" :key="desc">{{ desc }}</option>
            </select>
            <input type="number" v-model="item.cantidad" placeholder="Cant." class="mt-1 block w-full p-2 border rounded-md" />
          </div>
          <button @click="addRow" class="text-sm text-blue-600 hover:underline">+ Añadir otra fila</button>
        </div>
      </div>

      <div class="mt-6 flex justify-end space-x-4">
        <button @click="$emit('close')" class="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Cancelar</button>
        <button @click="submitApproval" class="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">Confirmar y Registrar</button>
      </div>
    </div>
  </div>
</template>