<script setup>
import { ref, computed } from 'vue';
import { useInventory } from '@/composables/useInventory';
import { useConfirm } from '@/composables/useConfirm';
import { useAuth } from '@/composables/useAuth';
import * as docx from 'docx';
import { saveAs } from 'file-saver';

const { movements, materialStock, productsWithSku, deleteMovement } = useInventory();
const { showConfirm } = useConfirm();
const { profile } = useAuth();

const startDate = ref('');
const endDate = ref('');

const filteredMovements = computed(() => {
  let movs = [...movements.value];
  if (profile?.value?.role === 'operario') {
    movs = movs.filter(m => m.tipo === 'Salida');
  }
  if (!startDate.value || !endDate.value) {
    return movs.reverse();
  }
  return movs
    .filter(m => {
      const moveDate = new Date(m.fechaEntrega);
      return moveDate >= new Date(startDate.value) && moveDate <= new Date(endDate.value);
    })
    .reverse();
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
// --- FUNCIÓN DE EXPORTACIÓN (VERSIÓN FINAL Y DEFINITIVA) ---
// ==============================================================================
async function calculateAndExport() {
  if (!startDate.value || !endDate.value) {
    alert('Por favor, selecciona un rango de fechas (Desde y Hasta) para generar el resumen.');
    return;
  }

  const COSTE_POR_MOVIMIENTO_UNITARIO = 1.75;
  const COSTE_ALMACENAJE_DIARIO_UNITARIO = 0.20;

  // Ordenamos TODOS los movimientos una sola vez al principio.
  const allMovementsSorted = [...movements.value].sort((a, b) => {
    const dateA = new Date(a.created_at || a.fechaEntrega);
    const dateB = new Date(b.created_at || b.fechaEntrega);
    return dateA - dateB;
  });

  // --- 1. CÁLCULO DE STOCK INICIAL: Reconstrucción histórica hasta el día ANTERIOR al inicio del informe ---
  const stockPorSku = {};
  if (productsWithSku.value && typeof productsWithSku.value === 'object') {
    Object.values(productsWithSku.value).forEach(p => {
      stockPorSku[p.sku] = 0;
    });
  }

  const dayBeforeStartDate = new Date(startDate.value);
  dayBeforeStartDate.setDate(dayBeforeStartDate.getDate() - 1);

  // Filtramos solo los movimientos que ocurrieron ANTES de la fecha de inicio del informe.
  const movementsBeforeReport = allMovementsSorted.filter(m => new Date(m.fechaEntrega) <= dayBeforeStartDate);

  // Aplicamos estos movimientos para obtener el estado inicial correcto.
  movementsBeforeReport.forEach(mov => {
    mov.items.forEach(item => {
      const cantidad = Number(item.cantidad) || 0;
      if (stockPorSku[item.sku] === undefined) stockPorSku[item.sku] = 0;

      if (mov.tipo === 'Entrada') stockPorSku[item.sku] += cantidad;
      else if (mov.tipo === 'Salida') stockPorSku[item.sku] -= cantidad;
      else if (mov.tipo === 'Recuento Manual' || mov.tipo === 'Ajuste') stockPorSku[item.sku] = cantidad;
    });
  });

  // --- 2. CÁLCULO DIARIO DENTRO DEL RANGO DEL INFORME ---
  const summaryData = [];
  let currentDate = new Date(startDate.value);
  const rangeEndDate = new Date(endDate.value);
  let costeTotalMovimientos = 0;
  let costeTotalAlmacenaje = 0;

  while (currentDate <= rangeEndDate) {
    const dateStr = currentDate.toISOString().slice(0, 10);
    const stockInicialDelDia = Object.values(stockPorSku).reduce((sum, qty) => sum + qty, 0);

    const movementsForDay = allMovementsSorted.filter(m => m.fechaEntrega === dateStr);

    let costIn = 0;
    let costOut = 0;
    let hasManualCount = false;

    // Aplicamos los movimientos del día para actualizar el stock.
    movementsForDay.forEach(mov => {
        if (mov.tipo === 'Entrada') mov.items.forEach(item => costIn += Number(item.cantidad) || 0);
        else if (mov.tipo === 'Salida') mov.items.forEach(item => costOut += Number(item.cantidad) || 0);
        else if (mov.tipo === 'Recuento Manual' || mov.tipo === 'Ajuste') hasManualCount = true;
        
        mov.items.forEach(item => {
            const cantidad = Number(item.cantidad) || 0;
            if (stockPorSku[item.sku] === undefined) stockPorSku[item.sku] = 0;

            if (mov.tipo === 'Recuento Manual' || mov.tipo === 'Ajuste') stockPorSku[item.sku] = cantidad;
            else stockPorSku[item.sku] += (mov.tipo === 'Entrada' ? cantidad : -cantidad);
        });
    });

    const finalStock = Object.values(stockPorSku).reduce((sum, qty) => sum + qty, 0);
    const cambioNetoDelDia = finalStock - stockInicialDelDia;
    let displayIn = cambioNetoDelDia > 0 ? cambioNetoDelDia : 0;
    let displayOut = cambioNetoDelDia < 0 ? Math.abs(cambioNetoDelDia) : 0;

    let inText = `+${displayIn}`;
    let outText = `-${displayOut}`;

    if (hasManualCount && cambioNetoDelDia !== (costIn - costOut)) {
        if (displayIn > 0) inText += " (Ajuste)";
        if (displayOut > 0) outText += " (Ajuste)";
    }
    
    const costeMovimientoDia = (costIn + costOut) * COSTE_POR_MOVIMIENTO_UNITARIO;
    const costeAlmacenajeDia = finalStock * COSTE_ALMACENAJE_DIARIO_UNITARIO;

    summaryData.push({ date: dateStr, initial: stockInicialDelDia, in: inText, out: outText, final: finalStock, costeMovimiento: costeMovimientoDia, costeAlmacenaje: costeAlmacenajeDia });
    
    costeTotalMovimientos += costeMovimientoDia;
    costeTotalAlmacenaje += costeAlmacenajeDia;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const costeTotalGeneral = costeTotalMovimientos + costeTotalAlmacenaje;
  
  // --- 3. GENERACIÓN DEL DOCUMENTO WORD ---
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
      <button v-if="profile?.value?.role !== 'operario'" @click="calculateAndExport" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 w-full">
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