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
        <!-- Notifications -->
        <div class="relative">
          <button @click.stop="toggleNotifications" class="relative p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <BellIcon class="w-6 h-6" />
            <span v-if="unreadCount > 0" class="absolute top-0 right-0 block w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <div v-if="showNotifications" @click.stop class="notifications-dropdown absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10 border border-gray-200 dark:border-gray-700">
            <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white">Notificaciones</h3>
            </div>
            <div v-if="loading" class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
              Cargando...
            </div>
            <div v-else-if="notifications.length === 0" class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
              No hay notificaciones
            </div>
            <div v-else class="max-h-64 overflow-y-auto">
              <div v-for="notification in notifications" :key="notification.id" @click="markAsRead(notification.id)" class="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0">
                <p class="text-sm text-gray-900 dark:text-white" :class="{ 'font-medium': !notification.read }">
                  {{ notification.message }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {{ new Date(notification.created_at).toLocaleString() }}
                </p>
              </div>
            </div>
            <div v-if="notifications.length > 0" class="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
              <button @click="markAllAsRead" class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                Marcar todas como leídas
              </button>
            </div>
          </div>
        </div>

        <!-- Theme toggle -->
        <button @click="toggleTheme" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <SunIcon v-if="isDark" class="w-6 h-6" />
          <MoonIcon v-else class="w-6 h-6" />
        </button>


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
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useToasts } from '../composables/useToasts'
import { useNotifications } from '../composables/useNotifications'
import { useRouter } from 'vue-router'
import { MagnifyingGlassIcon, BellIcon, SunIcon, MoonIcon, UserCircleIcon } from '@heroicons/vue/24/outline'

const { user, signOut } = useAuth()
const { showSuccess } = useToasts()
const { notifications, loading, unreadCount, loadNotifications, markAsRead, markAllAsRead } = useNotifications()
const router = useRouter()
const showUserMenu = ref(false)
const showNotifications = ref(false)
const isDark = ref(false)

const handleSignOut = async () => {
  await signOut()
  router.push('/login')
}

const toggleTheme = () => {
  console.log('Toggling theme')
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
}

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
  if (showNotifications.value && notifications.value.length === 0) {
    loadNotifications()
  }
}

const closeNotifications = () => {
  showNotifications.value = false
}

const handleClickOutside = (event) => {
  const notificationsEl = event.target.closest('.notifications-dropdown')
  if (!notificationsEl) {
    closeNotifications()
  }
}


onMounted(() => {
  const savedTheme = localStorage.getItem('theme') || 'light'
  isDark.value = savedTheme === 'dark'
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  }
  loadNotifications()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>