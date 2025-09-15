<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useAuth } from './composables/useAuth';
import { useInventory } from './composables/useInventory';
import { useConfirm } from './composables/useConfirm';

// Importamos todos los componentes necesarios
import LoginView from './views/LoginView.vue';
import TheHeader from './components/TheHeader.vue';
import TheNavigation from './components/TheNavigation.vue';
import NewOrderView from './views/NewOrderView.vue';
import StockView from './views/StockView.vue';
import IncomingsView from './views/IncomingsView.vue';
import HistoryView from './views/HistoryView.vue';
import SettingsView from './views/SettingsView.vue';
import AppModal from './components/AppModal.vue';

const { user, profile, signOut, isSessionLoading, checkSession } = useAuth();
const { loadFromServer } = useInventory();
const { isVisible, title, message, onConfirm, onCancel } = useConfirm();

const activeTab = ref(null);
const views = {
  form: NewOrderView,
  stock: StockView,
  incomings: IncomingsView,
  settings: SettingsView,
  history: HistoryView
};

const availableTabs = computed(() => {
  const userRole = profile.value?.role;
  if (userRole === 'admin') return ['form', 'stock', 'incomings', 'settings', 'history'];
  if (userRole === 'operario') return ['form', 'stock'];
  return [];
});

watch(profile, (newProfile, oldProfile) => {
  if (newProfile && !oldProfile) {
    loadFromServer();
    
    let initialTabs = [];
    if (newProfile.role === 'admin') {
      initialTabs = ['form', 'stock', 'incomings', 'settings', 'history'];
    } else if (newProfile.role === 'operario') {
      initialTabs = ['form', 'stock'];
    }
    
    if (initialTabs.length > 0) {
      activeTab.value = initialTabs[0];
    }
  }
});

onMounted(() => {
  checkSession();
});

</script>

<template>
  <div v-if="isSessionLoading" class="flex items-center justify-center min-h-screen bg-gray-100">
    <p class="text-xl text-gray-500 animate-pulse">Cargando aplicación...</p>
  </div>

  <div v-else-if="user && profile">
    <div class="max-w-4xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden md:p-8 p-4">
      <TheHeader />
      
      <TheNavigation 
        :active-tab="activeTab" 
        :tabs="availableTabs"
        @navigate="newTab => activeTab = newTab" 
      />

      <main>
        <component v-if="activeTab" :is="views[activeTab]" />
        
        <div v-else class="text-center p-8">
          <p class="text-lg text-red-600">No tienes ninguna sección disponible.</p>
        </div>
      </main>

      <div class="text-center mt-8 border-t pt-4">
        <p class="text-sm text-gray-500 mb-2">
          Sesión iniciada como: <strong>{{ user.email }}</strong> (Rol: <strong>{{ profile.role }}</strong>)
        </p>
        <button @click="signOut" class="text-sm text-indigo-600 hover:underline">Cerrar Sesión</button>
      </div>
    </div>
  </div>

  <LoginView v-else />

  <AppModal
    v-if="isVisible"
    :title="title"
    @close="onCancel"
    @confirm="onConfirm"
  >
    <p class="text-gray-700">{{ message }}</p>
  </AppModal>
</template>

<style>
body {
    font-family: 'Inter', sans-serif;
    background-color: #f3f4f6;
}
</style>