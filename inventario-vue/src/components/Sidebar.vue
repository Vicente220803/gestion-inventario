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
import { HomeIcon, CubeIcon, ClockIcon, CogIcon, PlusIcon } from '@heroicons/vue/24/outline'
import { computed } from 'vue'
import { useAuth } from '../composables/useAuth'

const { profile } = useAuth()

const allNavigation = [
  { name: 'Inventario', path: '/inventory', icon: CubeIcon },
  { name: 'Movimientos', path: '/movements', icon: ClockIcon },
  { name: 'Entradas', path: '/incomings', icon: PlusIcon },
  { name: 'Nuevo Pedido', path: '/new-order', icon: PlusIcon },
  { name: 'Materiales', path: '/settings', icon: CogIcon },
]

const navigation = computed(() => {
  const userRole = profile.value?.role
  console.log(`[DEBUG] Sidebar - userRole: ${userRole}, profile:`, profile.value)
  if (userRole === 'admin') {
    return allNavigation
  } else if (userRole === 'operario') {
    return allNavigation.filter(item => ['/inventory', '/new-order'].includes(item.path))
  }
  return []
})
</script>