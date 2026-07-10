<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { QrCodeIcon, PaperAirplaneIcon, CheckCircleIcon, NoSymbolIcon, CameraIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { user } from '../authState';
import { useInventory } from '../composables/useInventory';
import { usePicking } from '../composables/usePicking';
import { useToasts } from '../composables/useToasts';
import BarcodeScanner from '../components/BarcodeScanner.vue';

const { movements } = useInventory();
const { fetchDesde, savePicking } = usePicking();
const { showSuccess, showError, showInfo } = useToasts();

const PICKING_WEBHOOK_URL = 'https://surexportlevante.app.n8n.cloud/webhook/picking-email';
const DESTINATARIO = 'operacioneslevante@surexport.es, logisticalevante@surexport.es';
// Desde que se usa el picking (no arrastrar salidas antiguas al Picking)
const PICKING_DESDE = '2026-07-07';

const hoy = new Date().toISOString().slice(0, 10);
const hoyTxt = new Date().toLocaleDateString('es-ES');
const keyOf = (fecha, sku) => fecha + '__' + sku;
const fmtDia = (f) => new Date(f + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });

// --- Salidas candidatas: TODAS las salidas (por día + referencia) desde PICKING_DESDE ---
const candidatas = computed(() => {
  const acc = {};
  for (const m of movements.value || []) {
    if (m.tipo !== 'Salida') continue;
    const f = m.fechaPedido;
    if (!f || f < PICKING_DESDE) continue;
    for (const it of m.items || []) {
      if (!it.sku) continue;
      const k = keyOf(f, it.sku);
      if (!acc[k]) acc[k] = { key: k, fecha: f, sku: it.sku, desc: it.desc || it.sku, pallets: 0 };
      acc[k].pallets += Number(it.cantidad || 0);
    }
  }
  return Object.values(acc).filter(r => r.pallets > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.desc.localeCompare(b.desc));
});

// --- Estado de HU por referencia (clave fecha+sku). Fuente de verdad: BD ---
const estado = ref({});           // key -> { hus: string[], noHU: boolean }
const enviadoPorKey = ref({});    // key -> true si ya se envió
const dbByKey = ref({});          // key -> fila de BD
const aplicados = new Set();
let listo = false;

// En Picking solo se ven las salidas AÚN no enviadas (de cualquier día).
const pendientes = computed(() => candidatas.value.filter(r => !enviadoPorKey.value[r.key]));
const todoEnviado = computed(() => candidatas.value.length > 0 && pendientes.value.length === 0);
const totalPallets = computed(() => pendientes.value.reduce((s, r) => s + r.pallets, 0));

const fit = (arr, n) => Array.from({ length: n }, (_, i) => (arr && arr[i]) || '');

function reconciliar() {
  for (const r of candidatas.value) {
    if (!estado.value[r.key]) estado.value[r.key] = { hus: [], noHU: false };
    const e = estado.value[r.key];
    const db = dbByKey.value[r.key];
    if (db && !aplicados.has(r.key)) {
      e.hus = fit(db.hus, r.pallets);
      e.noHU = !!db.sin_hu;
      aplicados.add(r.key);
    }
    if (e.hus.length !== r.pallets) e.hus = fit(e.hus, r.pallets);
  }
}
watch(candidatas, reconciliar, { immediate: true });

onMounted(async () => {
  try {
    const filas = await fetchDesde(PICKING_DESDE);
    dbByKey.value = Object.fromEntries(filas.map(f => [keyOf(f.fecha, f.sku), f]));
    enviadoPorKey.value = Object.fromEntries(filas.filter(f => f.enviado).map(f => [keyOf(f.fecha, f.sku), true]));
    reconciliar();
  } catch (e) {
    showError('No se pudo cargar el picking guardado: ' + e.message);
  } finally {
    listo = true;
    const primera = pendientes.value.find(r => !completa(r));
    if (primera && !estado.value[primera.key].noHU) foco(primera.key, 0);
  }
});

// --- Autoguardado en BD (según se escanea) ---
function filasParaGuardar(refs, extra = {}) {
  return refs.map(r => ({
    fecha: r.fecha,
    sku: r.sku,
    referencia: r.desc,
    pallets: r.pallets,
    hus: estado.value[r.key]?.noHU ? [] : (estado.value[r.key]?.hus || []).map(h => (h || '').trim()),
    sin_hu: !!estado.value[r.key]?.noHU,
    ...extra,
  }));
}
let tGuardado = null;
watch(estado, () => {
  if (!listo || hayDuplicados.value) return; // no guardar si hay HU repetidos
  clearTimeout(tGuardado);
  tGuardado = setTimeout(() => {
    savePicking(filasParaGuardar(pendientes.value)).catch(e => console.warn('Autoguardado picking:', e.message));
  }, 800);
}, { deep: true });

// --- Foco entre casillas ---
const inputEls = {};
const setInput = (key, i) => (el) => { if (el) inputEls[`${key}_${i}`] = el; };
const foco = (key, i) => nextTick(() => inputEls[`${key}_${i}`]?.focus());

const llenas = (r) => (estado.value[r.key]?.hus || []).filter(h => (h || '').trim()).length;
const completa = (r) => {
  const e = estado.value[r.key];
  return !!e && (e.noHU || llenas(r) === r.pallets);
};
const numListas = computed(() => pendientes.value.filter(completa).length);
const todoCompleto = computed(() => pendientes.value.length > 0 && numListas.value === pendientes.value.length);

// Un HU no puede repetirse en NINGUNA referencia pendiente
function huExiste(code) {
  return pendientes.value.some(r => (estado.value[r.key]?.hus || []).some(h => (h || '').trim() === code));
}
const duplicados = computed(() => {
  const cont = {};
  for (const r of pendientes.value) {
    for (const h of (estado.value[r.key]?.hus || [])) {
      const c = (h || '').trim(); if (!c) continue;
      cont[c] = (cont[c] || 0) + 1;
    }
  }
  return new Set(Object.keys(cont).filter(k => cont[k] > 1));
});
const hayDuplicados = computed(() => duplicados.value.size > 0);

function borrarHU(r, i) {
  estado.value[r.key].hus[i] = '';
  foco(r.key, i);
}

function siguiente(r) {
  const e = estado.value[r.key];
  const vacia = e.hus.findIndex(h => !(h || '').trim());
  if (vacia !== -1) return foco(r.key, vacia);
  const sig = pendientes.value.find(x => !completa(x));
  if (sig && !estado.value[sig.key].noHU) {
    const j = estado.value[sig.key].hus.findIndex(h => !(h || '').trim());
    foco(sig.key, j === -1 ? 0 : j);
  }
}

function toggleNoHU(r) {
  const e = estado.value[r.key];
  e.noHU = !e.noHU;
  if (e.noHU) {
    const sig = pendientes.value.find(x => !completa(x));
    if (sig && !estado.value[sig.key].noHU) foco(sig.key, 0);
  } else {
    foco(r.key, 0);
  }
}

// --- Escaneo con cámara del móvil ---
const scanOpen = ref(false);
const scanKey = ref(null);
const scanRef = computed(() => pendientes.value.find(r => r.key === scanKey.value) || null);
const pingOk = ref(0);
const ultimoHU = ref('');
function abrirScanner(r) { scanKey.value = r.key; ultimoHU.value = ''; scanOpen.value = true; }
function cerrarScanner() { scanOpen.value = false; scanKey.value = null; }
function onEscaneo(code) {
  const r = scanRef.value;
  if (!r) return;
  const e = estado.value[r.key];
  if (e.noHU) return;
  const c = (code || '').trim();
  if (!c) return;
  if (huExiste(c)) { showInfo('Ese HU ya está escaneado (en esta o en otra referencia).'); return; }
  const idx = e.hus.findIndex(h => !(h || '').trim());
  if (idx === -1) return;
  e.hus[idx] = c;
  ultimoHU.value = c;
  pingOk.value++;
  if (completa(r)) { setTimeout(cerrarScanner, 700); showSuccess(`${r.desc}: completa.`); }
}

const enviando = ref(false);
async function enviar() {
  if (hayDuplicados.value) { showError('Hay HU repetidos: ' + [...duplicados.value].join(', ')); return; }
  if (!todoCompleto.value) { showError('Faltan referencias por completar.'); return; }
  enviando.value = true;
  try {
    const pend = pendientes.value;
    await savePicking(filasParaGuardar(pend));
    const payload = {
      fecha: hoyTxt,
      usuario: user.value?.email || 'desconocido',
      destinatario: DESTINATARIO,
      total_pallets: totalPallets.value,
      referencias: pend.map(r => ({
        referencia: r.desc,
        sku: r.sku,
        fecha: r.fecha,
        pallets: r.pallets,
        hus: estado.value[r.key].noHU ? 'SIN HU' : estado.value[r.key].hus.map(h => (h || '').trim()),
      })),
    };
    const res = await fetch(PICKING_WEBHOOK_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Respuesta ' + res.status);
    await savePicking(filasParaGuardar(pend, { enviado: true, enviado_at: new Date().toISOString() }));
    for (const r of pend) enviadoPorKey.value[r.key] = true;
    showSuccess('Formulario de picking enviado.');
  } catch (e) {
    showError('No se pudo enviar el formulario: ' + e.message);
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
      <QrCodeIcon class="w-8 h-8 text-brand-600" /> Picking
    </h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
      Salidas <strong>pendientes de enviar</strong>. Escanea un HU en cada casilla (con la cámara o la pistola).
      Si un material no lleva HU, pulsa <strong>"No tiene HU"</strong>. Cuando estén todas listas podrás enviar el correo.
    </p>

    <!-- Sin salidas pendientes -->
    <div v-if="candidatas.length === 0" class="bg-white dark:bg-gray-800 p-10 rounded-lg border border-gray-200 dark:border-gray-700 text-center text-gray-400">
      No hay salidas pendientes de picking.
    </div>

    <!-- Todo enviado -->
    <div v-else-if="todoEnviado" class="bg-white dark:bg-gray-800 p-10 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
      <CheckCircleIcon class="w-12 h-12 text-brandgreen-500 mx-auto mb-3" />
      <p class="text-lg font-bold text-gray-800 dark:text-white mb-1">No queda picking pendiente</p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Cuando entre un pedido nuevo aparecerá aquí. Para ver o modificar los HU, entra en el historial.
      </p>
      <router-link to="/picking-historial" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold">
        Ir a Historial Picking
      </router-link>
    </div>

    <!-- Formulario del picking pendiente -->
    <template v-else>
    <!-- Resumen -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 flex flex-wrap gap-6">
      <div>
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Pallets pendientes</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ totalPallets }}</p>
      </div>
      <div>
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Referencias</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ pendientes.length }}</p>
      </div>
      <div>
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Listas</p>
        <p class="text-2xl font-bold" :class="todoCompleto ? 'text-brandgreen-600' : 'text-brand-600'">
          {{ numListas }} / {{ pendientes.length }}
        </p>
      </div>
    </div>

    <!-- Referencias -->
    <div class="space-y-4 mb-6">
      <div
        v-for="r in pendientes"
        :key="r.key"
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border border-gray-200 dark:border-gray-700 p-4"
        :class="completa(r) ? 'border-l-brandgreen-500' : 'border-l-brand-500'"
      >
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex items-center gap-2 min-w-0">
            <CheckCircleIcon v-if="completa(r)" class="w-5 h-5 text-brandgreen-500 shrink-0" />
            <div class="min-w-0">
              <p class="font-bold text-gray-800 dark:text-white truncate">{{ r.desc }}</p>
              <p class="text-xs text-gray-400">
                {{ r.pallets }} pallets
                <span v-if="r.fecha !== hoy" class="ml-1 text-brand-600 font-semibold">· salida {{ fmtDia(r.fecha) }}</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span v-if="!estado[r.key]?.noHU"
              class="text-xs font-bold px-2 py-1 rounded"
              :class="completa(r) ? 'bg-brandgreen-100 text-brandgreen-700' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'">
              {{ llenas(r) }} / {{ r.pallets }} HU
            </span>
            <button
              v-if="!estado[r.key]?.noHU && !completa(r)"
              @click="abrirScanner(r)"
              class="text-xs font-semibold px-2 py-1 rounded border border-brand-300 text-brand-600 hover:bg-brand-50 dark:hover:bg-gray-700 flex items-center gap-1"
            >
              <CameraIcon class="w-4 h-4" /> Escanear
            </button>
            <button
              @click="toggleNoHU(r)"
              class="text-xs font-semibold px-2 py-1 rounded border flex items-center gap-1 transition-colors"
              :class="estado[r.key]?.noHU
                ? 'bg-gray-700 text-white border-gray-700'
                : 'text-gray-500 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'"
            >
              <NoSymbolIcon class="w-4 h-4" /> No tiene HU
            </button>
          </div>
        </div>

        <div v-if="!estado[r.key]?.noHU" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div v-for="(hu, i) in estado[r.key].hus" :key="i" class="flex items-center gap-2">
            <span class="text-xs font-semibold text-gray-400 w-6 text-right shrink-0">{{ i + 1 }}</span>
            <input
              :ref="setInput(r.key, i)"
              v-model="estado[r.key].hus[i]"
              type="text"
              autocomplete="off"
              :placeholder="`HU ${i + 1}`"
              @keydown.enter.prevent="siguiente(r)"
              class="flex-1 p-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              :class="(hu || '').trim() && duplicados.has((hu || '').trim()) ? 'border-red-500 bg-red-50 dark:bg-red-900/30' : ((hu || '').trim() ? 'border-brandgreen-400 bg-brandgreen-50 dark:bg-gray-700' : 'border-gray-300')"
            />
            <button v-if="(hu || '').trim()" @click="borrarHU(r, i)" class="shrink-0 text-gray-400 hover:text-brand-600 p-1" title="Borrar HU">
              <TrashIcon class="w-4 h-4" />
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-gray-400 italic">Marcada como "sin HU".</p>
      </div>
    </div>

    <!-- Aviso de HU repetidos -->
    <div v-if="hayDuplicados" class="mb-3 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-semibold px-4 py-2.5 rounded-lg">
      <NoSymbolIcon class="w-5 h-5 shrink-0 mt-0.5" />
      <span>HU repetido, revísalo antes de enviar: <span class="font-mono">{{ [...duplicados].join(', ') }}</span></span>
    </div>

    <!-- Enviar -->
    <button
      @click="enviar"
      :disabled="enviando || !todoCompleto || hayDuplicados"
      class="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-lg text-lg transition-colors"
    >
      <PaperAirplaneIcon class="w-6 h-6" />
      {{ enviando ? 'Enviando…' : (hayDuplicados ? 'HU repetido' : (todoCompleto ? 'Enviar formulario' : `Faltan ${pendientes.length - numListas} referencias`)) }}
    </button>
    </template>

    <!-- Escáner de cámara -->
    <BarcodeScanner
      :open="scanOpen"
      :titulo="scanRef ? scanRef.desc : 'Escanear'"
      :hechas="scanRef ? llenas(scanRef) : 0"
      :total="scanRef ? scanRef.pallets : 0"
      :ultimo="ultimoHU"
      :ok-signal="pingOk"
      @detected="onEscaneo"
      @close="cerrarScanner"
    />
  </div>
</template>
