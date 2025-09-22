<template>
  <div class="flex h-screen bg-gray-100 dark:bg-gray-900">
    <!-- Sidebar -->
    <Sidebar />

    <!-- Main content -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Header -->
      <Header />

      <!-- Page content -->
      <main class="flex-1 overflow-y-auto p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'
import { useAuth } from '../composables/useAuth'
import { useInventory } from '../composables/useInventory'
import { watch, onMounted } from 'vue'

const { user, profile, checkSession } = useAuth()
const { loadFromServer, fetchPendingIncomings } = useInventory()

// Load data when component mounts
watch(profile, (newProfile, oldProfile) => {
  if (newProfile && !oldProfile) {
    loadFromServer()
    fetchPendingIncomings()
  }
}, { immediate: true })

onMounted(() => {
  if (!user.value) {
    checkSession()
  }
})
</script>