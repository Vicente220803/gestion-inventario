<!-- Ruta: src/views/SettingsView.vue -->
<script setup>
import { ref } from 'vue';
import { useInventory } from '../composables/useInventory';

// Importamos la nueva función que hemos creado
const { addProduct, productsWithSku } = useInventory();

// Estado local para el formulario de nuevo producto
const newProduct = ref({
  desc: '',
  sku: '',
  initialStock: 0
});

function handleAddProduct() {
  // Validaciones básicas
  if (!newProduct.value.desc || !newProduct.value.sku) {
    alert('La descripción y el SKU son obligatorios.');
    return;
  }
  
  // Llamamos a la función del composable para añadir el producto
  addProduct(newProduct.value);
  
  // Reseteamos el formulario
  newProduct.value = { desc: '', sku: '', initialStock: 0 };
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
        <button @click="handleAddProduct" class="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500 transition-all duration-300">
          Guardar Material
        </button>
      </div>
    </div>

    <!-- Lista de productos actuales (solo para visualización por ahora) -->
    <div class="mt-8">
      <h3 class="text-xl font-semibold text-gray-800 mb-4">Materiales Actuales</h3>
      <ul class="list-disc list-inside text-gray-600 text-sm pl-4 space-y-2">
        <li v-for="(product, desc) in productsWithSku" :key="product.sku">
          {{ desc }} (SKU: {{ product.sku }})
        </li>
      </ul>
    </div>
  </div>
</template>