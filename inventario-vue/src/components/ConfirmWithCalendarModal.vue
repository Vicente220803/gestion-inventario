<!-- RUTA: src/components/ConfirmWithCalendarModal.vue (CÓDIGO ACTUALIZADO) -->
<script setup>
import { ref, watch } from 'vue';
// 1. Importamos el DatePicker de la nueva librería 'v-calendar'
import { DatePicker } from 'v-calendar';
// 2. No olvides importar también su CSS para que se vea bien
import 'v-calendar/style.css';

// --- Props y Emits (Esto se queda igual) ---
const props = defineProps({
  show: Boolean,
  initialDate: String
});
const emit = defineEmits(['close', 'confirm']);

// --- Estado Interno (Ahora es más simple) ---
// 'v-calendar' funciona directamente con una variable de fecha, no necesita arrays
const selectedDate = ref(new Date());

// --- Lógica ---
// Observador para inicializar la fecha del modal cuando se abre
watch(() => props.initialDate, (newDate) => {
  if (newDate) {
    // Le sumamos la zona horaria para evitar que se muestre el día anterior
    selectedDate.value = new Date(newDate + 'T00:00:00');
  }
});

// CÓDIGO CORREGIDO Y A PRUEBA DE ZONAS HORARIAS
function confirmAction() {
  const date = selectedDate.value;

  // Obtenemos el año, mes y día LOCALES, sin conversiones
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // +1 porque los meses van de 0-11
  const day = String(date.getDate()).padStart(2, '0'); // padStart añade un '0' si es necesario (ej. 9 -> '09')

  // Construimos la fecha en el formato YYYY-MM-DD manualmente
  const formattedDate = `${year}-${month}-${day}`;

  // Emitimos la fecha correcta
  emit('confirm', formattedDate);
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center" @click.self="$emit('close')">
    <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md z-50">
      <h3 class="text-xl font-semibold mb-4">Seleccionar Fecha del Pedido</h3>
      <p class="mb-4 text-gray-600">
        Selecciona la fecha del pedido para la notificación de "Sin Pedido de Traslado". Esta fecha se registrará en el historial.
      </p>
      
      <!-- 3. Reemplazamos el componente antiguo por el nuevo DatePicker -->
      <div class="mb-6 flex justify-center">
        <DatePicker
          v-model="selectedDate"
          locale="es"
          color="indigo" 
          :is-expanded="true" 
        />
      </div>

      <!-- Botones de Acción (Sin cambios) -->
      <div class="flex justify-end space-x-4">
        <button @click="$emit('close')" class="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
        <button @click="confirmAction" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Guardar Cambios</button>
      </div>
    </div>
  </div>
</template>

<style>
/* Pequeño ajuste para que el calendario no tenga un borde que no queremos */
.vc-container {
  border: none !important;
}
</style>