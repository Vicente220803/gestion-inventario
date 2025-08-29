<!-- Ruta: src/components/AppModal.vue -->
<script setup>
// Definimos las propiedades que este componente puede recibir (como el título)
defineProps({
  title: String,
});
// Definimos los eventos que este componente puede enviar (cuando se pulsa un botón)
const emit = defineEmits(['close', 'confirm']);
</script>

<template>
  <div class="modal" style="display: flex;">
    <div class="modal-content text-left">
      <h3 class="text-2xl font-bold mb-4">{{ title }}</h3>
      
      <!-- Esta es una ranura (slot). Aquí se inyectará el contenido que queramos,
           como el formulario de edición de stock. -->
      <slot></slot>

      <div class="flex justify-end space-x-4 mt-6">
        <button @click="emit('close')" class="px-6 py-2 text-sm font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
          Cancelar
        </button>
        <button @click="emit('confirm')" class="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
          Guardar Cambios
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Pegamos los estilos del modal aquí para que estén encapsulados y no afecten a otros componentes */
.modal {
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rgba(0,0,0,0.4);
  display: flex;
  justify-content: center;
  align-items: center;
}
.modal-content {
  background-color: #fefefe;
  padding: 24px;
  border-radius: 12px;
  width: 90%;
  max-width: 500px; /* Un poco más grande para que quepa bien el formulario */
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}


</style>
