<script setup>
import { ref, computed } from 'vue';
import { useInventory } from '../composables/useInventory';
import {
  CubeIcon, ArchiveBoxIcon, BanknotesIcon, ExclamationTriangleIcon,
  ArrowUpTrayIcon, ArrowDownTrayIcon, ClockIcon, ArrowTrendingUpIcon
} from '@heroicons/vue/24/outline';

const { materialStock, productsWithSku, stockConUnidades, movements, updateLeadTime, updateDiasObjetivo } = useInventory();

const UMBRAL_STOCK_BAJO = 5; // pallets

// --- Helpers ---
const fmt = (n) => Number(n || 0).toLocaleString('es-ES');
const fmt1 = (n) => Number(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 1 });
const fmtEur = (n) => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const hoy = () => new Date().toISOString().slice(0, 10);
const sumarDias = (fecha, n) => { const d = new Date(fecha); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const diasEntre = (d1, d2) => Math.max(1, Math.round((new Date(d2) - new Date(d1)) / 86400000) + 1); // inclusivo

// --- Rango de fechas ---
const desde = ref(sumarDias(hoy(), -29)); // últimos 30 días por defecto
const hasta = ref(hoy());
function preset(dias) {
  hasta.value = hoy();
  desde.value = sumarDias(hoy(), -(dias - 1));
}

const diasRango = computed(() => diasEntre(desde.value, hasta.value));
// Periodo anterior del mismo tamaño (para comparar)
const prevHasta = computed(() => sumarDias(desde.value, -1));
const prevDesde = computed(() => sumarDias(prevHasta.value, -(diasRango.value - 1)));

// sku -> { desc, precio }
const infoPorSku = computed(() => {
  const map = {};
  for (const [desc, datos] of Object.entries(productsWithSku.value || {})) {
    map[datos.sku] = { desc, precio: datos.precio_unitario || 0, leadTime: datos.lead_time ?? 7, objetivo: datos.dias_objetivo ?? 30, img: datos.url_imagen || null };
  }
  return map;
});

// --- Estado actual del inventario (misma fórmula que la pantalla de Stock) ---
// valor = unidades_totales × precio_unitario (el precio es POR UNIDAD)
const itemsInventario = computed(() => {
  const out = [];
  for (const [desc, datos] of Object.entries(productsWithSku.value || {})) {
    const sku = datos.sku;
    const pallets = Number(materialStock.value?.[sku] || 0);
    const info = stockConUnidades.value?.[sku];
    const unidadesPorPallet = datos.unidades_por_pallet || 1;
    const unidades = info?.tiene_discrepancias ? Number(info.unidades_totales || 0) : pallets * unidadesPorPallet;
    const precio = datos.precio_unitario || 0;
    out.push({ desc, sku, pallets, unidades, valor: unidades * precio });
  }
  return out;
});

const totalPallets = computed(() => itemsInventario.value.reduce((s, i) => s + i.pallets, 0));
const totalUnidades = computed(() => itemsInventario.value.reduce((s, i) => s + i.unidades, 0));
const valorTotal = computed(() => itemsInventario.value.reduce((s, i) => s + i.valor, 0));
const numProductos = computed(() => Object.keys(productsWithSku.value || {}).length);
const stockBajo = computed(() => itemsInventario.value.filter(i => i.pallets > 0 && i.pallets <= UMBRAL_STOCK_BAJO).length);
const sinStock = computed(() => itemsInventario.value.filter(i => i.pallets === 0).length);

// --- Movimientos dentro de un rango [d1, d2] ---
function movimientosEntre(d1, d2) {
  return (movements.value || []).filter(m => m.fechaEntrega && m.fechaEntrega >= d1 && m.fechaEntrega <= d2);
}
const movimientosPeriodo = computed(() => movimientosEntre(desde.value, hasta.value));

// Suma de pallets de un tipo en una lista de movimientos
function sumaPallets(movs, tipo) {
  return movs.filter(m => m.tipo === tipo).reduce((s, m) =>
    s + (m.items || []).reduce((a, i) => a + Number(i.cantidad || 0), 0), 0);
}

const totalEntradasPeriodo = computed(() => sumaPallets(movimientosPeriodo.value, 'Entrada'));
const totalSalidasPeriodo = computed(() => sumaPallets(movimientosPeriodo.value, 'Salida'));

// Periodo anterior (para comparar)
const movimientosPrevios = computed(() => movimientosEntre(prevDesde.value, prevHasta.value));
const entradasPrev = computed(() => sumaPallets(movimientosPrevios.value, 'Entrada'));
const salidasPrev = computed(() => sumaPallets(movimientosPrevios.value, 'Salida'));
const movsPrev = computed(() => movimientosPrevios.value.length);

// % de variación respecto al periodo anterior (null si no hay base)
function variacion(actual, anterior) {
  if (!anterior) return null;
  return ((actual - anterior) / anterior) * 100;
}
const varEntradas = computed(() => variacion(totalEntradasPeriodo.value, entradasPrev.value));
const varSalidas = computed(() => variacion(totalSalidasPeriodo.value, salidasPrev.value));
const varMovs = computed(() => variacion(movimientosPeriodo.value.length, movsPrev.value));

// Valor en € movido en el periodo (≈ pallets × unidades/pallet × precio/unidad)
function valorMovido(tipo) {
  let total = 0;
  for (const mov of movimientosPeriodo.value) {
    if (mov.tipo !== tipo) continue;
    for (const item of mov.items || []) {
      const datos = productsWithSku.value?.[item.desc];
      const upp = Number(item.unidades_por_pallet) || datos?.unidades_por_pallet || 1;
      const precio = infoPorSku.value[item.sku]?.precio || datos?.precio_unitario || 0;
      total += Number(item.cantidad || 0) * upp * precio;
    }
  }
  return total;
}
const valorEntradasPeriodo = computed(() => valorMovido('Entrada'));
const valorSalidasPeriodo = computed(() => valorMovido('Salida'));

// --- Rankings ---
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

// --- Previsión de compra ---
const colchon = ref(5);       // días extra de seguridad (imprevistos / picos de demanda)

// Lead time POR PRODUCTO (guardado en cada material). Editable en la tabla.
const leadEdit = ref({}); // sku -> valor en edición
function getLead(sku) {
  if (leadEdit.value[sku] !== undefined) return leadEdit.value[sku];
  return infoPorSku.value[sku]?.leadTime ?? 7;
}
function setLead(sku, val) {
  const v = Math.max(0, Math.round(Number(val) || 0));
  leadEdit.value = { ...leadEdit.value, [sku]: v };
  updateLeadTime(sku, v); // persiste en el producto
}

// Stock objetivo (días) POR PRODUCTO (guardado en cada material). Editable en la tabla.
const objEdit = ref({}); // sku -> valor en edición
function getObj(sku) {
  if (objEdit.value[sku] !== undefined) return objEdit.value[sku];
  return infoPorSku.value[sku]?.objetivo ?? 30;
}
function setObj(sku, val) {
  const v = Math.max(1, Math.round(Number(val) || 1));
  objEdit.value = { ...objEdit.value, [sku]: v };
  updateDiasObjetivo(sku, v); // persiste en el producto
}

// Pallets que SALEN de cada producto en el rango (consumo)
const consumoPorSku = computed(() => {
  const acc = {};
  for (const mov of movimientosPeriodo.value) {
    if (mov.tipo !== 'Salida') continue;
    for (const item of mov.items || []) {
      if (!item.sku) continue;
      acc[item.sku] = (acc[item.sku] || 0) + Number(item.cantidad || 0);
    }
  }
  return acc;
});

const previsionCompra = computed(() => {
  const filas = [];
  for (const [sku, consumo] of Object.entries(consumoPorSku.value)) {
    if (consumo <= 0) continue;
    const consumoDiario = consumo / diasRango.value;
    const stock = Number(materialStock.value?.[sku] || 0);
    const coberturaDias = consumoDiario > 0 ? stock / consumoDiario : Infinity;
    const lead = getLead(sku);   // lead time propio del producto
    const obj = getObj(sku);     // stock objetivo propio del producto
    // Margen real para pedir = días que te quedan menos lo que tarda en llegar
    const margen = coberturaDias - lead;
    // La compra cubre el transporte + el objetivo + el colchón de seguridad
    const sugerencia = Math.max(0, Math.ceil(consumoDiario * (lead + obj + colchon.value) - stock));
    filas.push({
      sku,
      desc: infoPorSku.value[sku]?.desc || sku,
      img: infoPorSku.value[sku]?.img || null,
      stock,
      consumoDiario,
      coberturaDias,
      lead,
      obj,
      margen,
      sugerencia,
    });
  }
  return filas.sort((a, b) => a.coberturaDias - b.coberturaDias);
});

const colorTipo = (tipo) => {
  if (tipo === 'Entrada') return 'bg-brandgreen-100 text-brandgreen-700';
  if (tipo === 'Salida') return 'bg-brand-100 text-brand-700';
  return 'bg-gray-100 text-gray-600';
};

const ultimosMovimientos = computed(() =>
  (movements.value || []).slice(0, 8).map(m => ({
    tipo: m.tipo,
    fecha: m.fechaEntrega || (m.created_at ? m.created_at.slice(0, 10) : ''),
    resumen: (m.items || []).map(i => `${fmt(i.cantidad)}× ${i.desc || i.sku}`).join(', ') || '—',
  }))
);
</script>

<template>
  <div>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Dashboard</h1>

    <!-- Selector de rango de fechas -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 flex flex-wrap items-end gap-4">
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Desde</label>
        <input type="date" v-model="desde" :max="hasta" class="p-2 border rounded text-sm dark:bg-gray-700 dark:border-gray-600" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Hasta</label>
        <input type="date" v-model="hasta" :min="desde" :max="hoy()" class="p-2 border rounded text-sm dark:bg-gray-700 dark:border-gray-600" />
      </div>
      <div class="flex gap-2">
        <button @click="preset(7)" class="px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">7 días</button>
        <button @click="preset(30)" class="px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">30 días</button>
        <button @click="preset(90)" class="px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">90 días</button>
      </div>
      <p class="text-xs text-gray-400 ml-auto">
        {{ diasRango }} días · comparado con {{ prevDesde }} → {{ prevHasta }}
      </p>
    </div>

    <!-- KPIs: estado actual del inventario (no depende del periodo) -->
    <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Estado actual del inventario</p>
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

    <!-- Resumen del periodo con comparación -->
    <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Movimiento en el periodo</p>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <div class="bg-brandgreen-50 dark:bg-gray-800 p-4 rounded-lg border border-brandgreen-100 dark:border-gray-700 flex items-center gap-3">
        <ArrowDownTrayIcon class="w-8 h-8 text-brandgreen-600 shrink-0" />
        <div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Pallets recibidos</p>
          <p class="text-2xl font-bold text-brandgreen-700 dark:text-brandgreen-100">{{ fmt(totalEntradasPeriodo) }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">≈ {{ fmtEur(valorEntradasPeriodo) }}</p>
          <p v-if="varEntradas !== null" class="text-xs font-semibold" :class="varEntradas >= 0 ? 'text-brandgreen-700' : 'text-brand-600'">
            {{ varEntradas >= 0 ? '▲' : '▼' }} {{ fmt1(Math.abs(varEntradas)) }}% vs periodo anterior
          </p>
        </div>
      </div>
      <div class="bg-brand-50 dark:bg-gray-800 p-4 rounded-lg border border-brand-100 dark:border-gray-700 flex items-center gap-3">
        <ArrowUpTrayIcon class="w-8 h-8 text-brand-600 shrink-0" />
        <div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Pallets despachados</p>
          <p class="text-2xl font-bold text-brand-700 dark:text-brand-200">{{ fmt(totalSalidasPeriodo) }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">≈ {{ fmtEur(valorSalidasPeriodo) }}</p>
          <p v-if="varSalidas !== null" class="text-xs font-semibold" :class="varSalidas >= 0 ? 'text-brandgreen-700' : 'text-brand-600'">
            {{ varSalidas >= 0 ? '▲' : '▼' }} {{ fmt1(Math.abs(varSalidas)) }}% vs periodo anterior
          </p>
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <ClockIcon class="w-8 h-8 text-gray-400 shrink-0" />
        <div>
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Movimientos</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ fmt(movimientosPeriodo.length) }}</p>
          <p v-if="varMovs !== null" class="text-xs font-semibold" :class="varMovs >= 0 ? 'text-brandgreen-700' : 'text-brand-600'">
            {{ varMovs >= 0 ? '▲' : '▼' }} {{ fmt1(Math.abs(varMovs)) }}% vs periodo anterior
          </p>
        </div>
      </div>
    </div>

    <!-- Rankings -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

    <!-- Previsión de compra -->
    <div class="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 class="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <ArrowTrendingUpIcon class="w-5 h-5 text-brand-600" /> Previsión de compra
        </h2>
        <label class="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
          Colchón
          <input type="number" v-model.number="colchon" min="0" class="w-16 p-1 border rounded text-center text-sm dark:bg-gray-700 dark:border-gray-600" />
          días
        </label>
      </div>
      <p class="text-xs text-gray-400 mb-4">
        Estimación según el consumo (salidas) del rango. El <strong>lead time</strong> (días que tarda en llegar) y el
        <strong>objetivo</strong> (días de stock que quieres tener) son editables en cada fila y se guardan en el producto.
        El <strong>colchón</strong> es un margen de seguridad común para imprevistos.
      </p>
      <div v-if="previsionCompra.length === 0" class="text-sm text-gray-400 py-4 text-center">
        No hay salidas en el rango para estimar la compra.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th class="py-2 pr-2">Producto</th>
              <th class="py-2 px-2 text-right">Stock</th>
              <th class="py-2 px-2 text-right">Consumo/día</th>
              <th class="py-2 px-2 text-right">Cobertura</th>
              <th class="py-2 px-2 text-center">Lead time</th>
              <th class="py-2 px-2 text-center">Objetivo</th>
              <th class="py-2 px-2 text-right">Margen p/ pedir</th>
              <th class="py-2 px-2 text-right">Sugerencia</th>
              <th class="py-2 pl-2 text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in previsionCompra" :key="p.desc" class="border-b border-gray-100 dark:border-gray-700">
              <td class="py-2 pr-2">
                <div class="flex items-center gap-2">
                  <img v-if="p.img" :src="p.img" :alt="p.desc" class="w-8 h-8 rounded object-cover border border-gray-200 dark:border-gray-700 shrink-0" />
                  <span v-else class="w-8 h-8 rounded bg-gray-100 dark:bg-gray-700 shrink-0"></span>
                  <span class="text-gray-700 dark:text-gray-200">{{ p.desc }}</span>
                </div>
              </td>
              <td class="py-2 px-2 text-right">{{ fmt(p.stock) }}</td>
              <td class="py-2 px-2 text-right">{{ fmt1(p.consumoDiario) }}</td>
              <td class="py-2 px-2 text-right text-gray-600 dark:text-gray-300">
                {{ fmt(Math.floor(p.coberturaDias)) }} días
              </td>
              <td class="py-2 px-2 text-center">
                <input
                  type="number" min="0" :value="p.lead"
                  @change="setLead(p.sku, $event.target.value)"
                  class="w-14 p-1 border rounded text-center text-sm dark:bg-gray-700 dark:border-gray-600"
                />
              </td>
              <td class="py-2 px-2 text-center">
                <input
                  type="number" min="1" :value="p.obj"
                  @change="setObj(p.sku, $event.target.value)"
                  class="w-14 p-1 border rounded text-center text-sm dark:bg-gray-700 dark:border-gray-600"
                />
              </td>
              <td class="py-2 px-2 text-right font-semibold" :class="p.margen <= colchon ? 'text-brand-600' : (p.margen <= colchon + 3 ? 'text-amber-600' : 'text-gray-600 dark:text-gray-300')">
                {{ p.margen <= 0 ? 'tarde' : fmt(Math.floor(p.margen)) + ' días' }}
              </td>
              <td class="py-2 px-2 text-right font-bold" :class="(p.sugerencia > 0 && (p.margen <= colchon || p.coberturaDias < p.obj)) ? 'text-brand-700 dark:text-brand-200' : 'text-gray-400'">
                {{ p.sugerencia > 0 ? fmt(p.sugerencia) + ' pallets' : '—' }}
              </td>
              <td class="py-2 pl-2 text-center">
                <span v-if="p.margen <= colchon" class="text-xs font-bold px-2 py-0.5 rounded bg-brand-600 text-white">Pedir YA</span>
                <span v-else-if="p.coberturaDias < p.obj" class="text-xs font-bold px-2 py-0.5 rounded bg-brand-100 text-brand-700">Pedir</span>
                <span v-else class="text-xs font-bold px-2 py-0.5 rounded bg-brandgreen-100 text-brandgreen-700">OK</span>
              </td>
            </tr>
          </tbody>
        </table>
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
