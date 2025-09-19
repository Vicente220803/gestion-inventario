<!-- RUTA: /inventario-vue/src/components/ImageModal.vue -->

<script setup>
defineProps({
  imageUrl: String,
});
const emit = defineEmits(['close']);
</script>

<template>
  <div 
    class="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50"
    @click="emit('close')"
  >
    <div class="relative p-4">
      <img :src="imageUrl" class="max-w-[90vw] max-h-[90vh] object-contain" @click.stop>
      <button 
        @click="emit('close')" 
        class="absolute -top-2 -right-2 bg-white rounded-full p-2 leading-none text-2xl shadow-lg"
      >
        &times;
      </button>
    </div>
  </div>
</template>