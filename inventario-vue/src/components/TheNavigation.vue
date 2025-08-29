<!-- Ruta: src/components/TheNavigation.vue (VERSIÓN ACTUALIZADA) -->
<script setup>
defineProps({
  activeTab: String,
});
const emit = defineEmits(['navigate']);
</script>

<template>
  <div class="flex justify-center mb-6 space-x-4">
    <!-- El orden ahora es: Pedido, Stock, Entradas, Añadir Material, Historial -->
    
    <button @click="emit('navigate', 'form')" :class="{'bg-indigo-100 text-indigo-700': activeTab === 'form'}" class="px-6 py-2 text-sm font-semibold rounded-full focus:outline-none transition-colors duration-200">
      Nuevo Pedido
    </button>
    
    <button @click="emit('navigate', 'stock')" :class="{'bg-indigo-100 text-indigo-700': activeTab === 'stock'}" class="px-6 py-2 text-sm font-semibold rounded-full focus:outline-none transition-colors duration-200">
      Stock
    </button>
    
    <button @click="emit('navigate', 'incomings')" :class="{'bg-indigo-100 text-indigo-700': activeTab === 'incomings'}" class="px-6 py-2 text-sm font-semibold rounded-full focus:outline-none transition-colors duration-200">
      Entradas
    </button>
    
    <!-- CAMBIO: El botón de 'settings' ahora se llama 'Añadir Material' -->
    <button @click="emit('navigate', 'settings')" :class="{'bg-indigo-100 text-indigo-700': activeTab === 'settings'}" class="px-6 py-2 text-sm font-semibold rounded-full focus:outline-none transition-colors duration-200">
      Añadir Material
    </button>

    <!-- CAMBIO: El botón de 'history' ahora está al final -->
    <button @click="emit('navigate', 'history')" :class="{'bg-indigo-100 text-indigo-700': activeTab === 'history'}" class="px-6 py-2 text-sm font-semibold rounded-full focus:outline-none transition-colors duration-200">
      Ver Historial
    </button>
  </div>
</template>