<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { XMarkIcon } from '@heroicons/vue/24/outline';

// Formatos habituales de HU/etiquetas + insistir en la lectura (1D cuesta más)
const hints = new Map();
hints.set(DecodeHintType.TRY_HARDER, true);
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF,
  BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A,
  BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX,
]);

const props = defineProps({
  open: { type: Boolean, default: false },
  titulo: { type: String, default: 'Escanear' },
  info: { type: String, default: '' },
});
const emit = defineEmits(['close', 'detected']);

const videoEl = ref(null);
const error = ref('');
let reader = null;
let controls = null;
let lastCode = '';
let lastTime = 0;

async function start() {
  error.value = '';
  await nextTick();
  try {
    reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
    controls = await reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
      videoEl.value,
      (result) => {
        if (!result) return;
        const text = result.getText();
        const now = Date.now();
        // Evita repetir el mismo código en ráfaga
        if (text === lastCode && now - lastTime < 1500) return;
        lastCode = text;
        lastTime = now;
        if (navigator.vibrate) navigator.vibrate(60);
        emit('detected', text);
      }
    );
  } catch (e) {
    error.value = 'No se pudo abrir la cámara. Da permiso de cámara al navegador. (' + (e?.message || e) + ')';
  }
}

function stop() {
  try { controls?.stop(); } catch (_) { /* noop */ }
  controls = null;
  reader = null;
  lastCode = '';
  lastTime = 0;
}

watch(() => props.open, (o) => { if (o) start(); else stop(); });
onBeforeUnmount(stop);
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
    <div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-xl">
      <div class="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <p class="font-bold text-gray-800 dark:text-white truncate">{{ titulo }}</p>
        <button @click="emit('close')" class="text-gray-400 hover:text-brand-600 p-1"><XMarkIcon class="w-6 h-6" /></button>
      </div>

      <div class="relative bg-black aspect-[3/4]">
        <video ref="videoEl" class="w-full h-full object-cover" autoplay muted playsinline></video>
        <!-- Marco guía -->
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="w-4/5 h-24 border-2 border-brand-400 rounded-lg"></div>
        </div>
      </div>

      <div class="p-3 text-center">
        <p v-if="error" class="text-sm text-brand-600">{{ error }}</p>
        <p v-else class="text-sm text-gray-500 dark:text-gray-300">{{ info || 'Apunta al código de barras del HU' }}</p>
        <button @click="emit('close')" class="mt-3 w-full py-2.5 rounded-lg bg-gray-700 hover:bg-gray-800 text-white font-semibold">
          Terminar
        </button>
      </div>
    </div>
  </div>
</template>
