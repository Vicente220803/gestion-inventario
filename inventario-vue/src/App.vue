<script setup>
import { useConfirm } from './composables/useConfirm';
import AppModal from './components/AppModal.vue';

const { isVisible, title, message, onConfirm, onCancel } = useConfirm();
</script>

<template>
  <div>
    <router-view />

    <AppModal
      v-if="isVisible"
      :title="title"
      @close="onCancel"
      @confirm="onConfirm"
    >
      <p class="text-gray-700 dark:text-gray-300">{{ message }}</p>
    </AppModal>
  </div>
</template>

<style>
/* Tus estilos globales */
body {
    font-family: 'Inter', sans-serif;
}
</style>