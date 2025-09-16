<script setup>
import { ref, computed } from 'vue';
import { useInventory } from '../composables/useInventory';
// ¡LA CORRECCIÓN! Importamos el composable de confirmación
import { useConfirm } from '../composables/useConfirm';

// Desempaquetamos TODAS las funciones que necesitamos
const { movements, deleteMovement } = useInventory();
const { showConfirm } = useConfirm();

// Estado local para los filtros de fecha
const startDate = ref('');
const endDate = ref('');

// Propiedad computada para filtrar los movimientos según el rango de fechas
const filteredMovements = computed(() => {
  if (!startDate.value || !endDate.value) {
    return [...movements.value].reverse(); // Si no hay filtro, mostrar todo en orden descendente
  }
  return [...movements.value]
    .filter(m => {
      const moveDate = new Date(m.fechaEntrega);
      return moveDate >= new Date(startDate.value) && moveDate <= new Date(endDate.value);
    })
    .reverse();
});

// Función que se llama al hacer clic en "Anular"
function handleDelete(movement) {
  // Usamos el modal de confirmación para seguridad
  showConfirm(
    'Anular Movimiento',
    `¿Estás seguro de que quieres anular este movimiento de "${movement.tipo}"? Esta acción revertirá el stock y no se puede deshacer.`,
    () => {
      // Si el usuario confirma, llamamos a la función deleteMovement
      deleteMovement(movement.id, movement.tipo, movement.items);
    }
  );
}

function calculateAndExport() {
  // Lógica para calcular resúmenes y exportar (puedes añadirla aquí)
  alert('Función de calcular y exportar no implementada aún.');
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold text-gray-800">Historial y Resumen</h2>

    <!-- Sección de Filtros -->
    <div class="p-4 bg-gray-50 rounded-lg border grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
      <div>
        <label for="start-date" class="block text-sm font-medium text-gray-700">Desde</label>
        <input type="date" id="start-date" v-model="startDate" class="mt-1 block w-full p-2 border rounded-md">
      </div>
      <div>
        <label for="end-date" class="block text-sm font-medium text-gray-700">Hasta</label>
        <input type="date" id="end-date" v-model="endDate" class="mt-1 block w-full p-2 border rounded-md">
      </div>
      <button @click="calculateAndExport" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 w-full">
        Calcular y Exportar
      </button>
    </div>

    <!-- Sección de Historial Detallado -->
    <div>
      <h3 class="text-xl font-semibold text-gray-700 mb-4">Historial de Movimientos Detallado</h3>
      <div v-if="filteredMovements.length > 0" class="space-y-4">
        <div v-for="movement in filteredMovements" :key="movement.id" class="p-4 border rounded-lg bg-white shadow-sm relative">
          <div class="flex justify-between items-start">
            <div>
              <p class="font-bold">Fecha: <span class="font-normal">{{ movement.fechaEntrega }}</span></p>
              <p class="font-bold">Movimiento: 
                <span :class="movement.tipo === 'Entrada' ? 'text-green-600' : 'text-red-600'">{{ movement.tipo }}</span>
              </p>
              <p class="font-bold">Total de Pallets: <span class="font-normal">{{ movement.pallets }}</span></p>
              <div class="mt-2">
                <p class="font-bold">Artículos:</p>
                <ul class="list-disc list-inside text-sm text-gray-600">
                  <li v-for="(item, index) in movement.items" :key="index">
                    {{ item.cantidad }} x {{ item.desc }} (SKU: {{ item.sku }})
                  </li>
                </ul>
              </div>
              <p v-if="movement.comentarios" class="mt-2 font-bold">Comentarios: <span class="font-normal italic">{{ movement.comentarios }}</span></p>
            </div>
            <button @click="handleDelete(movement)" class="absolute top-4 right-4 bg-red-100 text-red-700 text-xs font-bold py-1 px-3 rounded-full hover:bg-red-200">
              Anular
            </button>
          </div>
        </div>
      </div>
      <div v-else class="p-4 text-center bg-gray-50 rounded-lg">
        <p class="text-gray-500">No se encontraron movimientos para el rango de fechas seleccionado.</p>
      </div>
    </div>
  </div>
</template>