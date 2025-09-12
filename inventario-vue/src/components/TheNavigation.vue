<!-- RUTA: src/components/TheNavigation.vue (VERSIÓN FINAL CON PERMISOS) -->
<script setup>
// Ahora acepta una propiedad 'tabs' que es un array con los nombres de las pestañas a mostrar
defineProps({
  activeTab: String,
  tabs: {
    type: Array,
    required: true,
  },
});
const emit = defineEmits(['navigate']);

// Un objeto para mapear las claves de las pestañas a su texto visible
const tabLabels = {
  form: 'Nuevo Pedido',
  stock: 'Stock',
  incomings: 'Entradas',
  settings: 'Añadir Material',
  history: 'Ver Historial',
};
</script>

<template>
  <div class="flex justify-center mb-6 space-x-4">
    <!-- Usamos un v-for para crear solo los botones que están en la lista 'tabs' -->
    <button 
      v-for="tabKey in tabs" 
      :key="tabKey"
      @click="emit('navigate', tabKey)" 
      :class="{'bg-indigo-100 text-indigo-700': activeTab === tabKey, 'text-gray-500': activeTab !== tabKey}"
      class="px-6 py-2 text-sm font-semibold rounded-full focus:outline-none transition-colors duration-200"
    >
      {{ tabLabels[tabKey] }}
    </button>
  </div>
</template>