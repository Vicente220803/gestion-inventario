<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { supabase } from '../supabaseClient.js';
// Importamos todo lo que necesitamos de 'useInventory'
import { useInventory } from '@/composables/useInventory';

// Obtenemos las funciones y datos necesarios
const { addMovement, productsWithSku } = useInventory();

// --- ESTADO REACTIVO ---
const entradas = ref([]);
const cargando = ref(true);
const entradaSeleccionada = ref(null);
const cantidadModificada = ref(0);

// --- LÓGICA ---
const fetchEntradas = async () => {
  cargando.value = true;
  const { data, error } = await supabase
    .from('entradas_pendientes')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error cargando entradas pendientes:', error);
  } else {
    entradas.value = data;
  }
  cargando.value = false;
};

const abrirModal = (entrada) => {
  entradaSeleccionada.value = entrada;
  cantidadModificada.value = entrada.parsed_data.pallets;
};

const cerrarModal = () => {
  entradaSeleccionada.value = null;
};

const handleAccept = async () => {
  if (!entradaSeleccionada.value) return;

  try {
    const descripcionMaterial = entradaSeleccionada.value.parsed_data.descripcion;
    
    // --- 1. BUSCAR EL SKU CORRESPONDIENTE A LA DESCRIPCIÓN ---
    const productoEncontrado = Object.values(productsWithSku.value).find(
      p => p.descripcion.trim().toLowerCase() === descripcionMaterial.trim().toLowerCase()
    );

    if (!productoEncontrado) {
      alert(`Error: No se encontró el SKU para el material "${descripcionMaterial}". Asegúrate de que el material exista en el maestro de productos.`);
      return;
    }

    // --- 2. PREPARAMOS EL NUEVO MOVIMIENTO CON EL FORMATO CORRECTO ---
    const newMovement = {
      fechaEntrega: new Date().toISOString().slice(0, 10),
      comentarios: `Entrada desde Excel (Fila: ${entradaSeleccionada.value.parsed_data.fila_excel})`,
      tipo: 'Entrada',
      items: [{
        desc: descripcionMaterial,
        sku: productoEncontrado.sku, // <--- AÑADIMOS EL SKU ENCONTRADO
        cantidad: cantidadModificada.value
      }],
      pallets: cantidadModificada.value
    };

    // --- 3. LLAMAMOS A LA FUNCIÓN PARA AÑADIR EL MOVIMIENTO ---
    await addMovement(newMovement, { showToast: false });
    
    // --- 4. BORRAMOS LA ENTRADA DE LA TABLA DE PENDIENTES ---
    const { error: deleteError } = await supabase
      .from('entradas_pendientes')
      .delete()
      .eq('id', entradaSeleccionada.value.id);

    if (deleteError) throw deleteError;

    alert('Entrada aceptada y registrada correctamente!');
    cerrarModal();
  } catch (error) {
    console.error('Error al aceptar la entrada:', error);
    alert('Error al aceptar la entrada: ' + error.message);
  }
};

// --- LIFECYCLE HOOKS ---
let channel = null;

onMounted(() => {
  fetchEntradas();
  channel = supabase
    .channel('entradas_pendientes_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'entradas_pendientes' },
      (payload) => {
        console.log('Cambio detectado:', payload);
        fetchEntradas();
      }
    )
    .subscribe();
});

onUnmounted(() => {
  if (channel) {
    supabase.removeChannel(channel);
  }
});
</script>

<template>
  <div>
    <h2 class="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Entradas Pendientes de Revisión</h2>
    
    <p v-if="cargando">Cargando entradas pendientes...</p>

    <div v-else>
      <p v-if="entradas.length === 0" class="text-gray-500">No hay nuevas entradas pendientes de revisión.</p>
      
      <ul v-else class="space-y-3">
        <li
          v-for="entrada in entradas"
          :key="entrada.id"
          class="flex justify-between items-center p-4 bg-gray-50 rounded-lg border"
        >
          <div>
            <strong class="text-gray-800">{{ entrada.parsed_data.descripcion }}</strong>
            <span class="text-gray-600 ml-2">- Cantidad: {{ entrada.parsed_data.pallets }} palés</span>
          </div>
          
          <button
            @click="abrirModal(entrada)"
            class="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700"
          >
            Revisar
          </button>
        </li>
      </ul>
    </div>

    <div v-if="entradaSeleccionada" class="modal-overlay" @click="cerrarModal">
      <div class="modal-content" @click.stop>
        <h3>Revisar Entrada</h3>
        <p><strong>Material:</strong> {{ entradaSeleccionada.parsed_data.descripcion }}</p>
        <label for="cantidad">Cantidad de Palés:</label>
        <input
          id="cantidad"
          type="number"
          v-model="cantidadModificada"
          style="width: 100%; padding: 8px; margin-top: 5px; margin-bottom: 20px;"
        />
        <div style="display: flex; justify-content: space-between;">
          <button @click="cerrarModal" style="padding: 10px 20px;">Cancelar</button>
          <button @click="handleAccept" style="padding: 10px 20px; background-color: #007bff; color: white; border: none;">
            Aceptar Entrada
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  background-color: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  min-width: 300px;
  color: black;
}
</style>