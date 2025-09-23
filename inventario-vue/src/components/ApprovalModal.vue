<script setup>
import { ref } from 'vue';
import { useInventory } from '@/composables/useInventory';
import { useToasts } from '@/composables/useToasts';

// --- TUS PROPS Y COMPOSABLES (SIN CAMBIOS) ---
const props = defineProps({
  entry: Object,
});
const emit = defineEmits(['close', 'approved']);
const { productsWithSku } = useInventory();
const { showError } = useToasts();


// --- TUS FUNCIONES DE BÚSQUEDA (CONSERVADAS) ---
// Se conservan al 100% porque son cruciales para la nueva lógica.
function findBestMatchByCode(materialFromAI, allProductDescriptions) {
  if (!materialFromAI || !allProductDescriptions) return null;
  const numbersInAIString = materialFromAI.match(/\d+/g);
  if (!numbersInAIString) return null;
  for (const keyNumber of numbersInAIString) {
    const matchedDesc = allProductDescriptions.find(desc => desc.includes(keyNumber));
    if (matchedDesc) return matchedDesc;
  }
  // Si no encuentra por código, intenta un fuzzy match como último recurso
  return fuzzyMatch(materialFromAI, allProductDescriptions);
}

function fuzzyMatch(query, options) {
  if (!query || !options || options.length === 0) return null;
  const threshold = 0.6;
  let bestMatch = null;
  let bestScore = 0;
  const lowerCaseQuery = query.toLowerCase();
  options.forEach(desc => {
    const score = similarity(lowerCaseQuery, desc.toLowerCase());
    if (score > bestScore && score >= threshold) {
      bestMatch = desc;
      bestScore = score;
    }
  });
  return bestMatch;
}

function similarity(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  return (longer.length - levenshteinDistance(longer, shorter)) / parseFloat(longer.length);
}

function levenshteinDistance(s1, s2) {
  const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) matrix[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) matrix[j][0] = j;
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator,
      );
    }
  }
  return matrix[s2.length][s1.length];
}

// --- LÓGICA DE INICIALIZACIÓN (MODIFICADA PARA MANEJAR MÚLTIPLES ITEMS) ---

// 1. Obtenemos la LISTA de items que nos manda la IA.
const itemsFromAI = props.entry.parsed_data?.items || [];
const allProductDescriptions = Object.keys(productsWithSku.value);

// 2. Mapeamos la lista de la IA para crear las filas del formulario.
//    Por CADA item que la IA encontró, creamos una fila en nuestro modal.
const items = ref(itemsFromAI.map(itemAI => {
  // Para cada item, buscamos la mejor coincidencia en nuestro inventario.
  const bestMatchDescription = findBestMatchByCode(itemAI.descripcion, allProductDescriptions);
  
  return {
    sku: '',
    desc: bestMatchDescription || '', // Se rellena con la coincidencia encontrada
    cantidad: itemAI.cantidad || 0    // Se rellena con la cantidad de ESA línea
  };
}));

// Si por alguna razón la IA no devuelve items, creamos una fila vacía para que el usuario pueda empezar.
if (items.value.length === 0) {
  items.value.push({ sku: '', desc: '', cantidad: 0 });
}


// --- TUS OTRAS FUNCIONES (CONSERVADAS) ---
function addRow() {
  items.value.push({ sku: '', desc: '', cantidad: 0 });
}

function updateSku(item) {
  const selectedProduct = Object.entries(productsWithSku.value).find(([desc]) => desc === item.desc);
  if (selectedProduct) {
    item.sku = selectedProduct[1].sku;
  }
}

// 3. Actualizamos el SKU para TODAS las filas que encontraron una coincidencia al inicio.
items.value.forEach(item => {
  if (item.desc) {
    updateSku(item);
  }
});

function submitApproval() {
  const totalPalletsFromItems = items.value.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);
  if (totalPalletsFromItems === 0) {
    showError('La cantidad total de pallets a registrar no puede ser 0.');
    return;
  }
  
  const validItems = items.value.filter(i => i.desc && i.cantidad > 0);
  if (validItems.length === 0) {
    showError('Debes registrar al menos un material válido con cantidad mayor que 0.');
    return;
  }
  validItems.forEach(item => { if (!item.sku) updateSku(item); });
  if (validItems.some(i => !i.sku)) {
    showError('Todos los materiales deben estar enlazados a un SKU válido.');
    return;
  }

  const movementDetails = {
    pallets: totalPalletsFromItems,
    items: validItems.map(item => ({...item, cantidad: Number(item.cantidad)})),
  };
  emit('approved', movementDetails);
}
</script>

<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
    <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-3xl">
      <h2 class="text-xl font-bold mb-4">Aprobar Entrada y Registrar Stock</h2>
      
      <div class="grid grid-cols-2 gap-6">
        <!-- Columna Izquierda: Información del Albarán -->
        <div>
          <h3 class="font-semibold text-gray-700 mb-2">Información del Albarán</h3>
          <div class="bg-gray-50 p-4 rounded-md border h-80 flex flex-col justify-start space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-500">Proveedor</label>
                <p class="text-base font-semibold text-gray-800">{{ entry.parsed_data?.proveedor || 'No disponible' }}</p>
              </div>
              <!-- Mostramos el total de pallets detectados como la suma de los items -->
               <div>
                <label class="block text-sm font-medium text-gray-500">Total Pallets Detectados</label>
                <p class="text-2xl font-bold text-blue-600">
                  {{ entry.parsed_data?.items?.reduce((acc, item) => acc + (item.cantidad || 0), 0) || 0 }}
                </p>
              </div>
          </div>
        </div>

        <!-- Columna Derecha: Formulario (Ahora con múltiples filas automáticas) -->
        <div class="space-y-4">
          <h3 class="font-semibold text-gray-700">Materiales a Registrar</h3>
          <!-- El v-for ahora creará una fila por cada item encontrado por la IA -->
          <div v-for="(item, index) in items" :key="index" class="grid grid-cols-3 gap-2 items-center">
            <select v-model="item.desc" @change="updateSku(item)" class="col-span-2 mt-1 block w-full p-2 border rounded-md">
              <option value="">Selecciona material</option>
              <option v-for="(data, desc) in productsWithSku" :key="desc">{{ desc }}</option>
            </select>
            <input type="number" v-model="item.cantidad" placeholder="Cant." class="mt-1 block w-full p-2 border rounded-md" />
          </div>
          <button @click="addRow" class="text-sm text-blue-600 hover:underline">+ Añadir otra fila</button>
        </div>
      </div>

      <div class="mt-6 flex justify-end space-x-4">
        <button @click="$emit('close')" class="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Cancelar</button>
        <button @click="submitApproval" class="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">Confirmar y Registrar</button>
      </div>
    </div>
  </div>
</template>