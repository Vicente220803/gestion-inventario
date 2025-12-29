<!-- Ruta: src/views/SettingsView.vue -->
<script setup>
import { ref } from 'vue';
import { useInventory } from '../composables/useInventory';
import { useToasts } from '../composables/useToasts'; // <-- 1. IMPORTAMOS EL AYUDANTE
import { useConfirm } from '../composables/useConfirm'; // <-- Importamos useConfirm

// 2. PREPARAMOS LAS FUNCIONES DE NOTIFICACIÓN PARA USARLAS
const { showSuccess, showError } = useToasts();
const { showConfirm } = useConfirm(); // <-- Inicializamos useConfirm
const { addProduct, productsWithSku, deleteProduct, updateUnidadesPorPallet } = useInventory();

// Estado para edición de unidades
const editingUnidades = ref({});
const editingProduct = ref(null);

const newProduct = ref({
  desc: '',
  sku: '',
  stockInicial: 0,
  unidadesPorPallet: 1
});

function handleAddProduct() {
  if (!newProduct.value.desc || !newProduct.value.sku) {
    // 3. REEMPLAZAMOS EL ALERT DE ERROR
    showError('La descripción y el SKU son obligatorios.');
    return;
  }

  console.log('[DEBUG] handleAddProduct: newProduct.value:', newProduct.value);
  // La función addProduct ya tiene su propio alert, vamos a cambiarlo también en useInventory.js
  // Por ahora, vamos a modificar la llamada para que muestre el toast desde aquí.
  // (En un paso posterior, moveremos el toast dentro de la propia función addProduct)
  addProduct(newProduct.value);

  newProduct.value = { desc: '', sku: '', stockInicial: 0, unidadesPorPallet: 1 };
}

function handleDeleteProduct(productSku, productDesc) {
  console.log('[DEBUG] handleDeleteProduct called with sku:', productSku, 'desc:', productDesc);
  // Usar el modal de confirmación personalizado en lugar de confirm()
  showConfirm(
    'Eliminar Material',
    `¿Estás seguro de que quieres eliminar el material "${productDesc}"? Esta acción eliminará permanentemente el material y reducirá el stock total. No se puede deshacer.`,
    () => {
      console.log('[DEBUG] User confirmed deletion, calling deleteProduct');
      deleteProduct(productSku);
    }
  );
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
    showError('Las unidades por pallet deben ser mayor que 0');
    return;
  }

  await updateUnidadesPorPallet(sku, newUnidades);
  editingProduct.value = null;
  editingUnidades.value = {};
}
</script>

<template>
  <div class="space-y-8">
    <h2 class="text-2xl font-bold text-gray-800">Materiales</h2>

    <!-- Formulario para añadir nuevo producto -->
    <div class="p-6 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
      <h3 class="text-xl font-semibold text-gray-800 mb-4">Añadir Nuevo Material</h3>
      <div class="grid md:grid-cols-2 grid-cols-1 gap-4">
        <div>
          <label for="productDesc" class="block text-sm font-medium text-gray-700">Descripción del Material</label>
          <input type="text" id="productDesc" v-model="newProduct.desc" placeholder="Ej: CAJA PLAST NUEVA" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border">
        </div>
        <div>
          <label for="productSku" class="block text-sm font-medium text-gray-700">SKU / Código</label>
          <input type="text" id="productSku" v-model="newProduct.sku" placeholder="Ej: CAJANUEVA01" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border">
        </div>
        <div>
          <label for="initialStock" class="block text-sm font-medium text-gray-700">Stock Inicial (Pallets)</label>
          <input type="number" id="initialStock" v-model.number="newProduct.stockInicial" min="0" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border">
        </div>
        <div>
          <label for="unitsPerPallet" class="block text-sm font-medium text-gray-700">Unidades por Pallet</label>
          <input type="number" id="unitsPerPallet" v-model.number="newProduct.unidadesPorPallet" min="1" placeholder="Ej: 100" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border">
        </div>
      </div>
      <div class="flex justify-end mt-6">
        <button @click="handleAddProduct" class="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
          Guardar Material
        </button>
      </div>
    </div>

    <!-- Lista de productos actuales con el botón de borrado -->
    <div class="mt-8">
      <h3 class="text-xl font-semibold text-gray-800 mb-4">Materiales Actuales</h3>
      <div v-if="Object.keys(productsWithSku).length > 0" class="space-y-2">
        <div
          v-for="(product, desc) in productsWithSku"
          :key="product.sku"
          class="flex items-center justify-between p-3 bg-white border rounded-md shadow-sm"
        >
          <div class="flex-1">
            <p class="font-medium text-gray-800">{{ desc }}</p>
            <p class="text-xs text-gray-500">SKU: {{ product.sku }}</p>

            <!-- Modo de visualización normal -->
            <div v-if="editingProduct !== product.sku" class="flex items-center gap-2 mt-1">
              <p class="text-xs text-blue-600">📦 {{ product.unidades_por_pallet || 1 }} unidades/pallet</p>
              <button
                @click="startEditingUnidades(product.sku, product.unidades_por_pallet || 1)"
                class="text-xs text-indigo-600 hover:text-indigo-800 underline"
              >
                Editar
              </button>
            </div>

            <!-- Modo de edición -->
            <div v-else class="flex items-center gap-2 mt-2">
              <input
                type="number"
                v-model.number="editingUnidades[product.sku]"
                min="1"
                class="w-24 px-2 py-1 text-sm border rounded-md focus:ring-2 focus:ring-indigo-500"
                placeholder="Uds"
              />
              <span class="text-xs text-gray-500">uds/pallet</span>
              <button
                @click="saveUnidades(product.sku)"
                class="px-2 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Guardar
              </button>
              <button
                @click="cancelEditingUnidades()"
                class="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
          <button
            @click="handleDeleteProduct(product.sku, desc)"
            class="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200"
            title="Borrar este material"
          >
            Borrar
          </button>
        </div>
      </div>
      <p v-else class="text-gray-500">No hay materiales definidos.</p>
    </div>
  </div>
</template>