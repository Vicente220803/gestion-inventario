<script setup>
import { computed } from 'vue';
import { useInventory } from '../composables/useInventory';
import { useConfirm } from '../composables/useConfirm';

const { movements, pendingIncomings, approvePendingIncoming } = useInventory();
const { showConfirm } = useConfirm();

// Filtramos el historial para mostrar solo los movimientos de entrada
const incomingMovements = computed(() => {
  return movements.value.filter(m => m.tipo === 'Entrada');
});

function handleApprove(entry) {
  showConfirm(
    'Aprobar Entrada',
    'Esto marcará la entrada como aprobada. Asegúrate de haber creado el movimiento correspondiente.',
    () => {
      // Por ahora, al confirmar, solo se actualiza el estado.
      // En el futuro, aquí se abriría el modal para rellenar los datos del movimiento.
      approvePendingIncoming(entry);
    }
  );
}
</script>

<template>
  <div class="space-y-8">
    
    <!-- SECCIÓN DE ENTRADAS PENDIENTES DE REVISIÓN -->
    <div>
      <h2 class="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Entradas Pendientes de Revisión</h2>
      
      <div v-if="pendingIncomings.length > 0" class="space-y-4">
        <div v-for="entry in pendingIncomings" :key="entry.id" class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div class="flex justify-between items-start">
            <div>
              <p class="font-semibold">Albarán recibido el: <span class="font-normal">{{ new Date(entry.created_at).toLocaleString() }}</span></p>
              <a :href="entry.file_url" target="_blank" class="text-sm text-blue-600 hover:underline">Ver Albarán Original en Drive</a>
            </div>
            <button @click="handleApprove(entry)" class="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">
              Aprobar
            </button>
          </div>
          <div class="mt-4">
            <p class="text-sm font-semibold text-gray-600 mb-1">Texto extraído por la IA:</p>
            <pre class="bg-white p-3 rounded-md text-xs text-gray-700 whitespace-pre-wrap font-mono h-40 overflow-y-auto border">{{ entry.parsed_data.raw_text }}</pre>
          </div>
        </div>
      </div>

      <div v-else>
        <p class="text-gray-500">No hay nuevas entradas pendientes de revisión.</p>
      </div>
    </div>

    <!-- SECCIÓN DE HISTORIAL DE ENTRADAS (tu código existente) -->
    <div>
      <h2 class="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Historial de Entradas</h2>
      
      <div v-if="incomingMovements.length > 0">
        <!-- Aquí iría tu tabla o lista para mostrar 'incomingMovements' -->
        <p>Tu historial de entradas aparecerá aquí.</p>
      </div>
      <div v-else>
        <p class="text-gray-500">No hay movimientos de entrada en el historial.</p>
      </div>
    </div>

  </div>
</template>