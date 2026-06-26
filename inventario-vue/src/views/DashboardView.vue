<script setup>
import { ref, computed } from 'vue';
import { useInventory } from '../composables/useInventory';
import {
  CubeIcon, ArchiveBoxIcon, BanknotesIcon, ExclamationTriangleIcon,
  ArrowUpTrayIcon, ArrowDownTrayIcon, ClockIcon
} from '@heroicons/vue/24/outline';

const { materialStock, productsWithSku, stockConUnidades, movements } = useInventory();

const UMBRAL_STOCK_BAJO = 5; // pallets

// periodo seleccionado para los rankings
const periodo = ref('semana'); // 'semana' | 'mes'
const diasPeriodo = computed(() => (periodo.value === 'semana' ? 7 : 30));

// --- Helpers ---
const fmt = (n) => Number(n || 0).toLocaleString('es-ES');
const fmtEur = (n) => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

// sku -> { desc, precio }
const infoPorSku = computed(() => {
  const map = {};
  for (const [desc, datos] of Object.entries(productsWithSku.value || {})) {
    map[datos.sku] = { desc, precio: datos.precio_unitario || 0 };
  }
  return map;
});

// --- KPIs ---
const totalPallets = computed(() =>
  Object.values(materialStock.value || {}).reduce((s, c) => s + Number(c || 0), 0)
);
const totalUnidades = computed(() =>
  Object.values(stockConUnidades.value || {}).reduce((s, x) => s + Number(x.unidades_totales || 0), 0)
);
const valorTotal = computed(() => {
  let total = 0;
  for (const [sku, cantidad] of Object.entries(materialStock.value || {})) {
    total += Number(cantidad || 0) * (infoPorSku.value[sku]?.precio || 0);
  }
  return total;
});
const numProductos = computed(() => Object.keys(productsWithSku.value || {}).length);
const stockBajo = computed(() =>
  Object.values(materialStock.value || {}).filter(c => Number(c) > 0 && Number(c) <= UMBRAL_STOCK_BAJO).length
);
const sinStock = computed(() =>
  Object.values(materialStock.value || {}).filter(c => Number(c) === 0).length
);

// --- Movimientos del periodo ---
const fechaCorte = computed(() => {
  const d = new Date();
  d.setDate(d.getDate() - diasPeriodo.value);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
});

const movimientosPeriodo = computed(() =>
  (movements.value || []).filter(m => m.fechaEntrega && m.fechaEntrega >= fechaCorte.value)
);

// Agrega pallets por descripción para un tipo de movimiento dado
function ranking(tipo) {
  const acc = {};
  for (const mov of movimientosPeriodo.value) {
    if (mov.tipo !== tipo) continue;
    for (const item of mov.items || []) {
      const nombre = item.desc || infoPorSku.value[item.sku]?.desc || item.sku || '—';
      acc[nombre] = (acc[nombre] || 0) + Number(item.cantidad || 0);
    }
  }
  return Object.entries(acc)
    .map(([desc, pallets]) => ({ desc, pallets }))
    .filter(r => r.pallets > 0)
    .sort((a, b) => b.pallets - a.pallets)
    .slice(0, 6);
}

const topSalidas = computed(() => ranking('Salida'));
const topEntradas = computed(() => ranking('Entrada'));
const maxSalidas = computed(() => Math.max(1, ...topSalidas.value.map(r => r.pallets)));
const maxEntradas = computed(() => Math.max(1, ...topEntradas.value.map(r => r.pallets)));

const totalEntradasPeriodo = computed(() =>
  movimientosPeriodo.value.filter(m => m.tipo === 'Entrada').reduce((s, m) =>
    s + (m.items || []).reduce((a, i) => a + Number(i.cantidad || 0), 0), 0)
);
const totalSalidasPeriodo = computed(() =>
  movimientosPeriodo.value.filter(m => m.tipo === 'Salida').reduce((s, m) =>
    s + (m.items || []).reduce((a, i) => a + Number(i.cantidad || 0), 0), 0)
);

// --- Últimos movimientos ---
const ultimosMovimientos = computed(() =>
  (movements.value || []).slice(0, 8).map(m => ({
    tipo: m.tipo,
    fecha: m.fechaEntrega || (m.created_at ? m.created_at.slice(0, 10) : ''),
    resumen: (m.items || []).map(i => `${fmt(i.cantidad)}× ${i.desc || i.sku}`).join(', ') || '—',
  }))
);

const colorTipo = (tipo) => {
  if (tipo === 'Entrada') return 'bg-brandgreen-100 text-brandgreen-700';
  if (tipo === 'Salida') return 'bg-brand-100 text-brand-700';
  return 'bg-gray-100 text-gray-600';
};
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      <div class="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden self-start">
        <button
          @click="periodo = 'semana'"
          :class="periodo === 'semana' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'"
          class="px-4 py-1.5 text-sm font-semibold transition-colors"
        >Última semana</button>
        <button
          @click="periodo = 'mes'"
          :class="periodo === 'mes' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'"
          class="px-4 py-1.5 text-sm font-semibold transition-colors"
        >Último mes</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3">
          <CubeIcon class="w-7 h-7 text-brand-600 shrink-0" />
          <div>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Total Pallets</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ fmt(totalPallets) }}</p>
          </div>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3">
          <ArchiveBoxIcon class="w-7 h-7 text-brandgreen-600 shrink-0" />
          <div>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Total Unidades</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ fmt(totalUnidades) }}</p>
          </div>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3">
          <BanknotesIcon class="w-7 h-7 text-brandgreen-600 shrink-0" />
          <div>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Valor Inventario</p>
            <p class="text-xl font-bold text-gray-900 dark:text-white">{{ fmtEur(valorTotal) }}</p>
          </div>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3">
          <CubeIcon class="w-7 h-7 text-gray-400 shrink-0" />
          <div>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Nº Productos</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ fmt(numProductos) }}</p>
          </div>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3">
          <ExclamationTriangleIcon class="w-7 h-7 text-amber-500 shrink-0" />
          <div>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Stock bajo / agotado</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ fmt(stockBajo) }} <span class="text-sm font-medium text-gray-400">/ {{ fmt(sinStock) }}</span></p>
          </div>
        </div>
      </div>
    </div>

    <!-- Resumen del periodo -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <div class="bg-brandgreen-50 dark:bg-gray-800 p-4 rounded-lg border border-brandgreen-100 dark:border-gray-700 flex items-center gap-3">
        <ArrowDownTrayIcon class="w-8 h-8 text-brandgreen-600" />
        <div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Pallets recibidos ({{ periodo }})</p>
          <p class="text-2xl font-bold text-brandgreen-700 dark:text-brandgreen-100">{{ fmt(totalEntradasPeriodo) }}</p>
        </div>
      </div>
      <div class="bg-brand-50 dark:bg-gray-800 p-4 rounded-lg border border-brand-100 dark:border-gray-700 flex items-center gap-3">
        <ArrowUpTrayIcon class="w-8 h-8 text-brand-600" />
        <div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Pallets despachados ({{ periodo }})</p>
          <p class="text-2xl font-bold text-brand-700 dark:text-brand-200">{{ fmt(totalSalidasPeriodo) }}</p>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <ClockIcon class="w-8 h-8 text-gray-400" />
        <div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Movimientos ({{ periodo }})</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ fmt(movimientosPeriodo.length) }}</p>
        </div>
      </div>
    </div>

    <!-- Rankings -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Más despachado -->
      <div class="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <ArrowUpTrayIcon class="w-5 h-5 text-brand-600" /> Lo más despachado
        </h2>
        <div v-if="topSalidas.length === 0" class="text-sm text-gray-400 py-6 text-center">Sin salidas en este periodo.</div>
        <div v-for="(r, i) in topSalidas" :key="r.desc" class="mb-3">
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-700 dark:text-gray-200 truncate pr-2">{{ i + 1 }}. {{ r.desc }}</span>
            <span class="font-bold text-gray-900 dark:text-white whitespace-nowrap">{{ fmt(r.pallets) }} pallets</span>
          </div>
          <div class="h-2 bg-gray-100 dark:bg-gray-700 rounded">
            <div class="h-2 bg-brand-600 rounded" :style="{ width: (r.pallets / maxSalidas * 100) + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- Más recibido -->
      <div class="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <ArrowDownTrayIcon class="w-5 h-5 text-brandgreen-600" /> Lo más recibido
        </h2>
        <div v-if="topEntradas.length === 0" class="text-sm text-gray-400 py-6 text-center">Sin entradas en este periodo.</div>
        <div v-for="(r, i) in topEntradas" :key="r.desc" class="mb-3">
          <div class="flex justify-between text-sm mb-1">
            <span class="text-gray-700 dark:text-gray-200 truncate pr-2">{{ i + 1 }}. {{ r.desc }}</span>
            <span class="font-bold text-gray-900 dark:text-white whitespace-nowrap">{{ fmt(r.pallets) }} pallets</span>
          </div>
          <div class="h-2 bg-gray-100 dark:bg-gray-700 rounded">
            <div class="h-2 bg-brandgreen-600 rounded" :style="{ width: (r.pallets / maxEntradas * 100) + '%' }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Últimos movimientos -->
    <div class="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-bold text-gray-800 dark:text-white mb-4">Últimos movimientos</h2>
      <div v-if="ultimosMovimientos.length === 0" class="text-sm text-gray-400 py-4 text-center">Aún no hay movimientos.</div>
      <ul class="divide-y divide-gray-100 dark:divide-gray-700">
        <li v-for="(m, i) in ultimosMovimientos" :key="i" class="py-2.5 flex items-center gap-3">
          <span :class="colorTipo(m.tipo)" class="text-xs font-bold px-2 py-0.5 rounded shrink-0 w-20 text-center">{{ m.tipo }}</span>
          <span class="text-xs text-gray-400 w-24 shrink-0">{{ m.fecha }}</span>
          <span class="text-sm text-gray-700 dark:text-gray-200 truncate flex-1">{{ m.resumen }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
