<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { supabase } from '../supabaseClient.js';
import { useInventory } from '@/composables/useInventory';
import { useToasts } from '@/composables/useToasts';

const { addMovement, productsWithSku } = useInventory();
const { showSuccess, showInfo, showError } = useToasts();

const entradas = ref([]);
const cargando = ref(true);
const entradaSeleccionada = ref(null);

// --- NOTIFICACIONES DE ENTRADA ---
const CLIENTES_CON_NOTIFICACION = ['ITC', 'Faerch'];
const N8N_WEBHOOK_NOTIFICACION = 'https://surexportlevante.app.n8n.cloud/webhook/0a2fa4b7-6de7-44b3-ab8c-a9feb12e41f0';

const numeroPedido = ref('');

const requiereNotificacion = computed(() => {
  if (!entradaSeleccionada.value) return false;
  const proveedor = entradaSeleccionada.value.parsed_data.proveedor || '';
  return CLIENTES_CON_NOTIFICACION.some(c => proveedor.toLowerCase().includes(c.toLowerCase()));
});

// Variables para el modal
const itemsParaProcesar = ref([]); 

// --- Lista de productos para el desplegable ---
const listaProductos = computed(() => {
  if (!productsWithSku.value) return [];
  return Object.entries(productsWithSku.value)
    .map(([nombre, datos]) => ({
      sku: datos.sku,
      descripcion: nombre 
    }))
    .sort((a, b) => a.descripcion.localeCompare(b.descripcion));
});

// --- FUNCIÓN INTELIGENTE PARA ASOCIAR NOMBRES ---
const encontrarMejorCoincidencia = (nombrePDF) => {
  if (!nombrePDF) return '';
  
  const palabrasPDF = nombrePDF.toLowerCase().replace(/[.,-]/g, ' ').split(/\s+/).filter(w => w.length > 1);
  const numerosPDF = nombrePDF.match(/\d+/g) || [];

  let mejorCandidato = null;
  let mejorPuntuacion = 0;

  for (const producto of listaProductos.value) {
    const nombreBD = producto.descripcion.toLowerCase();
    let puntuacion = 0;

    palabrasPDF.forEach(palabra => {
      if (nombreBD.includes(palabra)) puntuacion += 10;
    });

    numerosPDF.forEach(num => {
      const regexNum = new RegExp(`\\b${num}\\b`); 
      if (regexNum.test(nombreBD) || nombreBD.includes(num)) puntuacion += 30;
    });

    if (puntuacion > mejorPuntuacion) {
      mejorPuntuacion = puntuacion;
      mejorCandidato = producto.sku;
    }
  }

  return mejorPuntuacion > 0 ? mejorCandidato : '';
};

const fetchEntradas = async () => {
  cargando.value = true;
  const { data, error } = await supabase
    .from('entradas_pendientes')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error cargando entradas pendientes:', error);
  } else {
    entradas.value = data.map(row => {
      let datosLimpios = row.parsed_data;
      if (typeof datosLimpios === 'string') {
        try { datosLimpios = JSON.parse(datosLimpios); } 
        catch (e) { datosLimpios = {}; }
      }
      return { ...row, parsed_data: datosLimpios };
    });
  }
  cargando.value = false;
};

const abrirModal = (entrada) => {
  entradaSeleccionada.value = entrada;
  const datos = entrada.parsed_data;
  let itemsCrudos = [];

  if (datos.items && Array.isArray(datos.items)) {
    itemsCrudos = datos.items.map(item => ({
      descripcion: item.descripcion,
      cantidad: item.cantidad_palets || 0
    }));
  } else if (datos.descripcion) {
    itemsCrudos = [{
      descripcion: datos.descripcion,
      cantidad: datos.pallets || 0
    }];
  }

  itemsParaProcesar.value = itemsCrudos.map(itemPDF => {
    return {
      descripcion_pdf: itemPDF.descripcion, 
      cantidad: itemPDF.cantidad,
      sku_seleccionado: encontrarMejorCoincidencia(itemPDF.descripcion) 
    };
  });
};

const cerrarModal = () => {
  entradaSeleccionada.value = null;
  itemsParaProcesar.value = [];
  numeroPedido.value = '';
};

const handleAccept = async () => {
  if (!entradaSeleccionada.value) return;
  const entrada = entradaSeleccionada.value;

  try {
    let itemsProcesados = 0;
    const itemsValidos = [];

    // 1. Validación
    for (const item of itemsParaProcesar.value) {
      if (Number(item.cantidad) > 0) {
        if (!item.sku_seleccionado) {
          alert(`Por favor selecciona el material manualmente para "${item.descripcion_pdf}".`);
          return;
        }
        itemsValidos.push(item);
      }
    }

    if (itemsValidos.length === 0) {
      alert("No hay items válidos para procesar.");
      return;
    }

    // --- NUEVO: Función para arreglar la fecha europea (29/07/2025 -> 2025-07-29) ---
    const normalizarFecha = (fechaStr) => {
      if (!fechaStr) return new Date().toISOString().slice(0, 10);
      // Si ya tiene formato YYYY-MM-DD (tiene guiones), la dejamos igual
      if (fechaStr.includes('-')) return fechaStr;
      
      // Si tiene barras (DD/MM/YYYY)
      if (fechaStr.includes('/')) {
        const partes = fechaStr.split('/');
        if (partes.length === 3) {
          // partes[0] = dia, partes[1] = mes, partes[2] = año
          return `${partes[2]}-${partes[1]}-${partes[0]}`; // Retornamos AAAA-MM-DD
        }
      }
      // Si no sabemos qué es, devolvemos hoy para que no falle la BD
      return new Date().toISOString().slice(0, 10);
    };

    const fechaActual = new Date().toISOString().slice(0, 10);
    // Aplicamos la corrección de fecha
    const fechaDocRaw = entrada.parsed_data.fecha;
    const fechaDocCorregida = normalizarFecha(fechaDocRaw);

    const proveedor = entrada.parsed_data.proveedor || 'Desconocido';
    const albaran = entrada.parsed_data.albaran || 'S/N';

    for (const item of itemsValidos) {
      const entradaProducto = Object.entries(productsWithSku.value).find(([_, val]) => val.sku === item.sku_seleccionado);

      if (!entradaProducto) {
         alert("Error interno: No se encontró el SKU seleccionado.");
         return;
      }

      const [nombreReal, datosReal] = entradaProducto;

      const newMovement = {
        fechaPedido: fechaDocCorregida, // Fecha en formato correcto
        fechaEntrega: fechaActual,
        comentarios: `Auto (Prov: ${proveedor}) - Ref: ${albaran}`,
        tipo: 'Entrada',
        items: [{
          desc: nombreReal,
          sku: datosReal.sku,
          cantidad: Number(item.cantidad)
        }],
        pallets: Number(item.cantidad)
      };

      await addMovement(newMovement, { showToast: false });
      itemsProcesados++;
    }

    const { error: deleteError } = await supabase
      .from('entradas_pendientes')
      .delete()
      .eq('id', entrada.id);

    if (deleteError) throw deleteError;

    // ============================================================
    // 🚀 LLAMADA A N8N PARA MOVER EL ARCHIVO 🚀
    // ============================================================
    if (entrada.file_url) {
      try {
        const fileUrl = entrada.file_url;
        // Sacamos el ID del archivo
        const fileIdMatch = fileUrl.match(/\/d\/(.+?)(\/|$)/);
        
        if (fileIdMatch && fileIdMatch[1]) {
          const fileId = fileIdMatch[1];
          // TU URL DE TEST DE N8N
          const N8N_WEBHOOK_URL = 'https://surexportlevante.app.n8n.cloud/webhook/0c0b2c48-370f-47de-989a-b8bae614e0c5'; 
          
          // Llamamos al webhook (sin await para que la web no se quede pillada esperando)
          fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: fileId })
          }).catch(err => console.warn('Aviso: Error contactando con n8n', err));
        }
      } catch (e) {
        console.warn('No se pudo intentar mover el archivo:', e);
      }
    }
    // ============================================================

    showSuccess(`Entrada procesada correctamente.`);

    // Enviar notificación por correo si el cliente lo requiere
    if (requiereNotificacion.value) {
      const fileUrl = entrada.file_url || '';
      const fileIdMatch = fileUrl.match(/\/d\/(.+?)(\/|$)/);
      const fileId = fileIdMatch ? fileIdMatch[1] : null;

      const payload = {
        proveedor,
        fecha: entrada.parsed_data.fecha || fechaActual,
        albaran,
        numero_pedido: numeroPedido.value || 'N/A',
        destinatario: 'operacioneslevante@surexport.es',
        file_id: fileId,
        items: itemsValidos.map(item => {
          const prod = Object.entries(productsWithSku.value).find(([_, v]) => v.sku === item.sku_seleccionado);
          return { descripcion: prod ? prod[0] : item.descripcion_pdf, cantidad: Number(item.cantidad) };
        })
      };

      fetch(N8N_WEBHOOK_NOTIFICACION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => console.warn('Error enviando notificación de entrada:', err));
    }

    entradas.value = entradas.value.filter(e => e.id !== entrada.id);
    cerrarModal();

  } catch (error) {
    console.error('Error al aceptar:', error);
    alert('Error al aceptar la entrada: ' + error.message);
  }
};

let channel = null;

onMounted(() => {
  fetchEntradas();
  channel = supabase
    .channel('entradas_pendientes_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'entradas_pendientes' }, () => fetchEntradas())
    .subscribe();
});

onUnmounted(() => {
  if (channel) supabase.removeChannel(channel);
});
</script>

<template>
  <div>
    <h2 class="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Entradas Pendientes de Revisión (Automáticas)</h2>
    
    <p v-if="cargando">Cargando entradas pendientes...</p>

    <div v-else>
      <p v-if="entradas.length === 0" class="text-gray-500 italic">No hay albaranes pendientes de revisión.</p>
      
      <ul v-else class="space-y-4">
        <li v-for="entrada in entradas" :key="entrada.id" class="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4">
          <div class="flex justify-between items-start mb-3">
            <div>
              <h3 class="font-bold text-lg text-blue-700">{{ entrada.parsed_data.proveedor || 'Proveedor Desconocido' }}</h3>
              <p class="text-sm text-gray-500">Fecha: {{ entrada.parsed_data.fecha || 'N/A' }} | Albarán: {{ entrada.parsed_data.albaran || 'N/A' }}</p>
              <a v-if="entrada.file_url" :href="entrada.file_url" target="_blank" class="inline-flex items-center mt-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded border">
                <svg class="w-4 h-4 mr-1 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" /></svg>
                Ver Documento PDF
              </a>
            </div>
            <button @click="abrirModal(entrada)" class="bg-green-600 text-white text-sm font-bold py-2 px-4 rounded-lg hover:bg-green-700 shadow-sm">
              Revisar y Aceptar
            </button>
          </div>
          <div class="bg-gray-50 rounded p-2 text-sm border border-gray-100">
            <p class="font-semibold text-gray-600 text-xs uppercase mb-1">Contenido detectado:</p>
            <ul class="list-disc list-inside space-y-1 pl-1">
              <template v-if="entrada.parsed_data.items && entrada.parsed_data.items.length">
                <li v-for="(item, idx) in entrada.parsed_data.items" :key="idx" class="text-gray-800">
                  <span class="font-medium">{{ item.descripcion }}</span>: {{ item.cantidad_palets }} palés
                </li>
              </template>
              <template v-else>
                 <li class="text-gray-400 italic">No se detectaron artículos legibles.</li>
              </template>
            </ul>
          </div>
        </li>
      </ul>
    </div>

    <!-- MODAL DE REVISIÓN -->
    <div v-if="entradaSeleccionada" class="modal-overlay" @click="cerrarModal">
      <div class="modal-content flex flex-col" style="max-height:90vh;" @click.stop>
        <div class="flex justify-between items-center mb-4 border-b pb-2">
          <h3 class="text-lg font-bold text-gray-800">Confirmar Entrada</h3>
          <button @click="cerrarModal" class="text-gray-500 hover:text-gray-700 font-bold text-xl">&times;</button>
        </div>

        <div class="mb-4 bg-blue-50 p-3 rounded border border-blue-100">
          <p class="text-sm text-gray-700">Proveedor: <strong class="text-blue-800">{{ entradaSeleccionada.parsed_data.proveedor }}</strong></p>
          <p class="text-sm text-gray-700">Albarán: {{ entradaSeleccionada.parsed_data.albaran }}</p>
        </div>

        <p class="mb-2 font-semibold text-sm text-gray-600 uppercase">Verifica y Asigna Materiales:</p>
        
        <div class="space-y-4 overflow-y-auto mb-6 pr-1 flex-1">
          <div v-for="(item, index) in itemsParaProcesar" :key="index" class="bg-gray-50 p-3 rounded border shadow-sm">
            
            <div class="mb-2">
              <p class="text-xs text-gray-500 font-bold uppercase">Detectado en PDF:</p>
              <p class="text-sm font-bold text-gray-800">{{ item.descripcion_pdf }}</p>
            </div>

            <div class="mb-2">
               <p class="text-xs text-gray-500 font-bold uppercase mb-1">Corresponde a en Inventario:</p>
               <select 
                 v-model="item.sku_seleccionado"
                 class="w-full p-2 text-sm border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                 :class="{'border-green-500 bg-green-50': item.sku_seleccionado}"
               >
                 <option value="" disabled>-- Selecciona el material correcto --</option>
                 <option v-for="prod in listaProductos" :key="prod.sku" :value="prod.sku">
                   {{ prod.descripcion }}
                 </option>
               </select>
            </div>

            <div class="flex items-center justify-end mt-2 border-t pt-2">
              <label class="text-xs font-bold text-gray-600 mr-2">CANTIDAD:</label>
              <input
                type="number"
                v-model="item.cantidad"
                class="w-24 p-1 border rounded text-center font-bold text-blue-700"
                min="0"
              />
              <span class="ml-2 text-xs font-bold text-gray-500">PALÉS</span>
            </div>
          </div>
          
          <div v-if="itemsParaProcesar.length === 0" class="text-center py-4 text-gray-500">
            No se han encontrado items en el JSON.
          </div>
        </div>

        <!-- Campo número de pedido: solo para clientes con notificación -->
        <div v-if="requiereNotificacion" class="mb-4 bg-yellow-50 border border-yellow-200 rounded p-3">
          <p class="text-xs font-bold text-yellow-700 uppercase mb-2">✉️ Se enviará notificación de entrada</p>
          <label class="text-sm font-semibold text-gray-700">Número de pedido (opcional)</label>
          <input
            v-model="numeroPedido"
            type="text"
            placeholder="Ej: 4100274556"
            class="mt-1 w-full p-2 text-sm border rounded focus:ring-2 focus:ring-yellow-400 outline-none"
          />
          <p class="text-xs text-gray-500 mt-1">Resumen a enviar: {{ itemsParaProcesar.filter(i => Number(i.cantidad) > 0).map(i => `${i.descripcion_pdf} → ${i.cantidad} palés`).join(' | ') }}</p>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t">
          <button @click="cerrarModal" class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 font-medium">
            Cancelar
          </button>
          <button @click="handleAccept" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold shadow">
            Confirmar e Ingresar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  z-index: 50; 
  display: flex;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(3px);
}
.modal-content {
  background-color: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  width: 95%;
  max-width: 600px;
  color: #1f2937;
}
</style>