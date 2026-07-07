<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { QrCodeIcon, PaperAirplaneIcon, CheckCircleIcon, NoSymbolIcon, CameraIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { user } from '../authState';
import { useInventory } from '../composables/useInventory';
import { usePicking } from '../composables/usePicking';
import { useToasts } from '../composables/useToasts';
import BarcodeScanner from '../components/BarcodeScanner.vue';

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
  if (!listo || hayDuplicados.value) return; // no guardar si hay HU repetidos
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

// Un HU no puede repetirse en NINGUNA referencia del día
function huExiste(code) {
  return salidasHoy.value.some(r => (estado.value[r.sku]?.hus || []).some(h => (h || '').trim() === code));
}
const duplicados = computed(() => {
  const cont = {};
  for (const r of salidasHoy.value) {
    for (const h of (estado.value[r.sku]?.hus || [])) {
      const c = (h || '').trim(); if (!c) continue;
      cont[c] = (cont[c] || 0) + 1;
    }
  }
  return new Set(Object.keys(cont).filter(k => cont[k] > 1));
});
const hayDuplicados = computed(() => duplicados.value.size > 0);

function borrarHU(r, i) {
  estado.value[r.sku].hus[i] = '';
  foco(r.sku, i);
}

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

// --- Escaneo con cámara del móvil ---
const scanOpen = ref(false);
const scanSku = ref(null);
const scanRef = computed(() => salidasHoy.value.find(r => r.sku === scanSku.value) || null);
const pingOk = ref(0);       // se incrementa al aceptar un HU (dispara el tick verde)
const ultimoHU = ref('');
function abrirScanner(r) { scanSku.value = r.sku; ultimoHU.value = ''; scanOpen.value = true; }
function cerrarScanner() { scanOpen.value = false; scanSku.value = null; }
function onEscaneo(code) {
  const r = scanRef.value;
  if (!r) return;
  const e = estado.value[r.sku];
  if (e.noHU) return;
  const c = (code || '').trim();
  if (!c) return;
  if (huExiste(c)) { showInfo('Ese HU ya está escaneado (en esta o en otra referencia).'); return; }
  const idx = e.hus.findIndex(h => !(h || '').trim());
  if (idx === -1) return; // ya está llena
  e.hus[idx] = c;
  ultimoHU.value = c;
  pingOk.value++;          // confirma visualmente (tick verde + vibración)
  if (completa(r)) { setTimeout(cerrarScanner, 700); showSuccess(`${r.desc}: completa.`); }
}

const enviando = ref(false);
async function enviar() {
  if (hayDuplicados.value) { showError('Hay HU repetidos: ' + [...duplicados.value].join(', ')); return; }
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

    <!-- Sin salidas -->
    <div v-if="salidasHoy.length === 0" class="bg-white dark:bg-gray-800 p-10 rounded-lg border border-gray-200 dark:border-gray-700 text-center text-gray-400">
      Hoy todavía no hay salidas registradas.
    </div>

    <!-- Ya enviado: el formulario desaparece hasta el picking del día siguiente -->
    <div v-else-if="enviadoHoy" class="bg-white dark:bg-gray-800 p-10 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
      <CheckCircleIcon class="w-12 h-12 text-brandgreen-500 mx-auto mb-3" />
      <p class="text-lg font-bold text-gray-800 dark:text-white mb-1">El picking de hoy ya se ha enviado</p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Para ver o modificar los HU, entra en el historial.
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

    <!-- Referencias -->
    <div class="space-y-4 mb-6">
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
              v-if="!estado[r.sku]?.noHU && !completa(r)"
              @click="abrirScanner(r)"
              class="text-xs font-semibold px-2 py-1 rounded border border-brand-300 text-brand-600 hover:bg-brand-50 dark:hover:bg-gray-700 flex items-center gap-1"
            >
              <CameraIcon class="w-4 h-4" /> Escanear
            </button>
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
      {{ enviando ? 'Enviando…' : (hayDuplicados ? 'HU repetido' : (todoCompleto ? 'Enviar formulario' : `Faltan ${salidasHoy.length - numListas} referencias`)) }}
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
