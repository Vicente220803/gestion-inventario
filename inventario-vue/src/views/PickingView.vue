<script setup>
import { ref, onMounted, nextTick, watch } from 'vue';
import { QrCodeIcon, TrashIcon, PaperAirplaneIcon } from '@heroicons/vue/24/outline';
import { user } from '../authState';
import { useToasts } from '../composables/useToasts';

const { showSuccess, showError, showInfo } = useToasts();

// TODO: pegar aquí el webhook de n8n cuando lo creemos juntos (webhook -> email).
// Mientras esté vacío, el botón avisa de que el envío por correo está pendiente.
const PICKING_WEBHOOK_URL = '';
const DESTINATARIO = 'operacioneslevante@surexport.es, logisticalevante@surexport.es';

// Lista de EANs escaneados hoy (persistida por si se recarga la página sin querer)
const eans = ref(JSON.parse(localStorage.getItem('picking_eans') || '[]'));
watch(eans, v => localStorage.setItem('picking_eans', JSON.stringify(v)), { deep: true });

const entrada = ref('');
const inputRef = ref(null);
const enviando = ref(false);

function foco() {
  nextTick(() => inputRef.value?.focus());
}
onMounted(foco);

// La pistola "teclea" el código y pulsa Enter -> aquí lo añadimos a la lista
function añadir() {
  const codigo = entrada.value.trim();
  entrada.value = '';
  if (!codigo) return;
  eans.value.push({ codigo, hora: new Date().toLocaleTimeString('es-ES') });
  foco();
}

function borrar(i) {
  eans.value.splice(i, 1);
  foco();
}

function vaciar() {
  if (eans.value.length && !confirm('¿Vaciar toda la lista de EANs escaneados?')) return;
  eans.value = [];
  foco();
}

async function enviar() {
  if (eans.value.length === 0) {
    showError('No has escaneado ningún EAN todavía.');
    return;
  }
  if (!PICKING_WEBHOOK_URL) {
    showInfo('El envío por correo se configurará con n8n (pendiente). La lista se mantiene.');
    return;
  }
  enviando.value = true;
  try {
    const payload = {
      fecha: new Date().toLocaleDateString('es-ES'),
      usuario: user.value?.email || 'desconocido',
      destinatario: DESTINATARIO,
      total: eans.value.length,
      eans: eans.value.map(e => e.codigo),
    };
    const res = await fetch(PICKING_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Respuesta ' + res.status);
    showSuccess(`Formulario enviado: ${eans.value.length} EANs.`);
    eans.value = [];
    foco();
  } catch (e) {
    showError('No se pudo enviar el formulario: ' + e.message);
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
      <QrCodeIcon class="w-8 h-8 text-brand-600" /> Picking
    </h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
      Escanea los EAN con la pistola. Cada lectura se añade a la lista. Al terminar, pulsa
      <strong>Enviar formulario</strong> y llegará el correo a operaciones y logística.
    </p>

    <!-- Campo de escaneo -->
    <form @submit.prevent="añadir" class="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Escanear EAN</label>
      <input
        ref="inputRef"
        v-model="entrada"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        placeholder="Dispara con la pistola aquí…"
        class="w-full p-3 text-lg border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      />
      <p class="text-xs text-gray-400 mt-1">También puedes teclearlo y pulsar Enter.</p>
    </form>

    <!-- Lista -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
      <div class="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
        <h2 class="font-bold text-gray-800 dark:text-white">
          Escaneados hoy: <span class="text-brand-600">{{ eans.length }}</span>
        </h2>
        <button
          v-if="eans.length"
          @click="vaciar"
          class="text-xs font-semibold text-gray-500 hover:text-brand-600 flex items-center gap-1"
        >
          <TrashIcon class="w-4 h-4" /> Vaciar
        </button>
      </div>
      <div v-if="eans.length === 0" class="p-8 text-center text-sm text-gray-400">
        Aún no has escaneado ningún EAN.
      </div>
      <ul v-else class="divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto">
        <li v-for="(e, i) in eans" :key="i" class="flex items-center gap-3 px-4 py-2.5">
          <span class="text-xs text-gray-400 w-6 text-right shrink-0">{{ eans.length - i }}</span>
          <span class="font-mono text-gray-800 dark:text-gray-100 flex-1 truncate">{{ e.codigo }}</span>
          <span class="text-xs text-gray-400 shrink-0">{{ e.hora }}</span>
          <button @click="borrar(i)" class="text-gray-300 hover:text-brand-600 shrink-0" title="Quitar">
            <TrashIcon class="w-4 h-4" />
          </button>
        </li>
      </ul>
    </div>

    <!-- Enviar -->
    <button
      @click="enviar"
      :disabled="enviando || eans.length === 0"
      class="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-lg text-lg transition-colors"
    >
      <PaperAirplaneIcon class="w-6 h-6" />
      {{ enviando ? 'Enviando…' : 'Enviar formulario' }}
    </button>
  </div>
</template>
