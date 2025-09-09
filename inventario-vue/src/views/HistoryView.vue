<!-- RUTA: src/views/HistoryView.vue (VERSIÓN FINAL CON INFORME WORD) -->
<script setup>
import { ref, computed } from 'vue';
import { useInventory } from '../composables/useInventory';
import AppModal from '../components/AppModal.vue';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

const { movements, deleteMovement, materialStock } = useInventory(); // Importamos materialStock

const startDate = ref('');
const endDate = ref('');
const summaryData = ref(null);
const isSummaryModalVisible = ref(false);

const sortedHistory = computed(() => {
    return [...movements.value]
        .filter(movement => {
            if (!startDate.value && !endDate.value) return true;
            const movementDateStr = movement.tipo === 'Salida' ? movement.fechaEntrega : movement.fechaPedido;
            if (!movementDateStr) return false;
            const movementDate = new Date(movementDateStr + 'T00:00:00');
            const start = startDate.value ? new Date(startDate.value + 'T00:00:00') : null;
            const end = endDate.value ? new Date(endDate.value + 'T00:00:00') : null;
            if (start && movementDate < start) return false;
            if (end && movementDate > end) return false;
            return true;
        })
        .sort((a, b) => new Date(b.fechaPedido) - new Date(a.fechaPedido));
});

function performCalculation() {
    const summary = [];
    const start = new Date(startDate.value + 'T00:00:00');
    const end = new Date(endDate.value + 'T00:00:00');
    
    // Usamos el stock real guardado como punto de partida
    let stockTemporal = JSON.parse(JSON.stringify(materialStock.value));

    // Para calcular el stock al inicio del periodo, revertimos los movimientos futuros
    const futureMovements = movements.value.filter(m => {
        const dateStr = m.tipo === 'Salida' ? m.fechaEntrega : m.fechaPedido;
        return new Date(dateStr + 'T00:00:00') >= start;
    });

    for (const movement of futureMovements) {
        if (movement.tipo === 'Entrada') {
            movement.items.forEach(item => { stockTemporal[item.sku] = (stockTemporal[item.sku] || 0) - item.cantidad; });
        } else {
            movement.items.forEach(item => { stockTemporal[item.sku] = (stockTemporal[item.sku] || 0) + item.cantidad; });
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

function generateAndDownloadWord(data) {
    const totalIncomings = data.reduce((sum, day) => sum + day.incomings, 0);
    const totalOutgoings = data.reduce((sum, day) => sum + day.outgoings, 0);
    const totalStoragePallets = data.reduce((sum, day) => sum + day.finalStock, 0);

    const costIncomings = totalIncomings * 1.75;
    const costOutgoings = totalOutgoings * 1.75;
    const costStorage = totalStoragePallets * 0.20;
    const grandTotalCost = costIncomings + costOutgoings + costStorage;

    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({ text: `Informe de Inventario: ${startDate.value} a ${endDate.value}`, heading: HeadingLevel.TITLE, alignment: 'center' }),
                new Paragraph({ text: " " }),
                new Paragraph({ text: "Resumen de Movimientos y Costes", heading: HeadingLevel.HEADING_1 }),
                new Paragraph({ children: [new TextRun({ text: "Total Entradas: ", bold: true }), new TextRun(`${totalIncomings} pallets`)] }),
                new Paragraph({ children: [new TextRun({ text: "Total Salidas: ", bold: true }), new TextRun(`${totalOutgoings} pallets`)] }),
                new Paragraph({ text: " " }),
                new Paragraph({ children: [new TextRun({ text: "Coste por Entradas (a 1.75€/pallet): ", bold: true }), new TextRun(`${costIncomings.toFixed(2)} €`)] }),
                new Paragraph({ children: [new TextRun({ text: "Coste por Salidas (a 1.75€/pallet): ", bold: true }), new TextRun(`${costOutgoings.toFixed(2)} €`)] }),
                new Paragraph({ children: [new TextRun({ text: "Coste Almacenaje (0.20€ por pallet/día): ", bold: true }), new TextRun(`${costStorage.toFixed(2)} €`)] }),
                new Paragraph({ text: " " }),
                new Paragraph({ children: [new TextRun({ text: "COSTE TOTAL DEL PERIODO: ", bold: true, size: 28 }), new TextRun({ text: `${grandTotalCost.toFixed(2)} €`, bold: true, color: "FF0000", size: 28 })] }),
            ],
        }],
    });

    Packer.toBlob(doc).then(blob => {
        saveAs(blob, `Informe_Inventario_${startDate.value}_a_${endDate.value}.docx`);
    });
}

function handleCalculateSummary() {
    if (!startDate.value || !endDate.value) { alert('Selecciona un rango de fechas.'); return; }
    if (new Date(startDate.value) > new Date(endDate.value)) { alert('La fecha de inicio no puede ser posterior a la de fin.'); return; }
    
    const results = performCalculation();
    summaryData.value = results;
    
    if (results && results.length > 0) {
        generateAndDownloadWord(results);
    }
    
    isSummaryModalVisible.value = true;
}

function handleDeleteMovement(movement) {
    if (confirm('¿Estás seguro de que quieres anular este movimiento?')) {
        deleteMovement(movement);
    }
}
</script>

<template>
    <div>
        <h2 class="text-2xl font-bold text-gray-800 mb-4">Historial y Resumen</h2>
        <div class="p-4 bg-gray-100 rounded-lg mb-6 flex flex-col md:flex-row items-center gap-4">
            <div class="flex-1 w-full"><label>Desde</label><input type="date" v-model="startDate" class="mt-1 block w-full rounded-md border-gray-300 p-2.5 border"></div>
            <div class="flex-1 w-full"><label>Hasta</label><input type="date" v-model="endDate" class="mt-1 block w-full rounded-md border-gray-300 p-2.5 border"></div>
            <div class="flex items-end h-full"><button @click="handleCalculateSummary" class="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Calcular y Exportar</button></div>
        </div>
        <h3 class="text-xl font-bold text-gray-800 mb-4">Historial de Movimientos Detallado</h3>
        <div v-if="sortedHistory.length > 0" class="space-y-4">
            <div v-for="(movement, index) in sortedHistory" :key="index" class="p-4 border rounded-lg bg-gray-50 relative">
                <button @click="handleDeleteMovement(movement)" class="absolute top-2 right-2 px-2 py-1 text-xs text-red-700 bg-red-100 rounded-md">Anular</button>
                <p><strong>Fecha:</strong> {{ movement.tipo === 'Salida' ? movement.fechaEntrega : movement.fechaPedido }}</p>
                <p v-if="movement.tipo === 'Salida'"><strong>Fecha de Pedido:</strong> {{ movement.fechaPedido }}</p>
                <p>Movimiento: <span :class="movement.tipo === 'Salida' ? 'text-red-600' : 'text-green-600'">{{ movement.tipo }}</span></p>
                <p>Total de Pallets: {{ movement.pallets }}</p>
                <div v-if="movement.items.length > 0">
                    <p><strong>Artículos:</strong></p>
                    <ul><li v-for="item in movement.items" :key="item.sku">{{ item.cantidad }} x {{ item.desc }} (SKU: {{ item.sku }})</li></ul>
                </div>
                <p v-if="movement.comentarios"><strong>Comentarios:</strong> {{ movement.comentarios }}</p>
            </div>
        </div>
        <p v-else class="text-center text-gray-500">No hay movimientos.</p>
        <AppModal v-if="isSummaryModalVisible" title="Resumen Diario de Stock" @close="isSummaryModalVisible = false" @confirm="isSummaryModalVisible = false">
            <div v-if="summaryData && summaryData.length > 0" class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead><tr><th>Fecha</th><th>Inicial</th><th>Entradas</th><th>Salidas</th><th>Final</th></tr></thead>
                    <tbody><tr v-for="day in summaryData" :key="day.date"><td>{{ day.date }}</td><td>{{ day.initialStock }}</td><td>+{{ day.incomings }}</td><td>-{{ day.outgoings }}</td><td>{{ day.finalStock }}</td></tr></tbody>
                </table>
            </div>
            <p v-else>No se encontraron datos.</p>
        </AppModal>
    </div>
</template>