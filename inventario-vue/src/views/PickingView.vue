<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { QrCodeIcon, PaperAirplaneIcon, CheckCircleIcon, NoSymbolIcon } from '@heroicons/vue/24/outline';
import { user } from '../authState';
import { useInventory } from '../composables/useInventory';
import { usePicking } from '../composables/usePicking';
import { useToasts } from '../composables/useToasts';

const { movements } = useInventory();
const { fetchByFecha, savePicking } = usePicking();
const { showSuccess, showError, showInfo } = useToasts();

const PICKING_WEBHOOK_URL = 'https://surexportlevante.app.n8n.cloud/webhook/picking-email';
// EN PRUEBAS: se envía solo a Vicente. Volver a operaciones+logística al terminar.
const DESTINATARIO = 'vicentemarco@surexport.es';

const hoy = new Date().toISOString().slice(0, 10);
const hoyTxt = new Date().toLocaleDateString('es-ES');

// --- Salidas de hoy agrupadas por referencia (sku) ---
const salidasHoy = computed(() => {
  const acc = {};
  for (const m of movements.value || []) {
    if (m.tipo !== 'Salida') continue;
    if (m.fechaPedido !== hoy) continue; // la salida hecha hoy (avanza solo cada día)
    for (const it of m.items || []) {
      if (!it.sku) continue;
      if (!acc[it.sku]) acc[it.sku] = { sku: it.sku, desc: it.desc || it.sku, pallets: 0 };
      acc[it.sku].pallets += Number(it.cantidad || 0);
    }
  }
  return Object.values(acc).filter(r => r.pallets > 0).sort((a, b) => a.desc.localeCompare(b.desc));
});

const totalPallets = computed(() => salidasHoy.value.reduce((s, r) => s + r.pallets, 0));

// --- Estado de HU por referencia (fuente de verdad: BD) ---
const estado = ref({});          // sku -> { hus: string[], noHU: boolean }
const enviadoHoy = ref(false);
const dbHoy = ref({});           // sku -> fila de BD
const aplicados = new Set();     // skus cuyo dato de BD ya se volcó al estado
let listo = false;               // no autoguardar hasta cargar la BD

const fit = (arr, n) => Array.from({ length: n }, (_, i) => (arr && arr[i]) || '');

function reconciliar() {
  for (const r of salidasHoy.value) {
    if (!estado.value[r.sku]) estado.value[r.sku] = { hus: [], noHU: false };
    const e = estado.value[r.sku];
    const db = dbHoy.value[r.sku];
    if (db && !aplicados.has(r.sku)) {
      e.hus = fit(db.hus, r.pallets);
      e.noHU = !!db.sin_hu;
      aplicados.add(r.sku);
    }
    if (e.hus.length !== r.pallets) e.hus = fit(e.hus, r.pallets);
  }
}
watch(salidasHoy, reconciliar, { immediate: true });

onMounted(async () => {
  try {
    const filas = await fetchByFecha(hoy);
    dbHoy.value = Object.fromEntries(filas.map(f => [f.sku, f]));
    enviadoHoy.value = filas.some(f => f.enviado);
    reconciliar();
  } catch (e) {
    showError('No se pudo cargar el picking guardado: ' + e.message);
  } finally {
    listo = true;
    const primera = salidasHoy.value.find(r => !completa(r));
    if (primera && !estado.value[primera.sku].noHU) foco(primera.sku, 0);
  }
});

// --- Autoguardado en BD (según se escanea) ---
function filasParaGuardar(extra = {}) {
  return salidasHoy.value.map(r => ({
    fecha: hoy,
    sku: r.sku,
    referencia: r.desc,
    pallets: r.pallets,
    hus: estado.value[r.sku]?.noHU ? [] : (estado.value[r.sku]?.hus || []).map(h => (h || '').trim()),
    sin_hu: !!estado.value[r.sku]?.noHU,
    ...extra,
  }));
}
let tGuardado = null;
watch(estado, () => {
  if (!listo) return;
  clearTimeout(tGuardado);
  tGuardado = setTimeout(() => {
    savePicking(filasParaGuardar()).catch(e => console.warn('Autoguardado picking:', e.message));
  }, 800);
}, { deep: true });

// --- Foco entre casillas ---
const inputEls = {};
const setInput = (sku, i) => (el) => { if (el) inputEls[`${sku}_${i}`] = el; };
const foco = (sku, i) => nextTick(() => inputEls[`${sku}_${i}`]?.focus());

const llenas = (r) => (estado.value[r.sku]?.hus || []).filter(h => (h || '').trim()).length;
const completa = (r) => {
  const e = estado.value[r.sku];
  return !!e && (e.noHU || llenas(r) === r.pallets);
};
const numListas = computed(() => salidasHoy.value.filter(completa).length);
const todoCompleto = computed(() => salidasHoy.value.length > 0 && numListas.value === salidasHoy.value.length);

function siguiente(r) {
  const e = estado.value[r.sku];
  const vacia = e.hus.findIndex(h => !(h || '').trim());
  if (vacia !== -1) return foco(r.sku, vacia);
  const sig = salidasHoy.value.find(x => !completa(x));
  if (sig && !estado.value[sig.sku].noHU) {
    const j = estado.value[sig.sku].hus.findIndex(h => !(h || '').trim());
    foco(sig.sku, j === -1 ? 0 : j);
  }
}

function toggleNoHU(r) {
  const e = estado.value[r.sku];
  e.noHU = !e.noHU;
  if (e.noHU) {
    const sig = salidasHoy.value.find(x => !completa(x));
    if (sig && !estado.value[sig.sku].noHU) foco(sig.sku, 0);
  } else {
    foco(r.sku, 0);
  }
}

const enviando = ref(false);
async function enviar() {
  if (!todoCompleto.value) { showError('Faltan referencias por completar.'); return; }
  enviando.value = true;
  try {
    // 1) Guardar los HU (por si el correo falla, el registro queda)
    await savePicking(filasParaGuardar());
    // 2) Enviar el correo
    const payload = {
      fecha: hoyTxt,
      usuario: user.value?.email || 'desconocido',
      destinatario: DESTINATARIO,
      total_pallets: totalPallets.value,
      referencias: salidasHoy.value.map(r => ({
        referencia: r.desc,
        sku: r.sku,
        pallets: r.pallets,
        hus: estado.value[r.sku].noHU ? 'SIN HU' : estado.value[r.sku].hus.map(h => (h || '').trim()),
      })),
    };
    const res = await fetch(PICKING_WEBHOOK_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Respuesta ' + res.status);
    // 3) Marcar como enviado en BD (se conservan los HU, queda editable)
    await savePicking(filasParaGuardar({ enviado: true, enviado_at: new Date().toISOString() }));
    enviadoHoy.value = true;
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
      Salidas de <strong>hoy ({{ hoyTxt }})</strong>. Escanea un HU en cada casilla con la pistola.
      Si un material no lleva HU, pulsa <strong>"No tiene HU"</strong>. Cuando estén todas listas podrás enviar el correo.
    </p>

    <!-- Banner enviado -->
    <div v-if="enviadoHoy" class="mb-4 flex items-center gap-2 bg-brandgreen-50 dark:bg-gray-800 border border-brandgreen-200 dark:border-gray-700 text-brandgreen-700 dark:text-brandgreen-200 text-sm font-semibold px-4 py-2.5 rounded-lg">
      <CheckCircleIcon class="w-5 h-5" /> Picking de hoy enviado. Puedes seguir editando y reenviar si hace falta.
    </div>

    <!-- Resumen -->
    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 flex flex-wrap gap-6">
      <div>
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Pallets de hoy</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ totalPallets }}</p>
      </div>
      <div>
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Referencias</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ salidasHoy.length }}</p>
      </div>
      <div>
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Listas</p>
        <p class="text-2xl font-bold" :class="todoCompleto ? 'text-brandgreen-600' : 'text-brand-600'">
          {{ numListas }} / {{ salidasHoy.length }}
        </p>
      </div>
    </div>

    <!-- Sin salidas -->
    <div v-if="salidasHoy.length === 0" class="bg-white dark:bg-gray-800 p-10 rounded-lg border border-gray-200 dark:border-gray-700 text-center text-gray-400">
      Hoy todavía no hay salidas registradas.
    </div>

    <!-- Referencias -->
    <div v-else class="space-y-4 mb-6">
      <div
        v-for="r in salidasHoy"
        :key="r.sku"
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border border-gray-200 dark:border-gray-700 p-4"
        :class="completa(r) ? 'border-l-brandgreen-500' : 'border-l-brand-500'"
      >
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex items-center gap-2 min-w-0">
            <CheckCircleIcon v-if="completa(r)" class="w-5 h-5 text-brandgreen-500 shrink-0" />
            <div class="min-w-0">
              <p class="font-bold text-gray-800 dark:text-white truncate">{{ r.desc }}</p>
              <p class="text-xs text-gray-400">{{ r.pallets }} pallets</p>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span v-if="!estado[r.sku]?.noHU"
              class="text-xs font-bold px-2 py-1 rounded"
              :class="completa(r) ? 'bg-brandgreen-100 text-brandgreen-700' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'">
              {{ llenas(r) }} / {{ r.pallets }} HU
            </span>
            <button
              @click="toggleNoHU(r)"
              class="text-xs font-semibold px-2 py-1 rounded border flex items-center gap-1 transition-colors"
              :class="estado[r.sku]?.noHU
                ? 'bg-gray-700 text-white border-gray-700'
                : 'text-gray-500 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'"
            >
              <NoSymbolIcon class="w-4 h-4" /> No tiene HU
            </button>
          </div>
        </div>

        <div v-if="!estado[r.sku]?.noHU" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div v-for="(hu, i) in estado[r.sku].hus" :key="i" class="flex items-center gap-2">
            <span class="text-xs font-semibold text-gray-400 w-6 text-right shrink-0">{{ i + 1 }}</span>
            <input
              :ref="setInput(r.sku, i)"
              v-model="estado[r.sku].hus[i]"
              type="text"
              autocomplete="off"
              :placeholder="`HU ${i + 1}`"
              @keydown.enter.prevent="siguiente(r)"
              class="flex-1 p-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              :class="(hu || '').trim() ? 'border-brandgreen-400 bg-brandgreen-50 dark:bg-gray-700' : 'border-gray-300'"
            />
          </div>
        </div>
        <p v-else class="text-sm text-gray-400 italic">Marcada como "sin HU".</p>
      </div>
    </div>

    <!-- Enviar -->
    <button
      v-if="salidasHoy.length > 0"
      @click="enviar"
      :disabled="enviando || !todoCompleto"
      class="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-lg text-lg transition-colors"
    >
      <PaperAirplaneIcon class="w-6 h-6" />
      {{ enviando ? 'Enviando…' : (todoCompleto ? (enviadoHoy ? 'Reenviar formulario' : 'Enviar formulario') : `Faltan ${salidasHoy.length - numListas} referencias`) }}
    </button>
  </div>
</template>
