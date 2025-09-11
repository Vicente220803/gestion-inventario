<!-- RUTA: src/App.vue (VERSIÓN FINAL CON MODAL DE CONFIRMACIÓN) -->
<script setup>
import { ref, onMounted } from 'vue';
import { useInventory } from './composables/useInventory';
import { useConfirm } from './composables/useConfirm'; // <-- 1. Importamos el "ayudante" del modal
import AppModal from './components/AppModal.vue'; // <-- 2. Importamos el componente del modal

// Importamos todos nuestros componentes y vistas, como antes
import TheHeader from './components/TheHeader.vue';
import TheNavigation from './components/TheNavigation.vue';
import NewOrderView from './views/NewOrderView.vue';
import StockView from './views/StockView.vue';
import IncomingsView from './views/IncomingsView.vue';
import HistoryView from './views/HistoryView.vue';
import SettingsView from './views/SettingsView.vue';

// 3. Preparamos las variables y funciones del modal de confirmación
const { isVisible, title, message, onConfirm, onCancel } = useConfirm();

// El estado para la pestaña activa no cambia
const activeTab = ref('form');

// El "mapa" de vistas no cambia
const views = {
  form: NewOrderView,
  stock: StockView,
  incomings: IncomingsView,
  settings: SettingsView,
  history: HistoryView
};

// La carga de datos desde Supabase no cambia
const { loadFromServer } = useInventory();
onMounted(() => {
  loadFromServer();
});
</script>

<template>
  <div class="max-w-4xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden md:p-8 p-4">
    
    <!-- La estructura principal del template no cambia -->
    <TheHeader />
    <TheNavigation 
      :active-tab="activeTab" 
      @navigate="newTab => activeTab = newTab" 
    />
    
    <main>
      <component :is="views[activeTab]" />
    </main>

  </div>

  <!-- ================================================================= -->
  <!-- == 4. AÑADIMOS EL MODAL DE CONFIRMACIÓN GLOBAL AL FINAL == -->
  <!-- ================================================================= -->
  <!-- Este modal estará oculto hasta que la función 'show' de 'useConfirm' lo active -->
  <AppModal
    v-if="isVisible"
    :title="title"
    @close="onCancel"
    @confirm="onConfirm"
  >
    <!-- El mensaje que le pasemos a la función 'show' aparecerá aquí -->
    <p class="text-gray-700">{{ message }}</p>
  </AppModal>

</template>

<style>
/* Los estilos globales no cambian */
body {
    font-family: 'Inter', sans-serif;
    background-color: #f3f4f6;
}
</style>