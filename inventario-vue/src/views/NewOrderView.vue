<script setup>
import { ref, computed } from 'vue';
import { useInventory } from '../composables/useInventory';

const { productsWithSku, materialStock, addMovement } = useInventory();

const fechaPedido = ref(new Date().toISOString().slice(0, 10));
const fechaEntrega = ref('');
const comentarios = ref('');
const items = ref([{ id: 0, desc: '', sku: '', cantidad: 1 }]);

const productNames = computed(() => Object.keys(productsWithSku.value));

function addItem() {
  const newId = items.value.length > 0 ? Math.max(...items.value.map(i => i.id)) + 1 : 0;
  items.value.push({ id: newId, desc: '', sku: '', cantidad: 1 });
}
function removeItem(index) {
  if (items.value.length > 1) items.value.splice(index, 1);
}
function updateSku(item) {
  item.sku = productsWithSku.value[item.desc]?.sku || '';
}

function submitOrder() {
  // Validaciones
  if (!fechaEntrega.value) { alert('Falta fecha de entrega'); return; }
  const validItems = items.value.filter(item => item.desc && item.cantidad > 0);
  if (validItems.length === 0) { alert('Añade al menos un artículo'); return; }
  for (const item of validItems) {
    if ((materialStock.value[item.sku] || 0) < item.cantidad) {
      alert(`Stock insuficiente para ${item.desc}`);
      return;
    }
  }

  const totalPallets = validItems.reduce((sum, item) => sum + Number(item.cantidad), 0);
  addMovement({
    fechaPedido: fechaPedido.value,
    fechaEntrega: fechaEntrega.value,
    pallets: totalPallets,
    comentarios: comentarios.value,
    items: JSON.parse(JSON.stringify(validItems)), // Deep copy
    tipo: 'Salida',
  });

  alert('Pedido registrado!');
  // Reset form
  fechaEntrega.value = '';
  comentarios.value = '';
  items.value = [{ id: 0, desc: '', sku: '', cantidad: 1 }];
}
</script>

<template>
  <div class="space-y-6">
      <h2 class="text-2xl font-bold text-gray-800">Salida de Inventario</h2>
      <!-- ... (El HTML del formulario va aquí, adaptado con v-model y @click) ... -->
      <!-- Formulario -->
      <div class="grid md:grid-cols-2 grid-cols-1 gap-6 mb-6">
        <div><label>Fecha del Pedido</label><input type="date" v-model="fechaPedido" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border"></div>
        <div><label>Fecha de Entrega Deseada</label><input type="date" v-model="fechaEntrega" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border"></div>
        <div class="md:col-span-2"><label>Comentarios</label><textarea rows="3" v-model="comentarios" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 bg-gray-50 border"></textarea></div>
      </div>
      <!-- Items -->
      <div class="space-y-4 mb-6">
        <h3 class="text-lg font-semibold text-gray-800">Artículos del Pedido</h3>
        <datalist id="products"><option v-for="name in productNames" :key="name" :value="name"></option></datalist>
        <div v-for="(item, index) in items" :key="item.id" class="item-entry grid md:grid-cols-4 grid-cols-1 gap-4 items-center p-4 bg-gray-50 rounded-lg border">
          <div><label>Descripción</label><input type="text" list="products" v-model="item.desc" @input="updateSku(item)" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border"></div>
          <div><label>SKU</label><input type="text" v-model="item.sku" readonly class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border"></div>
          <div><label>Cantidad</label><input type="number" v-model="item.cantidad" min="1" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border"></div>
          <div class="flex justify-end"><button @click="removeItem(index)" class="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md">Eliminar</button></div>
        </div>
      </div>
      <!-- Botones -->
      <div class="flex justify-between items-center mb-6"><button @click="addItem" class="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-md">+ Añadir Artículo</button></div>
      <div class="text-center"><button @click="submitOrder" class="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white font-semibold rounded-full shadow-lg">Enviar Pedido</button></div>
  </div>
</template>