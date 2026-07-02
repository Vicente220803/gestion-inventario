<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { QrCodeIcon, TrashIcon, PaperAirplaneIcon, CheckCircleIcon, NoSymbolIcon } from '@heroicons/vue/24/outline';
import { user } from '../authState';
import { useInventory } from '../composables/useInventory';
import { useToasts } from '../composables/useToasts';

const { movements } = useInventory();
const { showSuccess, showError, showInfo } = useToasts();

// TODO: pegar aquí el webhook de n8n cuando lo creemos juntos (webhook -> email).
const PICKING_WEBHOOK_URL = '';
const DESTINATARIO = 'operacioneslevante@surexport.es, logisticalevante@surexport.es';

const hoy = new Date().toISOString().slice(0, 10);
const hoyTxt = new Date().toLocaleDateString('es-ES');

// --- Salidas de hoy agrupadas por referencia (sku) ---
const salidasHoy = computed(() => {
  const acc = {};
  for (const m of movements.value || []) {
    if (m.tipo !== 'Salida') continue;
    const esHoy = m.fechaEntrega === hoy || (m.created_at || '').slice(0, 10) === hoy;
    if (!esHoy) continue;
    for (const it of m.items || []) {
      if (!it.sku) continue;
      if (!acc[it.sku]) acc[it.sku] = { sku: it.sku, desc: it.desc || it.sku, pallets: 0 };
      acc[it.sku].pallets += Number(it.cantidad || 0);
    }
  }
  return Object.values(acc).filter(r => r.pallets > 0).sort((a, b) => a.desc.localeCompare(b.desc));
});

const totalPallets = computed(() => salidasHoy.value.reduce((s, r) => s + r.pallets, 0));

// --- Estado de HU por referencia (persistido por día) ---
// { [sku]: { hus: string[], noHU: boolean } }
const claveDia = `picking_hu_${hoy}`;
const estado = ref(JSON.parse(localStorage.getItem(claveDia) || '{}'));
watch(estado, v => localStorage.setItem(claveDia, JSON.stringify(v)), { deep: true });

// Asegura una entrada por cada referencia de hoy (sin borrar lo ya escaneado)
watch(salidasHoy, (refs) => {
  for (const r of refs) {
    if (!estado.value[r.sku]) estado.value[r.sku] = { hus: [], noHU: false };
  }
}, { immediate: true });

const scan = ref({});           // sku -> texto en el input
const inputEls = {};            // sku -> elemento input
const setInput = (sku) => (el) => { if (el) inputEls[sku] = el; };
const foco = (sku) => nextTick(() => inputEls[sku]?.focus());

const completa = (r) => {
  const e = estado.value[r.sku];
  return !!e && (e.noHU || e.hus.length === r.pallets);
};
const numListas = computed(() => salidasHoy.value.filter(completa).length);
const todoCompleto = computed(() => salidasHoy.value.length > 0 && numListas.value === salidasHoy.value.length);

function siguienteIncompleta(desdeSku) {
  const refs = salidasHoy.value;
  const idx = refs.findIndex(r => r.sku === desdeSku);
  for (let i = 1; i <= refs.length; i++) {
    const r = refs[(idx + i) % refs.length];
    if (!completa(r)) return r.sku;
  }
  return null;
}

function añadirHU(r) {
  const e = estado.value[r.sku];
  if (e.noHU) return;
  const codigo = (scan.value[r.sku] || '').trim();
  scan.value[r.sku] = '';
  if (!codigo) return;
  if (e.hus.includes(codigo)) { showInfo('Ese HU ya estaba escaneado en esta referencia.'); foco(r.sku); return; }
  e.hus.push(codigo);
  // Si al añadir se completa, saltamos a la siguiente referencia pendiente
  if (completa(r)) {
    const sig = siguienteIncompleta(r.sku);
    if (sig) foco(sig); else foco(r.sku);
  } else {
    foco(r.sku);
  }
}

function borrarHU(r, i) {
  estado.value[r.sku].hus.splice(i, 1);
  foco(r.sku);
}

function toggleNoHU(r) {
  const e = estado.value[r.sku];
  e.noHU = !e.noHU;
  if (e.noHU) {
    e.hus = [];
    const sig = siguienteIncompleta(r.sku);
    if (sig) foco(sig);
  } else {
    foco(r.sku);
  }
}

onMounted(() => {
  const primera = salidasHoy.value.find(r => !completa(r));
  if (primera) foco(primera.sku);
});

const enviando = ref(false);
async function enviar() {
  if (!todoCompleto.value) { showError('Faltan referencias por completar.'); return; }
  if (!PICKING_WEBHOOK_URL) {
    showInfo('El envío por correo se configurará con n8n (pendiente). Los datos se mantienen.');
    return;
  }
  enviando.value = true;
  try {
    const payload = {
      fecha: hoyTxt,
      usuario: user.value?.email || 'desconocido',
      destinatario: DESTINATARIO,
      total_pallets: totalPallets.value,
      referencias: salidasHoy.value.map(r => ({
        referencia: r.desc,
        sku: r.sku,
        pallets: r.pallets,
        hus: estado.value[r.sku].noHU ? 'SIN HU' : estado.value[r.sku].hus,
      })),
    };
    const res = await fetch(PICKING_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Respuesta ' + res.status);
    showSuccess('Formulario de picking enviado.');
    estado.value = {};
    localStorage.removeItem(claveDia);
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
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
      Salidas de <strong>hoy ({{ hoyTxt }})</strong>. Escanea los HU de cada referencia con la pistola.
      Si un material no lleva HU, pulsa <strong>"No tiene HU"</strong>. Cuando estén todas listas podrás enviar el correo.
    </p>

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
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border border-gray-200 dark:border-gray-700"
        :class="completa(r) ? 'border-l-brandgreen-500' : 'border-l-brand-500'"
      >
        <div class="p-4">
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
                {{ estado[r.sku]?.hus.length || 0 }} / {{ r.pallets }} HU
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

          <!-- Escaneo de HU (oculto si no tiene HU) -->
          <div v-if="!estado[r.sku]?.noHU">
            <form @submit.prevent="añadirHU(r)">
              <input
                :ref="setInput(r.sku)"
                v-model="scan[r.sku]"
                type="text"
                autocomplete="off"
                :placeholder="`Escanea HU de ${r.desc}…`"
                class="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </form>
            <div v-if="estado[r.sku]?.hus.length" class="flex flex-wrap gap-2 mt-3">
              <span
                v-for="(hu, i) in estado[r.sku].hus"
                :key="i"
                class="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 text-sm font-mono text-gray-700 dark:text-gray-100"
              >
                {{ hu }}
                <button @click="borrarHU(r, i)" class="text-gray-400 hover:text-brand-600"><TrashIcon class="w-3.5 h-3.5" /></button>
              </span>
            </div>
          </div>
          <p v-else class="text-sm text-gray-400 italic">Marcada como "sin HU".</p>
        </div>
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
      {{ enviando ? 'Enviando…' : (todoCompleto ? 'Enviar formulario' : `Faltan ${salidasHoy.length - numListas} referencias`) }}
    </button>
  </div>
</template>
