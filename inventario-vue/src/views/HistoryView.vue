<!-- Ruta: src/views/HistoryView.vue -->
<script setup>
import { ref, computed } from 'vue';
import { useInventory } from '../composables/useInventory';
import AppModal from '../components/AppModal.vue';

// Importamos la nueva función 'deleteMovement' del "cerebro"
const { movements, calculateDailySummary, deleteMovement } = useInventory();

const startDate = ref('');
const endDate = ref('');
const summaryData = ref(null);
const isSummaryModalVisible = ref(false);

const sortedHistory = computed(() => {
  const filteredMovements = movements.value.filter(movement => {
    if (!startDate.value && !endDate.value) return true;
    const movementDateStr = movement.tipo === 'Salida' ? movement.fechaEntrega : movement.fechaPedido;
    if (!movementDateStr) return false;
    const movementDate = new Date(movementDateStr + 'T00:00:00');
    const start = startDate.value ? new Date(startDate.value + 'T00:00:00') : null;
    const end = endDate.value ? new Date(endDate.value + 'T00:00:00') : null;
    if (start && movementDate < start) return false;
    if (end && movementDate > end) return false;
    return true;
  });

  return filteredMovements.sort((a, b) => {
    const dateA = new Date(a.fechaPedido);
    const dateB = new Date(b.fechaPedido);
    return dateB - dateA;
  });
});

function performCalculation() {
  const summary = [];
  const start = new Date(startDate.value + 'T00:00:00');
  const end = new Date(endDate.value + 'T00:00:00');
  const stockPorDefecto = { "LOGIFRUIT81": 120, "BLACK4314": 80, "LOGIFRUIT316": 150, "BLACK4310": 110, "154CAJAVERDE": 95, "PURAPIÑA": 200, "ALDI1": 150, "DELMONTE": 180, "HACENDADO1": 75, "TAPAPIÑA": 250, "TARRINA97,5": 300, "MONTADA A-125": 50, "TARRINA119": 170, "TARRINA ZANAHORIA": 220, "TARRINA 1AF": 90 };
  let stockTemporal = { ...stockPorDefecto };
  for (const movement of movements.value) {
    const dateStr = movement.tipo === 'Salida' ? movement.fechaEntrega : movement.fechaPedido;
    if (!dateStr) continue;
    const movementDate = new Date(dateStr + 'T00:00:00');
    if (movementDate < start) {
      if (movement.tipo === 'Entrada') {
        movement.items.forEach(item => { stockTemporal[item.sku] = (stockTemporal[item.sku] || 0) + item.cantidad; });
      } else {
        movement.items.forEach(item => { stockTemporal[item.sku] = (stockTemporal[item.sku] || 0) - item.cantidad; });
      }
    }
  }
  let stockInicialDelPeriodo = Object.values(stockTemporal).reduce((sum, val) => sum + val, 0);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const currentDateStr = d.toISOString().slice(0, 10);
    let dailyIncomings = 0;
    let dailyOutgoings = 0;
    for (const movement of movements.value) {
      if (movement.tipo === 'Entrada' && movement.fechaPedido === currentDateStr) { dailyIncomings += movement.pallets; }
      if (movement.tipo === 'Salida' && movement.fechaEntrega === currentDateStr) { dailyOutgoings += movement.pallets; }
    }
    const stockFinalDelDia = stockInicialDelPeriodo + dailyIncomings - dailyOutgoings;
    summary.push({ date: currentDateStr, initialStock: stockInicialDelPeriodo, incomings: dailyIncomings, outgoings: dailyOutgoings, finalStock: stockFinalDelDia });
    stockInicialDelPeriodo = stockFinalDelDia;
  }
  return summary;
}

function handleCalculateSummary() {
  if (!startDate.value || !endDate.value) { alert('Selecciona un rango de fechas.'); return; }
  if (new Date(startDate.value) > new Date(endDate.value)) { alert('La fecha de inicio no puede ser posterior a la de fin.'); return; }
  summaryData.value = performCalculation();
  isSummaryModalVisible.value = true;
}

// NUEVA FUNCIÓN PARA MANEJAR LA ANULACIÓN
function handleDeleteMovement(movement) {
  if (confirm('¿Estás seguro de que quieres anular este movimiento? El stock se actualizará y esta acción no se puede deshacer.')) {
    deleteMovement(movement);
    alert('Movimiento anulado con éxito.');
  }
}
</script>

<template>
  <div>
    <h2 class="text-2xl font-bold text-gray-800 mb-4">Historial y Resumen</h2>

    <div class="p-4 bg-gray-100 rounded-lg mb-6 flex flex-col md:flex-row items-center gap-4">
      <div class="flex-1 w-full"><label>Desde</label><input type="date" v-model="startDate" class="mt-1 block w-full rounded-md border-gray-300 p-2.5 border"></div>
      <div class="flex-1 w-full"><label>Hasta</label><input type="date" v-model="endDate" class="mt-1 block w-full rounded-md border-gray-300 p-2.5 border"></div>
      <div class="flex items-end h-full"><button @click="handleCalculateSummary" class="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Calcular Resumen</button></div>
    </div>

    <h3 class="text-xl font-bold text-gray-800 mb-4">Historial de Movimientos Detallado</h3>
    <div v-if="sortedHistory.length > 0" class="space-y-4">
       <div v-for="(movement, index) in sortedHistory" :key="index" class="p-4 border border-gray-200 rounded-lg bg-gray-50 shadow-sm relative">
            
            <!-- BOTÓN DE ANULAR AÑADIDO -->
            <button 
              @click="handleDeleteMovement(movement)" 
              class="absolute top-2 right-2 px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200"
              title="Anular este movimiento"
            >
              Anular
            </button>
            
            <p class="text-sm text-gray-500"><strong>Fecha:</strong> {{ movement.tipo === 'Salida' ? movement.fechaEntrega : movement.fechaPedido }}</p>
            <p v-if="movement.tipo === 'Salida'" class="text-sm text-gray-500"><strong>Fecha de Pedido:</strong> {{ movement.fechaPedido }}</p>
            <p class="text-sm font-semibold mt-2">Movimiento: <span :class="movement.tipo === 'Salida' ? 'text-red-600' : 'text-green-600'">{{ movement.tipo }}</span></p>
            <p class="text-sm font-semibold">Total de Pallets: {{ movement.pallets }}</p>
            <div v-if="movement.items && movement.items.length > 0">
              <p class="text-gray-700 mt-2"><strong>Artículos:</strong></p>
              <ul class="list-disc list-inside text-gray-600 text-sm pl-4">
                <li v-for="(item, itemIndex) in movement.items" :key="itemIndex">{{ item.cantidad }} x {{ item.desc }} (SKU: {{ item.sku }})</li>
              </ul>
            </div>
            <p v-if="movement.comentarios" class="text-gray-700 mt-2"><strong>Comentarios:</strong> {{ movement.comentarios }}</p>
        </div>
    </div>
    <p v-else class="text-center text-gray-500">No se encontraron movimientos.</p>
  </div>

  <AppModal 
    v-if="isSummaryModalVisible" 
    title="Resumen Diario de Stock"
    @close="isSummaryModalVisible = false"
    @confirm="isSummaryModalVisible = false"
  >
    <div v-if="summaryData && summaryData.length > 0" class="overflow-x-auto">
      <table class="w-full text-sm text-left text-gray-500">
        <thead class="text-xs text-gray-700 uppercase bg-gray-50">
          <tr>
            <th class="px-4 py-2">Fecha</th>
            <th class="px-4 py-2">Inicial</th>
            <th class="px-4 py-2 text-green-600">Entradas</th>
            <th class="px-4 py-2 text-red-600">Salidas</th>
            <th class="px-4 py-2">Final</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="day in summaryData" :key="day.date" class="bg-white border-b">
            <td class="px-4 py-2 font-medium">{{ day.date }}</td>
            <td class="px-4 py-2">{{ day.initialStock }}</td>
            <td class="px-4 py-2 text-green-600">+{{ day.incomings }}</td>
            <td class="px-4 py-2 text-red-600">-{{ day.outgoings }}</td>
            <td class="px-4 py-2 font-bold">{{ day.finalStock }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else>No se encontraron datos para el resumen en el rango seleccionado.</p>
  </AppModal>
</template>