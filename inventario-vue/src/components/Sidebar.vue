<template>
  <div class="w-64 bg-white dark:bg-gray-800 shadow-lg">
    <div class="p-6">
      <h1 class="text-2xl font-bold text-gray-800 dark:text-white">Inventario</h1>
    </div>
    <nav class="mt-6">
      <router-link
        v-for="item in navigation"
        :key="item.name"
        :to="item.path"
        class="flex items-center px-6 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        active-class="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
      >
        <component :is="item.icon" class="w-5 h-5 mr-3" />
        {{ item.name }}
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { HomeIcon, CubeIcon, ClockIcon, CogIcon, PlusIcon } from '@heroicons/vue/24/outline';
import { computed } from 'vue';
// --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
// Importamos 'profile' directamente desde nuestro estado global 'authState'.
import { profile } from '../authState';

// Ya no necesitamos llamar a useAuth()
// const { profile } = useAuth() // Esta línea se elimina

const allNavigation = [
  { name: 'Stock', path: '/stock', icon: CubeIcon },
  { name: 'Historial', path: '/historial', icon: ClockIcon },
  { name: 'Entradas', path: '/incomings', icon: PlusIcon, roles: ['admin'] }, // <-- Mejora: Añadimos roles aquí
  { name: 'Nuevo Pedido', path: '/new-order', icon: PlusIcon, roles: ['admin', 'operario'] },
  { name: 'Materiales', path: '/settings', icon: CogIcon, roles: ['admin'] },
];

const navigation = computed(() => {
  const userRole = profile.value?.role;
  if (!userRole) return []; // Si no hay rol, no mostramos nada.

  // Filtramos la navegación basándonos en los roles definidos en cada objeto.
  return allNavigation.filter(item => {
    // Si un item de navegación no tiene 'roles', se muestra a todo el mundo.
    if (!item.roles) return true; 
    // Si tiene 'roles', comprobamos si el rol del usuario está incluido.
    return item.roles.includes(userRole);
  });
});
</script>