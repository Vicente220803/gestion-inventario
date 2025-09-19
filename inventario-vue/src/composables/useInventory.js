// RUTA: /inventario-vue/src/composables/useInventory.js

import { ref, readonly } from 'vue';
import { useToasts } from './useToasts';
import { supabase } from '../supabase';

const _productsWithSku = ref({});
const _materialStock = ref({});
const _movements = ref([]);
const hasLoaded = ref(false);
const _pendingIncomings = ref([]);

export function useInventory() {
  const { showSuccess, showError } = useToasts();

  async function loadFromServer() {
    // Esta función está bien, pero aseguramos que se llame siempre al final.
    try {
      const [productsRes, stockRes, movementsRes] = await Promise.all([
        supabase.from('productos').select('sku, descripcion, url_imagen'),
        supabase.from('stock').select('*'),
        supabase.from('MOVIMIENTOS').select('*').order('created_at', { ascending: true })
      ]);

      if (productsRes.error) throw productsRes.error;
      if (stockRes.error) throw stockRes.error;
      if (movementsRes.error) throw movementsRes.error;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const bucketName = 'imagenes-productos';

      _productsWithSku.value = Object.fromEntries(productsRes.data.map(p => {
        const imageUrl = p.url_imagen ? `${supabaseUrl}/storage/v1/object/public/${bucketName}/${p.url_imagen}` : null;
        return [p.descripcion, { sku: p.sku, url_imagen: imageUrl }];
      }));
      
      _materialStock.value = Object.fromEntries(stockRes.data.map(s => [s.producto_sku, s.cantidad]));
      _movements.value = movementsRes.data.map(m => ({
        id: m.id, fechaPedido: m.fecha_pedido, fechaEntrega: m.fecha_entrega, pallets: m.pallets, comentarios: m.comentarios, items: m.elementos, tipo: m.tipo, created_at: m.created_at
      }));
      
    } catch (error) {
      showError('No se pudo cargar el inventario principal.');
      console.error('Error cargando inventario:', error);
    } finally {
      hasLoaded.value = true;
    }
  }

  // ==============================================================================
  // --- FUNCIÓN recordManualInventoryCount (CORREGIDA) ---
  // ==============================================================================
  async function recordManualInventoryCount(newStockData, reason) {
    try {
      const productsBySku = Object.fromEntries(
        Object.entries(_productsWithSku.value).map(([desc, { sku }]) => [sku, desc])
      );

      const changedItems = Object.entries(newStockData)
        .filter(([sku, newQuantity]) => newQuantity !== (_materialStock.value[sku] || 0))
        .map(([sku, newQuantity]) => ({ sku, desc: productsBySku[sku] || 'SKU Desconocido', cantidad: newQuantity }));
      
      if (changedItems.length === 0) {
        showSuccess('No se detectaron cambios en el stock.');
        return;
      }

      // 1. PRIMERO, actualizamos la tabla 'stock' en la base de datos.
      const stockUpdates = changedItems.map(({ sku, cantidad }) =>
        supabase.from('stock').update({ cantidad }).eq('producto_sku', sku)
      );
      const results = await Promise.all(stockUpdates);
      const updateError = results.some(res => res.error);
      if (updateError) {
        throw new Error('Error al actualizar las cantidades de stock.');
      }

      // 2. SEGUNDO, si el stock se actualizó bien, registramos el movimiento en el historial.
      const movementData = {
        fecha_pedido: new Date().toISOString().slice(0, 10),
        fecha_entrega: new Date().toISOString().slice(0, 10),
        comentarios: reason,
        tipo: 'Recuento Manual',
        elementos: changedItems,
        pallets: 0,
      };
      const { error: insertError } = await supabase.from('MOVIMIENTOS').insert([movementData]);
      if (insertError) {
        throw new Error('El stock se actualizó, pero falló el registro en el historial.');
      }

      showSuccess('Ajuste de inventario registrado con éxito.');

    } catch (error) {
      showError(error.message || 'No se pudo completar el ajuste.');
      console.error("Error en recordManualInventoryCount:", error);
    } finally {
      // 3. PASE LO QUE PASE, recargamos los datos del servidor para que la app refleje la realidad.
      await loadFromServer();
    }
  }

  // ==============================================================================
  // --- FUNCIÓN deleteMovement (CORREGIDA) ---
  // ==============================================================================
  async function deleteMovement(movementId, movementType, itemsToRevert) {
    try {
      // 1. Borramos el movimiento del historial. Este es el primer paso.
      const { error: deleteError } = await supabase.from('MOVIMIENTOS').delete().eq('id', movementId);
      if (deleteError) throw deleteError;

      if (movementType === 'Entrada' || movementType === 'Salida') {
        // --- Lógica para Entradas/Salidas: revertir la cantidad ---
        for (const item of itemsToRevert) {
          const amountToRevert = movementType === 'Salida' ? Number(item.cantidad) : -Number(item.cantidad);
          const { error: rpcError } = await supabase.rpc('actualizar_stock', {
            sku_producto: item.sku,
            cantidad_cambio: amountToRevert
          });
          if (rpcError) throw rpcError;
        }
      } else if (movementType === 'Recuento Manual' || movementType === 'Ajuste') {
        // --- Lógica para Recuento Manual: RECALCULAR el stock desde la historia ---
        for (const item of itemsToRevert) {
          // Obtenemos de nuevo TODO el historial para el producto afectado (ya sin el movimiento que borramos).
          const { data: allMovementsForItem, error: historyError } = await supabase
            .from('MOVIMIENTOS')
            .select('tipo, elementos')
            .order('created_at', { ascending: true });

          if (historyError) throw historyError;
          
          let recalculatedStock = 0;
          // Reconstruimos la historia para ese item desde cero.
          for (const mov of allMovementsForItem) {
            for (const movItem of mov.elementos) {
              if (movItem.sku === item.sku) {
                const cantidad = Number(movItem.cantidad);
                if (mov.tipo === 'Entrada') recalculatedStock += cantidad;
                else if (mov.tipo === 'Salida') recalculatedStock -= cantidad;
                else if (mov.tipo === 'Recuento Manual' || mov.tipo === 'Ajuste') recalculatedStock = cantidad;
              }
            }
          }
          
          // Actualizamos la tabla 'stock' con el valor correcto y final.
          const { error: updateError } = await supabase
            .from('stock')
            .update({ cantidad: recalculatedStock })
            .eq('producto_sku', item.sku);
          
          if (updateError) throw updateError;
        }
      }

      showSuccess('Movimiento anulado y stock revertido con éxito.');
      
    } catch (error) {
      showError('La operación de anulación no se pudo completar.');
      console.error('Error en la anulación:', error);
    } finally {
      // Al final, SIEMPRE recargamos los datos para que la UI se actualice.
      await loadFromServer();
    }
  }

  // --- OTRAS FUNCIONES (addProduct, recordManualInventoryCount, etc.) ---
  // Estas funciones se quedan como estaban, ya que su lógica era correcta.
  // ... (Aquí irían el resto de funciones: addProduct, deleteProduct, etc. las he omitido por brevedad pero deben estar en tu archivo)
  async function addProduct(productInfo) { /* ... */ }
  async function deleteProduct(productDesc) { /* ... */ }
  async function recordManualInventoryCount(newStockData, reason) { /* ... */ }
  async function fetchPendingIncomings() { /* ... */ }
  async function approvePendingIncoming(pendingEntry, movementDetails) { /* ... */ }


  // --- 4. EXPORTACIÓN ---
  // Exponemos las variables (como solo lectura) y las funciones para que
  // los componentes puedan usarlas.
   return {
    productsWithSku: readonly(_productsWithSku),
    materialStock: readonly(_materialStock),
    movements: readonly(_movements),
    pendingIncomings: readonly(_pendingIncomings),
    
    // Funciones
    loadFromServer,
    fetchPendingIncomings,
    addMovement, // <-- ESTA LÍNEA FALTABA. AÑÁDELA.
    approvePendingIncoming,
    addProduct,
    recordManualInventoryCount,
    deleteProduct,
    deleteMovement,
  };
}