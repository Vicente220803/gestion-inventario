<template>
  <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
    <div class="flex items-center justify-between px-6 py-4">
      <div class="flex items-center flex-1">
        <div class="relative max-w-md w-full">
          <input
            type="text"
            placeholder="Buscar..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
          <MagnifyingGlassIcon class="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
        </div>
      </div>

      <div class="flex items-center space-x-4">
        <!-- User menu -->
        <div class="relative">
          <button @click="showUserMenu = !showUserMenu" class="flex items-center space-x-2 text-gray-700 dark:text-gray-200">
            <UserCircleIcon class="w-8 h-8" />
            <span>{{ user?.email }}</span>
          </button>
          <div v-if="showUserMenu" class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10">
            <button @click="handleSignOut" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted } from 'vue';
// --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
// Importamos 'user' y 'signOut' directamente desde nuestro estado global 'authState'.
import { user, signOut } from '../authState';
import { useToasts } from '../composables/useToasts';
import { useRouter } from 'vue-router';
import { MagnifyingGlassIcon, UserCircleIcon } from '@heroicons/vue/24/outline';

// Ya no necesitamos llamar a useAuth()
// const { user, signOut } = useAuth() // Esta línea se elimina

const { showSuccess } = useToasts();
const router = useRouter();
const showUserMenu = ref(false);

const handleSignOut = async () => {
  await signOut();
  // El router se encargará de redirigir automáticamente, pero por si acaso lo forzamos.
  router.push('/login');
};


onMounted(() => {
  // No hay nada que hacer aquí ahora
});
</script>