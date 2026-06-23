<template>
  <div>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">Prueba</h1>
    <p class="text-gray-600 dark:text-gray-400 mb-8">Zona de pruebas para el nuevo agente de Claude.</p>

    <!-- Estado de conexión a la segunda base de datos -->
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8 max-w-xl">
      <h2 class="text-lg font-bold text-gray-800 dark:text-white mb-3">Base de datos secundaria</h2>

      <div v-if="!isSecondaryConfigured" class="text-sm text-gray-600 dark:text-gray-300">
        <p class="mb-2">⚪ No configurada.</p>
        <p>Añade estas variables en el archivo <code>.env</code> y reinicia para conectar otra base de datos:</p>
        <pre class="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto">VITE_SUPABASE_URL_2=...
VITE_SUPABASE_ANON_KEY_2=...</pre>
      </div>

      <div v-else class="text-sm">
        <p v-if="estado === 'comprobando'" class="text-gray-500">🔄 Comprobando conexión...</p>
        <p v-else-if="estado === 'ok'" class="text-green-600 font-semibold">🟢 Conectada correctamente.</p>
        <p v-else class="text-red-600 font-semibold">🔴 No se pudo conectar: {{ mensajeError }}</p>
      </div>
    </div>

    <!-- Área libre para el agente de Claude -->
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 max-w-xl">
      <h2 class="text-lg font-bold text-gray-800 dark:text-white mb-2">Agente</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">Aquí montaremos las pruebas del nuevo agente.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { supabaseSecondary, isSecondaryConfigured } from '../supabaseSecondary';

const estado = ref('comprobando'); // 'comprobando' | 'ok' | 'error'
const mensajeError = ref('');

onMounted(async () => {
  if (!isSecondaryConfigured) return;
  try {
    // Petición ligera solo para verificar que la conexión responde.
    const { error } = await supabaseSecondary.auth.getSession();
    if (error) throw error;
    estado.value = 'ok';
  } catch (e) {
    estado.value = 'error';
    mensajeError.value = e.message || 'Error desconocido';
  }
});
</script>
