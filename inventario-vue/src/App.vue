<script setup>
import { onMounted } from 'vue';
import { useAuth } from './composables/useAuth';
import { useInventory } from './composables/useInventory';
import { useConfirm } from './composables/useConfirm';
import { useRouter } from 'vue-router';
import AppModal from './components/AppModal.vue';

const { user, profile, isSessionLoading, checkSession, signOut } = useAuth();
const { loadFromServer, fetchPendingIncomings } = useInventory();
const { isVisible, title, message, onConfirm, onCancel } = useConfirm();
const router = useRouter();

// Load data when authenticated
if (user.value && profile.value) {
  loadFromServer();
  fetchPendingIncomings();
}

const handleSignOut = async () => {
  await signOut();
  router.push('/login');
};

onMounted(() => {
  checkSession();
});
</script>

<template>
  <div v-if="isSessionLoading" class="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
    <p class="text-xl text-gray-500 dark:text-gray-400 animate-pulse">Cargando aplicación...</p>
  </div>

  <router-view v-else />

  <AppModal
    v-if="isVisible"
    :title="title"
    @close="onCancel"
    @confirm="onConfirm"
  >
    <p class="text-gray-700 dark:text-gray-300">{{ message }}</p>
  </AppModal>
</template>

<style>
body {
    font-family: 'Inter', sans-serif;
    background-color: #f3f4f6;
    @apply dark:bg-gray-900;
}
</style>