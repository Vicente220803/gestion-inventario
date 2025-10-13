<script setup>
import { ref, computed } from 'vue';
import { useInventory } from '../composables/useInventory'; // Asumiendo que la ruta es así
import { useConfirm } from '../composables/useConfirm';
import { profile } from '../authState'; // <-- CORRECCIÓN: Importamos desde authState
import * as docx from 'docx';
import { saveAs } from 'file-saver';

const { movements, productsWithSku, deleteMovement } = useInventory();
const { showConfirm } = useConfirm();
// const { profile } = useAuth(); // <-- LÍNEA ELIMINADA

const startDate = ref('');
const endDate = ref('');

const filteredMovements = computed(() => {
  let movs = movements.value;
  if (profile?.value?.role === 'operario') {
    movs = movs.filter(m => m.tipo === 'Salida');
  }
  if (startDate.value && endDate.value) {
    return movs.filter(m => {
      const moveDate = new Date(m.created_at);
      const start = new Date(startDate.value + 'T00:00:00');
      const end = new Date(endDate.value + 'T23:59:59');
      return moveDate >= start && moveDate <= end;
    });
  }
  return movs;
});

function handleDelete(movement) {
  showConfirm(
    'Anular Movimiento',
    `¿Estás seguro de que quieres anular este movimiento?`,
    () => {
      deleteMovement(movement.id, movement.tipo, movement.items);
    }
  );
}

// ==============================================================================
// --- FUNCIÓN DE EXPORTACIÓN (LÓGICA DE AJUSTES CORREGIDA) ---
// ==============================================================================
async function calculateAndExport() {
  if (!startDate.value || !endDate.value) {
    alert('Por favor, selecciona un rango de fechas (Desde y Hasta) para generar el resumen.');
    return;
  }

  const COSTE_POR_MOVIMIENTO_UNITARIO = 1.75;
  const COSTE_ALMACENAJE_DIARIO_UNITARIO = 0.20;

  const allMovementsSorted = [...movements.value].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const runningStockState = {};
  Object.values(productsWithSku.value).forEach(p => { runningStockState[p.sku] = 0; });

  const dayBeforeStartDate = new Date(startDate.value);
  dayBeforeStartDate.setDate(dayBeforeStartDate.getDate() - 1);
  dayBeforeStartDate.setHours(23, 59, 59, 999);

  const movementsBeforeReport = allMovementsSorted.filter(m => new Date(m.created_at) <= dayBeforeStartDate);

  movementsBeforeReport.forEach(mov => {
    (mov.items || []).forEach(item => {
      runningStockState[item.sku] = runningStockState[item.sku] || 0;
      if (mov.tipo === 'Entrada') {
        runningStockState[item.sku] += Number(item.cantidad || 0);
      } else if (mov.tipo === 'Salida') {
        runningStockState[item.sku] -= Number(item.cantidad || 0);
      } else if (['Ajuste', 'Recuento Manual'].includes(mov.tipo)) {
        runningStockState[item.sku] = Number(item.cantidad_nueva ?? item.cantidad ?? 0);
      }
    });
  });

  const summaryData = [];
  let currentDate = new Date(startDate.value);
  const rangeEndDate = new Date(endDate.value);
  let costeTotalMovimientos = 0;
  let costeTotalAlmacenaje = 0;

  while (currentDate <= rangeEndDate) {
    const dateStr = currentDate.toISOString().slice(0, 10);
    
    const stockInicialDelDia = Object.values(runningStockState).reduce((sum, qty) => sum + qty, 0);

    const movementsForDay = allMovementsSorted.filter(m => {
      const effectiveDate = m.tipo === 'Salida' ? m.fechaEntrega : m.created_at.slice(0, 10);
      return effectiveDate === dateStr;
    });
    
    let totalIn = 0;
    let totalOut = 0;

    movementsForDay.forEach(mov => {
      (mov.items || []).forEach(item => {
        runningStockState[item.sku] = runningStockState[item.sku] || 0;
        if (mov.tipo === 'Entrada') {
          const cantidad = Number(item.cantidad || 0);
          runningStockState[item.sku] += cantidad;
          totalIn += cantidad;
        } else if (mov.tipo === 'Salida') {
          const cantidad = Number(item.cantidad || 0);
          runningStockState[item.sku] -= cantidad;
          totalOut += cantidad;
        } else if (['Ajuste', 'Recuento Manual'].includes(mov.tipo)) {
          runningStockState[item.sku] = Number(item.cantidad_nueva ?? item.cantidad ?? 0);
        }
      });
    });

    const stockFinalDelDia = Object.values(runningStockState).reduce((sum, qty) => sum + qty, 0);
    const costeMovimientoDia = (totalIn + totalOut) * COSTE_POR_MOVIMIENTO_UNITARIO;
    const costeAlmacenajeDia = stockFinalDelDia * COSTE_ALMACENAJE_DIARIO_UNITARIO;

    summaryData.push({
      date: dateStr,
      initial: stockInicialDelDia,
      in: `+${totalIn}`,
      out: `-${totalOut}`,
      final: stockFinalDelDia,
      fechaPedidoSalidas: movementsForDay.filter(m => m.tipo === 'Salida').map(m => new Date(m.created_at).toLocaleDateString('es-ES')).join(', '),
      costeMovimiento: costeMovimientoDia,
      costeAlmacenaje: costeAlmacenajeDia
    });
    
    costeTotalMovimientos += costeMovimientoDia;
    costeTotalAlmacenaje += costeAlmacenajeDia;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const costeTotalGeneral = costeTotalMovimientos + costeTotalAlmacenaje;
  
  try {
    const doc = new docx.Document({
      sections: [{
        children: [
          new docx.Paragraph({ text: `Resumen Diario de Stock y Costes`, heading: docx.HeadingLevel.TITLE }),
          new docx.Paragraph({ text: `Periodo: ${startDate.value} a ${endDate.value}`, heading: docx.HeadingLevel.HEADING_2 }),
          new docx.Paragraph({ text: "" }),
          new docx.Table({
            width: { size: 100, type: docx.WidthType.PERCENTAGE },
            rows: [
              new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: "Fecha", bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: "Inicial", bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: "Entradas", bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: "Salidas", bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: "Final", bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: "Fecha Pedido Salidas", bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: "Coste Mov.", bold: true })] })] }),
                  new docx.TableCell({ children: [new docx.Paragraph({ children: [new docx.TextRun({ text: "Coste Alm.", bold: true })] })] }),
                ],
              }),
              ...summaryData.map(day => new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph(day.date)] }),
                  new docx.TableCell({ children: [new docx.Paragraph(String(day.initial))] }),
                  new docx.TableCell({ children: [new docx.Paragraph(day.in)] }),
                  new docx.TableCell({ children: [new docx.Paragraph(day.out)] }),
                  new docx.TableCell({ children: [new docx.Paragraph(String(day.final))] }),
                  new docx.TableCell({ children: [new docx.Paragraph(day.fechaPedidoSalidas)] }),
                  new docx.TableCell({ children: [new docx.Paragraph(`${day.costeMovimiento.toFixed(2)} €`)] }),
                  new docx.TableCell({ children: [new docx.Paragraph(`${day.costeAlmacenaje.toFixed(2)} €`)] }),
                ],
              })),
            ],
          }),
          new docx.Paragraph({ text: "" }),
          new docx.Paragraph({ text: "Resumen de Costes del Periodo", heading: docx.HeadingLevel.HEADING_3 }),
          new docx.Paragraph({
            children: [
              new docx.TextRun({ text: "Coste Total por Movimientos (Entradas y Salidas): ", bold: true }),
              new docx.TextRun(`${costeTotalMovimientos.toFixed(2)} €`)
            ],
          }),
          new docx.Paragraph({
            children: [
              new docx.TextRun({ text: "Coste Total por Almacenaje Diario: ", bold: true }),
              new docx.TextRun(`${costeTotalAlmacenaje.toFixed(2)} €`)
            ],
          }),
          new docx.Paragraph({
            children: [
              new docx.TextRun({ text: "COSTE TOTAL GENERAL DEL PERIODO: ", bold: true, size: 28 }),
              new docx.TextRun({ text: `${costeTotalGeneral.toFixed(2)} €`, bold: true, size: 28 })
            ],
          }),
        ],
      }],
    });
    const blob = await docx.Packer.toBlob(doc);
    saveAs(blob, `Resumen_Costes_Stock_${startDate.value}_a_${endDate.value}.docx`);
  } catch (error) {
    console.error("Error al generar el documento:", error);
    alert("Ocurrió un error al generar el documento. Revisa la consola para más detalles.");
  }
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold text-gray-800">Historial y Resumen</h2>

    <div class="p-4 bg-gray-50 rounded-lg border grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
      <div>
        <label for="start-date" class="block text-sm font-medium text-gray-700">Desde</label>
        <input type="date" id="start-date" v-model="startDate" class="mt-1 block w-full p-2 border rounded-md">
      </div>
      <div>
        <label for="end-date" class="block text-sm font-medium text-gray-700">Hasta</label>
        <input type="date" id="end-date" v-model="endDate" class="mt-1 block w-full p-2 border rounded-md">
      </div>
      <button v-if="profile?.role !== 'operario'" @click="calculateAndExport" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 w-full">
        Calcular y Exportar
      </button>
    </div>

    <div>
      <h3 class="text-xl font-semibold text-gray-700 mb-4">Historial de Movimientos Detallado</h3>
      <div v-if="filteredMovements.length > 0" class="space-y-4">
        <div v-for="movement in filteredMovements" :key="movement.id" class="p-4 border rounded-lg bg-white shadow-sm relative">
          <div class="flex justify-between items-start">
            <div>
              <p class="font-bold">Fecha: <span class="font-normal">{{ movement.tipo === 'Salida' ? `${new Date(movement.created_at).toLocaleDateString('es-ES')} - ${new Date(movement.fechaEntrega).toLocaleDateString('es-ES')}` : movement.tipo === 'Sin Pedido' ? `Pedido: ${new Date(movement.fechaPedido).toLocaleDateString('es-ES')} - Entrega: ${new Date(movement.fechaEntrega).toLocaleDateString('es-ES')}` : new Date(movement.created_at).toLocaleDateString('es-ES') }}</span></p>
              <p class="font-bold">Movimiento: 
                <span :class="{'text-green-600': movement.tipo === 'Entrada', 'text-red-600': movement.tipo === 'Salida', 'text-blue-600': ['Ajuste', 'Recuento Manual'].includes(movement.tipo)}">{{ movement.tipo }}</span>
              </p>
              <p class="font-bold">Total de Pallets: <span class="font-normal">{{ movement.pallets }}</span></p>
              <div class="mt-2">
                <p class="font-bold">Artículos:</p>
                <ul class="list-disc list-inside text-sm text-gray-600">
                  <li v-for="(item, index) in movement.items" :key="index">
                    <span v-if="['Ajuste', 'Recuento Manual'].includes(movement.tipo)">
                      {{ item.desc }} (SKU: {{ item.sku }}) cambió de <strong>{{ item.cantidad_anterior }}</strong> a <strong>{{ item.cantidad_nueva }}</strong> (Diferencia: {{ item.diferencia }})
                    </span>
                    <span v-else>
                      {{ item.cantidad }} x {{ item.desc }} (SKU: {{ item.sku }})
                    </span>
                  </li>
                </ul>
              </div>
              <p v-if="movement.comentarios" class="mt-2 font-bold">Comentarios: <span class="font-normal italic">{{ movement.comentarios }}</span></p>
            </div>
            <button v-if="profile?.role === 'admin'" @click="handleDelete(movement)" class="absolute top-4 right-4 bg-red-100 text-red-700 text-xs font-bold py-1 px-3 rounded-full hover:bg-red-200">
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