<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
// Importamos directamente la función signIn de nuestro nuevo authState
import { signIn } from '../authState';

const router = useRouter();
const email = ref('');
const password = ref('');
const isLoading = ref(false);

const handleLogin = async () => {
  isLoading.value = true;
  const success = await signIn(email.value, password.value);
  isLoading.value = false;

  if (success) {
    router.replace({ name: 'NewOrder' });
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
      <h2 class="text-2xl font-bold text-center mb-1">Iniciar Sesión</h2>
      <p class="text-center text-gray-600 mb-6">Accede a tu cuenta de inventario</p>
      
      <form @submit.prevent="handleLogin">
        <div class="mb-4">
          <label for="email" class="block text-sm font-medium text-gray-700">Correo Electrónico</label>
          <input 
            type="email" 
            id="email" 
            v-model="email"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
            :disabled="isLoading"
          />
        </div>
        
        <div class="mb-6">
          <label for="password" class="block text-sm font-medium text-gray-700">Contraseña</label>
          <input 
            type="password" 
            id="password" 
            v-model="password"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
            :disabled="isLoading"
          />
        </div>
        
        <button 
          type="submit" 
          class="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
          :disabled="isLoading"
        >
          {{ isLoading ? 'Accediendo...' : 'Acceder' }}
        </button>
      </form>
    </div>
  </div>
</template>