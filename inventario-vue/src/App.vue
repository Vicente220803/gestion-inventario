<script setup>
import { ref, onMounted } from 'vue';
import { useInventory } from './composables/useInventory';

// --- 1. IMPORTACIÓN DE COMPONENTES Y VISTAS ---
// Importamos todos los bloques de construcción que hemos creado.

// Componentes de UI reutilizables
import TheHeader from './components/TheHeader.vue';
import TheNavigation from './components/TheNavigation.vue';

// Vistas (cada una corresponde a una pestaña)
import NewOrderView from './views/NewOrderView.vue';
import StockView from './views/StockView.vue';
import IncomingsView from './views/IncomingsView.vue';
import HistoryView from './views/HistoryView.vue';
import SettingsView from './views/SettingsView.vue'; // <-- ¡LÍNEA AÑADIDA!

// --- 2. ESTADO Y LÓGICA DEL LAYOUT ---

// Esta variable reactiva controla qué vista se muestra.
// Su valor inicial es 'form', por lo que la app empezará en "Nuevo Pedido".
const activeTab = ref('form');

// Creamos un objeto que mapea el nombre de la pestaña al componente importado.
// Esto nos permitirá cambiar de vista dinámicamente.
const views = {
  form: NewOrderView,
  stock: StockView,
  incomings: IncomingsView,
  history: HistoryView,
   settings: SettingsView,
};

// Usamos nuestro composable para cargar los datos al iniciar la aplicación.
const { loadFromLocalStorage } = useInventory();
onMounted(() => {
  loadFromLocalStorage();
});
</script>

<template>
  <div class="max-w-4xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden md:p-8 p-4">
    
    <!-- Mostramos el encabezado y la navegación -->
    <TheHeader />
    <TheNavigation 
      :active-tab="activeTab" 
      @navigate="newTab => activeTab = newTab" 
    />
    
    <main>
      <!-- 
        ¡MAGIA DE VUE!
        El componente dinámico <component> renderizará la vista que corresponda
        a la pestaña activa ('activeTab'). Si activeTab es 'stock', aquí se
        mostrará el componente StockView.
      -->
      <component :is="views[activeTab]" />
    </main>

  </div>
</template>

<style>
/* 
  Aquí solo dejamos los estilos verdaderamente globales.
  La importación de los estilos de Tailwind se hace en main.js,
  por lo que no necesitamos nada más aquí a menos que quieras
  añadir estilos globales personalizados.
*/
</style>