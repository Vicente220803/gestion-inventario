// RUTA: /inventario-vue/src/composables/useInventory.js

import { ref, readonly } from 'vue';
import { useToasts } from './useToasts';
import { useNotifications } from './useNotifications';
import { supabase } from '../supabase';

const _productsWithSku = ref({});
const _materialStock = ref({});
const _movements = ref([]);
const hasLoaded = ref(false);
const _pendingIncomings = ref([]);

export function useInventory() {
  console.log('useInventory: Initializing composable');
  const { showSuccess, showError } = useToasts();
  const { createNotification } = useNotifications();

  async function loadFromServer() {
    console.time('loadInventory');
    console.log('loadFromServer called');
    // Esta función está bien, pero aseguramos que se llame siempre al final.
    try {
      const [productsRes, stockRes, movementsRes, pendingRes] = await Promise.all([
        supabase.from('productos').select('sku, descripcion, url_imagen'),
        supabase.from('stock').select('*'),
        supabase.from('MOVIMIENTOS').select('*').order('created_at', { ascending: true }),
        supabase.from('entradas_pendientes').select('*').order('created_at', { ascending: false })
      ]);

      if (productsRes.error) throw productsRes.error;
      if (stockRes.error) throw stockRes.error;
      if (movementsRes.error) throw movementsRes.error;
      if (pendingRes.error) throw pendingRes.error;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const bucketName = 'imagenes-productos';

      _productsWithSku.value = Object.fromEntries(productsRes.data.map(p => {
        const imageUrl = p.url_imagen ? `${supabaseUrl}/storage/v1/object/public/${bucketName}/${p.url_imagen}` : null;
        return [p.descripcion, { sku: p.sku, url_imagen: imageUrl }];
      }));

      _materialStock.value = Object.fromEntries(stockRes.data.map(s => [s.producto_sku, s.cantidad]));
      console.log('Material stock actualizado:', _materialStock.value);
      _movements.value = movementsRes.data.map(m => ({
        id: m.id, fechaPedido: m.fecha_pedido, fechaEntrega: m.fecha_entrega, pallets: m.pallets, comentarios: m.comentarios, items: m.elementos, tipo: m.tipo, created_at: m.created_at
      }));

      _pendingIncomings.value = pendingRes.data || [];
      console.log('Pending incomings loaded:', _pendingIncomings.value.length);

    } catch (error) {
      showError('No se pudo cargar el inventario principal.');
      console.error('Error cargando inventario:', error);
    } finally {
      hasLoaded.value = true;
      console.log('loadFromServer completed');
      console.timeEnd('loadInventory');
    }
  }

  // ==============================================================================
  // --- FUNCIÓN recordManualInventoryCount (CORREGIDA) ---
  // ==============================================================================
  async function recordManualInventoryCount(newStockData, reason) {
    console.log('recordManualInventoryCount called with:', newStockData, reason);
    try {
      const productsBySku = Object.fromEntries(
        Object.entries(_productsWithSku.value).map(([desc, { sku }]) => [sku, desc])
      );
      console.log('productsBySku:', productsBySku);

      const changedItems = Object.entries(newStockData)
        .filter(([sku, newQuantity]) => newQuantity !== (_materialStock.value[sku] || 0))
        .map(([sku, newQuantity]) => ({ sku, desc: productsBySku[sku] || 'SKU Desconocido', cantidad: newQuantity }));

      console.log('changedItems:', changedItems);

      if (changedItems.length === 0) {
        console.log('No changes detected');
        showSuccess('No se detectaron cambios en el stock.');
        return;
      }

      // 1. PRIMERO, actualizamos la tabla 'stock' en la base de datos.
      console.log('Updating stock in DB...');
      const stockUpdates = changedItems.map(({ sku, cantidad }) =>
        supabase.from('stock').upsert({ producto_sku: sku, cantidad }, { onConflict: 'producto_sku' })
      );
      const results = await Promise.all(stockUpdates);
      console.log('Stock update results:', results);
      const updateError = results.some(res => res.error);
      if (updateError) {
        console.error('Stock update error:', results.find(res => res.error));
        throw new Error('Error al actualizar las cantidades de stock.');
      }

      // Actualizar localmente para UI inmediata
      changedItems.forEach(({ sku, cantidad }) => {
        _materialStock.value[sku] = cantidad;
      });

      // 2. SEGUNDO, si el stock se actualizó bien, registramos el movimiento en el historial.
      console.log('Inserting movement...');
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
        console.error('Movement insert error:', insertError);
        throw new Error('El stock se actualizó, pero falló el registro en el historial.');
      }

      console.log('Ajuste registrado, llamando a loadFromServer...');
      showSuccess('Ajuste de inventario registrado con éxito.');

    } catch (error) {
      showError(error.message || 'No se pudo completar el ajuste.');
      console.error("Error en recordManualInventoryCount:", error);
    } finally {
      // 3. PASE LO QUE PASE, recargamos los datos del servidor para que la app refleje la realidad.
      console.log('Ejecutando loadFromServer en finally...');
      await loadFromServer();
      console.log('loadFromServer completado.');
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
            .upsert({ producto_sku: item.sku, cantidad: recalculatedStock }, { onConflict: 'producto_sku' });
          
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
  // ==============================================================================
  // --- FUNCIÓN addMovement (IMPLEMENTADA) ---
  // ==============================================================================
  async function addMovement(movementData) {
    console.log('addMovement called with:', movementData);
    try {
      const { fechaPedido, fechaEntrega, pallets, comentarios, items, tipo } = movementData;

      const movementRecord = {
        fecha_pedido: fechaPedido,
        fecha_entrega: fechaEntrega,
        pallets: pallets,
        comentarios: comentarios || '',
        elementos: items,
        tipo: tipo,
      };

      console.log('Inserting movement:', movementRecord);
      const { error } = await supabase.from('MOVIMIENTOS').insert([movementRecord]);
      if (error) throw error;
      console.log('Movement inserted successfully');

      // Actualizar stock si es Entrada o Salida
      if (tipo === 'Entrada' || tipo === 'Salida') {
        console.log('Updating stock for', tipo);
        for (const item of items) {
          const { data: current } = await supabase.from('stock').select('cantidad').eq('producto_sku', item.sku).single();
          const currentQty = current?.cantidad || 0;
          const newQty = tipo === 'Entrada' ? currentQty + item.cantidad : currentQty - item.cantidad;
          console.log(`Updating stock for ${item.sku}: ${currentQty} -> ${newQty}`);
          const { error: upsertError } = await supabase.from('stock').upsert({ producto_sku: item.sku, cantidad: newQty });
          if (upsertError) {
            console.error('Error upserting stock:', upsertError);
            throw new Error('Movimiento registrado, pero error al actualizar stock.');
          }
        }
        console.log('Stock updated successfully');
      }

      // Crear notificación (no bloquear si falla)
      try {
        const notificationMessage = tipo === 'Salida' ? 'Nuevo pedido de traslado registrado' : 'Nueva entrada de inventario registrada';
        await createNotification(notificationMessage);
        console.log('Notification created');
      } catch (notificationError) {
        console.warn('Error creando notificación, pero movimiento registrado:', notificationError);
      }

      console.log('About to show success');
      showSuccess('Movimiento registrado con éxito.');

    } catch (error) {
      showError('No se pudo registrar el movimiento.');
      console.error('Error en addMovement:', error);
    } finally {
      // Recargar datos para actualizar la UI
      await loadFromServer();
    }
  }

  async function fetchPendingIncomings() {
    console.log('fetchPendingIncomings called');
    try {
      const { data, error } = await supabase.from('entradas_pendientes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      _pendingIncomings.value = data || [];
      console.log('Pending incomings loaded:', _pendingIncomings.value.length);
    } catch (error) {
      console.error('Error fetching pending incomings:', error);
    }
  }

  async function approvePendingIncoming(pendingEntry, movementDetails) {
    console.log('approvePendingIncoming called with:', pendingEntry.id, movementDetails);
    let movementInserted = false;
    let stockUpdated = false;
    try {
      // Create movement
      const movementData = {
        fecha_pedido: pendingEntry.fecha_albaran || new Date().toISOString().slice(0, 10),
        fecha_entrega: new Date().toISOString().slice(0, 10),
        pallets: movementDetails.pallets,
        comentarios: `Entrada desde albarán - Proveedor: ${pendingEntry.proveedor || 'N/A'}`,
        elementos: movementDetails.items,
        tipo: 'Entrada'
      };
      console.log('Inserting movement:', movementData);
      const { data: insertedMovement, error: insertError } = await supabase.from('MOVIMIENTOS').insert([movementData]).select('id');
      if (insertError) throw insertError;
      movementInserted = true;
      const movementId = insertedMovement[0].id;
      console.log('Movement inserted with ID:', movementId);

      // Update stock
      const stockUpdates = [];
      for (const item of movementDetails.items) {
        const { data: current } = await supabase.from('stock').select('cantidad').eq('producto_sku', item.sku).single();
        const currentQty = current?.cantidad || 0;
        const newQty = currentQty + item.cantidad;
        console.log(`Updating stock for ${item.sku}: ${currentQty} -> ${newQty}`);
        stockUpdates.push({ sku: item.sku, newQty, oldQty: currentQty });
        const { error: upsertError } = await supabase.from('stock').upsert({ producto_sku: item.sku, cantidad: newQty }, { onConflict: 'producto_sku' });
        if (upsertError) throw upsertError;
      }
      stockUpdated = true;

      // Delete from pending
      console.log('Deleting pending entry:', pendingEntry.id);
      const { error: deleteError } = await supabase.from('entradas_pendientes').delete().eq('id', pendingEntry.id);
      if (deleteError) throw deleteError;

      showSuccess('Entrada aprobada y stock actualizado.');
      console.log('Approval successful');

      // Refresh
      await fetchPendingIncomings();
      await loadFromServer();

    } catch (error) {
      console.error('Error in approvePendingIncoming:', error);
      showError('Error al aprobar la entrada. Revirtiendo cambios si es posible.');

      // Simular rollback: revertir stock si se actualizó
      if (stockUpdated) {
        console.log('Attempting to revert stock updates');
        try {
          for (const update of stockUpdates) {
            const { error: revertError } = await supabase.from('stock').upsert({ producto_sku: update.sku, cantidad: update.oldQty }, { onConflict: 'producto_sku' });
            if (revertError) console.error('Error reverting stock for', update.sku, revertError);
          }
          console.log('Stock reverted');
        } catch (revertError) {
          console.error('Failed to revert stock:', revertError);
        }
      }

      // Si movimiento insertado pero stock falló, el movimiento queda (puedes decidir borrarlo)
      if (movementInserted && !stockUpdated) {
        console.log('Movement inserted but stock failed - movement remains for audit');
      }

      // Refresh anyway
      await fetchPendingIncomings();
      await loadFromServer();
    }
  }

  // --- OTRAS FUNCIONES (addProduct, recordManualInventoryCount, etc.) ---
  // Estas funciones se quedan como estaban, ya que su lógica era correcta.
  // ... (Aquí irían el resto de funciones: addProduct, deleteProduct, etc. las he omitido por brevedad pero deben estar en tu archivo)
  async function addProduct(productInfo) { /* ... */ }
  async function deleteProduct(productDesc) { /* ... */ }
  async function recordManualInventoryCount(newStockData, reason) { /* ... */ }


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