<script setup>
import { ref, computed, watch, onMounted } from 'vue'; // Importamos onMounted
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

// Obtenemos la función checkSession que ahora se exporta desde useAuth
const { user, profile, signOut, isSessionLoading, checkSession } = useAuth();
const { loadFromServer } = useInventory();
const { isVisible, title, message, onConfirm, onCancel } = useConfirm();

// --- TU LÓGICA ORIGINAL SE MANTIENE INTACTA ---

// Estado local de la UI
const activeTab = ref('form');

// Mapa de vistas
const views = {
  form: NewOrderView,
  stock: StockView,
  incomings: IncomingsView,
  settings: SettingsView,
  history: HistoryView
};

// ¡LÓGICA DE PERMISOS!
// Esta propiedad computada decide qué pestañas mostrar basándose en el rol del usuario.
const availableTabs = computed(() => {
  const userRole = profile.value?.role;
  
  if (userRole === 'admin') {
    return ['form', 'stock', 'incomings', 'settings', 'history']; // El admin ve todo
  }
  if (userRole === 'operario') {
    return ['form', 'stock']; // El operario solo ve "Nuevo Pedido" y "Stock"
  }
  return []; // Si no hay rol (o está cargando), no se muestra nada
});

// Este 'watcher' reacciona cuando el usuario inicia sesión.
// Cuando 'user' cambia de null a un objeto de usuario, cargamos los datos del inventario.
watch(user, (newUser, oldUser) => {
  if (newUser && !oldUser) {
    loadFromServer();
    // Al iniciar sesión, nos aseguramos de que la pestaña por defecto sea una a la que tiene acceso
    if (!availableTabs.value.includes(activeTab.value)) {
        activeTab.value = availableTabs.value[0] || 'form';
    }
  }
});

// --- SOLUCIÓN A LA CARGA INFINITA ---
// Cuando el componente App.vue se monta, llamamos explícitamente a checkSession.
// Esto iniciará el proceso de autenticación.
onMounted(() => {
  checkSession();
});

</script>

<template>
  <!-- 1. MIENTRAS SE VERIFICA LA SESIÓN, MOSTRAMOS UN MENSAJE DE CARGA -->
  <div v-if="isSessionLoading" class="flex items-center justify-center min-h-screen bg-gray-100">
    <p class="text-xl text-gray-500 animate-pulse">Cargando aplicación...</p>
  </div>

  <!-- 2. UNA VEZ VERIFICADO, SI HAY USUARIO Y PERFIL, MOSTRAMOS LA APLICACIÓN -->
  <div v-else-if="user && profile">
    <div class="max-w-4xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden md:p-8 p-4">
      <TheHeader />
      
      <TheNavigation 
        :active-tab="activeTab" 
        :tabs="availableTabs"
        @navigate="newTab => activeTab = newTab" 
      />

      <main>
        <component v-if="availableTabs.includes(activeTab)" :is="views[activeTab]" />
        <div v-else class="text-center p-8">
          <p class="text-lg text-red-600">No tienes permiso para acceder a esta sección.</p>
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

  <!-- 3. SI NO HAY SESIÓN ACTIVA, MOSTRAMOS LA VISTA DE LOGIN -->
  <LoginView v-else />

  <!-- Modal de confirmación global -->
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
/* Los estilos globales no cambian */
body {
    font-family: 'Inter', sans-serif;
    background-color: #f3f4f6;
}
</style>