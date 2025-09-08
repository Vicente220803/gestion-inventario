<!-- Ruta: src/views/SettingsView.vue -->
<script setup>
import { ref } from 'vue';
import { useInventory } from '../composables/useInventory';
import { useToasts } from '../composables/useToasts'; // <-- 1. IMPORTAMOS EL AYUDANTE

// 2. PREPARAMOS LAS FUNCIONES DE NOTIFICACIÓN PARA USARLAS
const { showSuccess, showError } = useToasts(); 
const { addProduct, productsWithSku, deleteProduct } = useInventory();

const newProduct = ref({
  desc: '',
  sku: '',
  initialStock: 0
});

function handleAddProduct() {
  if (!newProduct.value.desc || !newProduct.value.sku) {
    // 3. REEMPLAZAMOS EL ALERT DE ERROR
    showError('La descripción y el SKU son obligatorios.');
    return;
  }
  
  // La función addProduct ya tiene su propio alert, vamos a cambiarlo también en useInventory.js
  // Por ahora, vamos a modificar la llamada para que muestre el toast desde aquí.
  // (En un paso posterior, moveremos el toast dentro de la propia función addProduct)
  addProduct(newProduct.value); 
  
  newProduct.value = { desc: '', sku: '', initialStock: 0 };
}

function handleDeleteProduct(productDesc) {
  // El 'confirm' lo cambiaremos en la Parte B. Por ahora lo dejamos.
  if (confirm(`¿Estás seguro de que quieres borrar el material "${productDesc}"? Esta acción no se puede deshacer.`)) {
    deleteProduct(productDesc);
  }
}
</script>

<template>
  <div class="space-y-8">
    <h2 class="text-2xl font-bold text-gray-800">Configuración de Productos</h2>

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
        <div class="md:col-span-2">
          <label for="initialStock" class="block text-sm font-medium text-gray-700">Stock Inicial</label>
          <input type="number" id="initialStock" v-model="newProduct.initialStock" min="0" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2.5 border">
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
          <div>
            <p class="font-medium text-gray-800">{{ desc }}</p>
            <p class="text-xs text-gray-500">SKU: {{ product.sku }}</p>
          </div>
          <button 
            @click="handleDeleteProduct(desc)"
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