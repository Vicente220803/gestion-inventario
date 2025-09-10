<!-- RUTA: src/App.vue (VERSIÓN FINAL CON CONEXIÓN A SUPABASE) -->
<script setup>
import { ref, onMounted } from 'vue';
import { useInventory } from './composables/useInventory';

// Importamos todos nuestros componentes y vistas, como antes
import TheHeader from './components/TheHeader.vue';
import TheNavigation from './components/TheNavigation.vue';
import NewOrderView from './views/NewOrderView.vue';
import StockView from './views/StockView.vue';
import IncomingsView from './views/IncomingsView.vue';
import HistoryView from './views/HistoryView.vue';
import SettingsView from './views/SettingsView.vue';

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

// =================================================================
// == ESTE ES EL ÚNICO CAMBIO ==
// =================================================================
// En lugar de llamar a 'loadFromLocalStorage', ahora llamamos a 'loadFromServer'.
const { loadFromServer } = useInventory();
onMounted(() => {
  loadFromServer();
});
// =================================================================
// == FIN DEL CAMBIO ==
// =================================================================
</script>

<template>
  <div class="max-w-4xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden md:p-8 p-4">
    
    <!-- El template no cambia en absoluto -->
    <TheHeader />
    <TheNavigation 
      :active-tab="activeTab" 
      @navigate="newTab => activeTab = newTab" 
    />
    
    <main>
      <component :is="views[activeTab]" />
    </main>

  </div>
</template>

<style>
/* Los estilos globales no cambian */
body {
    font-family: 'Inter', sans-serif;
    background-color: #f3f4f6;
}
</style>