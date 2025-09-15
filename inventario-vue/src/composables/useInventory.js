import { ref, readonly } from 'vue';
import { useToasts } from './useToasts';
import { supabase } from '../supabase';

// --- ESTADO GLOBAL DEL INVENTARIO ---
// (Mantenido privado dentro de este módulo)
const _productsWithSku = ref({});
const _materialStock = ref({});
const _movements = ref([]);
const hasLoaded = ref(false);

// --- NUEVO ESTADO PARA LAS ENTRADAS PENDIENTES DE REVISIÓN ---
const _pendingIncomings = ref([]);

export function useInventory() {
  const { showSuccess, showError } = useToasts();

  /**
   * Carga los datos principales del inventario (productos, stock, movimientos).
   * Se ejecuta al iniciar sesión.
   */
  async function loadFromServer() {
    if (hasLoaded.value) return;
    try {
      const [productsRes, stockRes, movementsRes] = await Promise.all([
        supabase.from('productos').select('*'),
        supabase.from('stock').select('*'),
        supabase.from('MOVIMIENTOS').select('*').order('fecha_entrega', { ascending: true })
      ]);

      if (productsRes.error) throw productsRes.error;
      if (stockRes.error) throw stockRes.error;
      if (movementsRes.error) throw movementsRes.error;

      _productsWithSku.value = Object.fromEntries(productsRes.data.map(p => [p.descripcion, { sku: p.sku }]));
      _materialStock.value = Object.fromEntries(stockRes.data.map(s => [s.producto_sku, s.cantidad]));
      _movements.value = movementsRes.data.map(m => ({
        id: m.id, fechaPedido: m.fecha_pedido, fechaEntrega: m.fecha_entrega, pallets: m.pallets, comentarios: m.comentarios, items: m.elementos, tipo: m.tipo
      }));
      
      if (!hasLoaded.value) { showSuccess('Datos de inventario cargados.'); }
    } catch (error) {
      showError('No se pudo cargar el inventario principal.');
      console.error('Error cargando inventario:', error);
    } finally {
      hasLoaded.value = true;
    }
  }

  /**
   * NUEVA FUNCIÓN: Carga las entradas de albaranes pendientes de revisión.
   * Se ejecuta al iniciar sesión.
   */
  async function fetchPendingIncomings() {
    try {
      const { data, error } = await supabase
        .from('entradas_pendientes')
        .select('*')
        .eq('status', 'pendiente') // Solo traemos las que necesitan acción
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      _pendingIncomings.value = data;
    } catch (error) {
      showError('No se pudieron cargar las entradas pendientes.');
      console.error('Error cargando entradas pendientes:', error);
    }
  }

  /**
   * Registra un movimiento y actualiza el stock.
   * Esta función será llamada por 'approvePendingIncoming' en el futuro.
   */
  async function addMovement(movementData) {
    const { error: insertError } = await supabase.from('MOVIMIENTOS').insert([{
        fecha_pedido: movementData.fechaPedido, fecha_entrega: movementData.fechaEntrega, comentarios: movementData.comentarios, tipo: movementData.tipo, elementos: movementData.items, pallets: movementData.pallets
    }]);
    if (insertError) { showError('Error al guardar el movimiento.'); console.error(insertError); return; }

    for (const item of movementData.items) {
      const { error: stockError } = await supabase.rpc('actualizar_stock', {
          sku_producto: item.sku, cantidad_cambio: movementData.tipo === 'Salida' ? -item.cantidad : item.cantidad
      });
       if (stockError) { showError(`Error al actualizar stock para ${item.sku}.`); console.error(stockError); }
    }
    
    // Forzar recarga completa para mantener la consistencia
    hasLoaded.value = false;
    await loadFromServer();
  }

  /**
   * NUEVA FUNCIÓN: Procesa la aprobación de una entrada pendiente.
   * @param {object} pendingEntry El objeto completo de la entrada pendiente.
   * @param {object} movementDetails Los detalles del movimiento (items, pallets) introducidos por el usuario.
   */
  async function approvePendingIncoming(pendingEntry, movementDetails) {
    try {
      // 1. Preparamos el objeto del nuevo movimiento con los datos del formulario
      const newMovement = {
        fechaPedido: new Date().toISOString().slice(0, 10),
        fechaEntrega: new Date().toISOString().slice(0, 10),
        comentarios: `Entrada aprobada desde albarán. ID Pendiente: ${pendingEntry.id}.`,
        tipo: 'Entrada',
        items: movementDetails.items,
        pallets: movementDetails.pallets
      };

      // 2. Llama a la función existente para crear el movimiento y actualizar el stock
      await addMovement(newMovement);

      // 3. Si todo va bien, actualizamos el estado de la entrada pendiente a 'aprobado'
      const { error: updateError } = await supabase
        .from('entradas_pendientes')
        .update({ status: 'aprobado' })
        .eq('id', pendingEntry.id);
      
      if (updateError) throw updateError;

      showSuccess('¡Entrada aprobada y registrada en el historial!');
      
      // 4. Volvemos a cargar las entradas pendientes para que la aprobada desaparezca de la lista
      await fetchPendingIncomings();

    } catch (error) {
      showError('Error al aprobar la entrada.');
      console.error('Error aprobando:', error);
    }
  }

  // --- RESTO DE FUNCIONES EXISTENTES (SIN CAMBIOS) ---
  
  async function addProduct(productInfo) { /* ...código existente... */ }
  async function recordManualInventoryCount(newStockData) { /* ...código existente... */ }
  async function deleteProduct(productDesc) { /* ...código existente... */ }
  async function deleteMovement(movementId, movementType, itemsToRevert) { /* ...código existente... */ }


  // Se exponen todas las funciones y el estado (como solo lectura)
  return {
    // Estado
    productsWithSku: readonly(_productsWithSku),
    materialStock: readonly(_materialStock),
    movements: readonly(_movements),
    pendingIncomings: readonly(_pendingIncomings), // <-- Nuevo estado disponible

    // Funciones
    loadFromServer,
    fetchPendingIncomings, // <-- Nueva función disponible
    addMovement,
    approvePendingIncoming, // <-- Nueva función disponible
    addProduct,
    recordManualInventoryCount,
    deleteProduct,
    deleteMovement,
  };
}