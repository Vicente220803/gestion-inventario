<template>
  <div class="w-64 bg-white dark:bg-gray-800 shadow-lg">
    <div class="p-6 border-b-2 border-brandgreen-600">
      <img
        v-if="!logoError"
        :src="logoSrc"
        alt="Surexport Levante"
        class="h-12 w-auto"
        @error="logoError = true"
      />
      <div v-else>
        <h1 class="text-xl font-bold leading-tight">
          <span class="text-brand-600">sur</span><span class="text-gray-500">export</span>
        </h1>
        <p class="text-[10px] font-semibold tracking-[0.3em] text-gray-500">LEVANTE</p>
      </div>
    </div>
    <nav class="mt-6">
      <router-link
        v-for="item in navigation"
        :key="item.name"
        :to="item.path"
        class="flex items-center px-6 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        active-class="bg-brand-50 dark:bg-brand-900 text-brand-700 dark:text-brand-200"
      >
        <component :is="item.icon" class="w-5 h-5 mr-3" />
        {{ item.name }}
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { CubeIcon, ClockIcon, CogIcon, PlusIcon, ChartBarIcon, QrCodeIcon } from '@heroicons/vue/24/outline';
import { computed, ref } from 'vue';

// Logo desde public/logo.png. Si aún no está, mostramos el wordmark de texto.
const logoSrc = '/logo.png';
const logoError = ref(false);
// --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
// Importamos 'profile' directamente desde nuestro estado global 'authState'.
import { profile } from '../authState';

// Ya no necesitamos llamar a useAuth()
// const { profile } = useAuth() // Esta línea se elimina

const allNavigation = [
  { name: 'Dashboard', path: '/dashboard', icon: ChartBarIcon, roles: ['admin', 'operario'] },
  { name: 'Stock', path: '/stock', icon: CubeIcon, roles: ['admin', 'operario'] },
  { name: 'Historial', path: '/historial', icon: ClockIcon, roles: ['admin', 'operario'] },
  { name: 'Entradas', path: '/incomings', icon: PlusIcon, roles: ['admin'] }, // <-- Mejora: Añadimos roles aquí
  { name: 'Nuevo Pedido', path: '/new-order', icon: PlusIcon, roles: ['admin', 'operario'] },
  { name: 'Picking', path: '/picking', icon: QrCodeIcon, roles: ['admin', 'operario', 'gescotrans'] },
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