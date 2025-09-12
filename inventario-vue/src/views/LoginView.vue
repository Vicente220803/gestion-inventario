<!-- Ruta: src/views/LoginView.vue -->
<script setup>
import { ref } from 'vue';
import { useAuth } from '../composables/useAuth';

const { signIn } = useAuth();

const email = ref('');
const password = ref('');
const isLoading = ref(false);

const handleLogin = async () => {
  if (!email.value || !password.value) return;
  isLoading.value = true;
  await signIn(email.value, password.value);
  isLoading.value = false;
};
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-100">
    <div class="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
      <h2 class="text-3xl font-bold text-center text-gray-800">Iniciar Sesión</h2>
      <p class="text-center text-gray-500">Accede a tu cuenta de inventario</p>
      
      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700">Correo Electrónico</label>
          <input 
            id="email" 
            type="email" 
            v-model="email" 
            required
            class="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="tu@correo.com"
          >
        </div>
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">Contraseña</label>
          <input 
            id="password" 
            type="password" 
            v-model="password" 
            required
            class="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="********"
          >
        </div>
        <div>
          <button 
            type="submit" 
            :disabled="isLoading"
            class="w-full px-4 py-2 font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
          >
            <span v-if="isLoading">Iniciando...</span>
            <span v-else>Acceder</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>