<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { XMarkIcon, CheckCircleIcon } from '@heroicons/vue/24/outline';

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
  hechas: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  ultimo: { type: String, default: '' },
  okSignal: { type: Number, default: 0 },   // el padre lo incrementa cuando ACEPTA un HU
});
const emit = defineEmits(['close', 'detected']);

const videoEl = ref(null);
const error = ref('');
const flash = ref(false);
let reader = null;
let controls = null;
let lastCode = '';
let lastTime = 0;

// Destello verde + vibración solo cuando el padre confirma que ha añadido un HU
watch(() => props.okSignal, () => {
  flash.value = true;
  if (navigator.vibrate) navigator.vibrate(80);
  setTimeout(() => { flash.value = false; }, 700);
});

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
        if (text === lastCode && now - lastTime < 1500) return;
        lastCode = text;
        lastTime = now;
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
          <div class="w-4/5 h-24 rounded-lg border-2 transition-colors duration-150"
               :class="flash ? 'border-brandgreen-400' : 'border-brand-400'"></div>
        </div>
        <!-- Destello verde + tick al captar -->
        <transition name="fade">
          <div v-if="flash" class="absolute inset-0 flex items-center justify-center bg-brandgreen-500/30">
            <CheckCircleIcon class="w-32 h-32 text-brandgreen-400 drop-shadow-lg" />
          </div>
        </transition>
        <!-- Contador grande arriba -->
        <div class="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-lg font-bold px-4 py-1.5 rounded-full">
          {{ hechas }} / {{ total }} HU
        </div>
      </div>

      <div class="p-3 text-center">
        <p v-if="error" class="text-sm text-brand-600">{{ error }}</p>
        <template v-else>
          <p v-if="ultimo" class="text-sm font-semibold text-brandgreen-600 flex items-center justify-center gap-1">
            <CheckCircleIcon class="w-4 h-4" /> Último: <span class="font-mono">{{ ultimo }}</span>
          </p>
          <p v-else class="text-sm text-gray-500 dark:text-gray-300">Apunta al código de barras del HU</p>
        </template>
        <button @click="emit('close')" class="mt-3 w-full py-2.5 rounded-lg bg-gray-700 hover:bg-gray-800 text-white font-semibold">
          Terminar
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
