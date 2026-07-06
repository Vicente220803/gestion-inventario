<script setup>
import { ref, computed, onMounted } from 'vue';
import { ClipboardDocumentListIcon, ChevronDownIcon, ChevronUpIcon, CheckCircleIcon, PaperAirplaneIcon } from '@heroicons/vue/24/outline';
import { usePicking } from '../composables/usePicking';
import { useToasts } from '../composables/useToasts';
import { user } from '../authState';

const PICKING_WEBHOOK_URL = 'https://surexportlevante.app.n8n.cloud/webhook/picking-email';
const DESTINATARIO = 'operacioneslevante@surexport.es, logisticalevante@surexport.es';

const { fetchHistorial, savePicking } = usePicking();
const { showSuccess, showError } = useToasts();

const filas = ref([]);
const cargando = ref(true);
const abierto = ref(null);
const guardando = ref(false);
const reenviando = ref(false);

onMounted(async () => {
  try { filas.value = await fetchHistorial(); }
  catch (e) { showError('No se pudo cargar el historial: ' + e.message); }
  finally { cargando.value = false; }
});

const dias = computed(() => {
  const map = {};
  for (const r of filas.value) {
    if (!map[r.fecha]) map[r.fecha] = { fecha: r.fecha, refs: [], pallets: 0, enviado: true };
    map[r.fecha].refs.push(r);
    map[r.fecha].pallets += r.pallets || 0;
    if (!r.enviado) map[r.fecha].enviado = false;
  }
  return Object.values(map)
    .map(d => ({ ...d, refs: d.refs.sort((a, b) => (a.referencia || '').localeCompare(b.referencia || '')) }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
});

const fmtFecha = (f) => new Date(f + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function abrir(d) {
  if (abierto.value === d.fecha) { abierto.value = null; return; }
  // Asegura una casilla por pallet para poder editar
  for (const r of d.refs) {
    if (!Array.isArray(r.hus)) r.hus = [];
    const n = r.pallets || 0;
    while (r.hus.length < n) r.hus.push('');
    if (r.hus.length > n) r.hus.length = n;
  }
  abierto.value = d.fecha;
}

function payloadDia(d, extra = {}) {
  return d.refs.map(r => ({
    fecha: r.fecha,
    sku: r.sku,
    referencia: r.referencia,
    pallets: r.pallets,
    hus: r.sin_hu ? [] : (r.hus || []).map(h => (h || '').trim()),
    sin_hu: !!r.sin_hu,
    ...extra,
  }));
}

async function guardar(d) {
  guardando.value = true;
  try {
    await savePicking(payloadDia(d));
    showSuccess('Cambios guardados.');
  } catch (e) { showError('No se pudo guardar: ' + e.message); }
  finally { guardando.value = false; }
}

async function reenviar(d) {
  reenviando.value = true;
  try {
    await savePicking(payloadDia(d));
    const body = {
      fecha: new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-ES'),
      usuario: user.value?.email || 'desconocido',
      destinatario: DESTINATARIO,
      total_pallets: d.pallets,
      referencias: d.refs.map(r => ({
        referencia: r.referencia, sku: r.sku, pallets: r.pallets,
        hus: r.sin_hu ? 'SIN HU' : (r.hus || []).map(h => (h || '').trim()),
      })),
    };
    const res = await fetch(PICKING_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Respuesta ' + res.status);
    await savePicking(payloadDia(d, { enviado: true, enviado_at: new Date().toISOString() }));
    d.refs.forEach(r => r.enviado = true); d.enviado = true;
    showSuccess('Correo reenviado.');
  } catch (e) { showError('No se pudo reenviar: ' + e.message); }
  finally { reenviando.value = false; }
}
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
      <ClipboardDocumentListIcon class="w-8 h-8 text-brand-600" /> Historial Picking
    </h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
      Pickings por día. Abre un día para ver y <strong>modificar los HU</strong> de cada referencia y, si hace falta, <strong>reenviar el correo</strong>.
    </p>

    <div v-if="cargando" class="text-center text-gray-400 py-10">Cargando…</div>
    <div v-else-if="dias.length === 0" class="bg-white dark:bg-gray-800 p-10 rounded-lg border border-gray-200 dark:border-gray-700 text-center text-gray-400">
      Todavía no hay pickings guardados.
    </div>

    <div v-else class="space-y-3">
      <div v-for="d in dias" :key="d.fecha" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <!-- Cabecera del día -->
        <button @click="abrir(d)" class="w-full flex items-center justify-between gap-3 p-4 text-left">
          <div class="min-w-0">
            <p class="font-bold text-gray-800 dark:text-white capitalize truncate">{{ fmtFecha(d.fecha) }}</p>
            <p class="text-xs text-gray-400">{{ d.refs.length }} referencias · {{ d.pallets }} pallets</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span v-if="d.enviado" class="text-xs font-bold px-2 py-1 rounded bg-brandgreen-100 text-brandgreen-700 flex items-center gap-1">
              <CheckCircleIcon class="w-4 h-4" /> Enviado
            </span>
            <span v-else class="text-xs font-bold px-2 py-1 rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">Borrador</span>
            <ChevronUpIcon v-if="abierto === d.fecha" class="w-5 h-5 text-gray-400" />
            <ChevronDownIcon v-else class="w-5 h-5 text-gray-400" />
          </div>
        </button>

        <!-- Detalle editable -->
        <div v-if="abierto === d.fecha" class="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
          <div v-for="r in d.refs" :key="r.sku">
            <div class="flex items-center justify-between gap-2 mb-2">
              <p class="font-semibold text-gray-700 dark:text-gray-200 truncate">{{ r.referencia }} <span class="text-xs text-gray-400">({{ r.pallets }} pallets)</span></p>
              <label class="text-xs text-gray-500 flex items-center gap-1 shrink-0">
                <input type="checkbox" v-model="r.sin_hu" /> Sin HU
              </label>
            </div>
            <div v-if="!r.sin_hu" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div v-for="(hu, i) in r.hus" :key="i" class="flex items-center gap-2">
                <span class="text-xs font-semibold text-gray-400 w-6 text-right shrink-0">{{ i + 1 }}</span>
                <input
                  v-model="r.hus[i]"
                  type="text" autocomplete="off" :placeholder="`HU ${i + 1}`"
                  class="flex-1 p-2 border rounded-lg font-mono text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  :class="(hu || '').trim() ? 'border-brandgreen-400 bg-brandgreen-50 dark:bg-gray-700' : 'border-gray-300'"
                />
              </div>
            </div>
            <p v-else class="text-sm text-gray-400 italic">Sin HU.</p>
          </div>

          <div class="flex flex-wrap gap-3 pt-2">
            <button @click="guardar(d)" :disabled="guardando"
              class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40">
              {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
            </button>
            <button @click="reenviar(d)" :disabled="reenviando"
              class="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center gap-2 disabled:opacity-40">
              <PaperAirplaneIcon class="w-5 h-5" /> {{ reenviando ? 'Enviando…' : 'Reenviar correo' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
