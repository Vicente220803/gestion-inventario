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
    if (hasLoaded.value) return;
    try {
      // 1. Pedimos la columna 'url_imagen' que ahora contiene el nombre del archivo.
      const [productsRes, stockRes, movementsRes] = await Promise.all([
        supabase.from('productos').select('sku, descripcion, url_imagen'),
        supabase.from('stock').select('*'),
        supabase.from('MOVIMIENTOS').select('*').order('created_at', { ascending: true })
      ]);

      if (productsRes.error) throw productsRes.error;
      if (stockRes.error) throw stockRes.error;
      if (movementsRes.error) throw movementsRes.error;

      // 2. CONSTRUIMOS LA URL COMPLETA AUTOMÁTICAMENTE
      const supabaseUrl = 'https://wktqxfudyskiffqvzttf.supabase.co'; // Tu URL de Supabase
      const bucketName = 'imagenes-productos'; // El nombre de tu bucket

      _productsWithSku.value = Object.fromEntries(productsRes.data.map(p => {
        // Si hay un nombre de archivo en la columna, creamos la URL. Si no, la dejamos nula.
        const imageUrl = p.url_imagen 
          ? `${supabaseUrl}/storage/v1/object/public/${bucketName}/${p.url_imagen}`
          : null;
        
        return [p.descripcion, { sku: p.sku, url_imagen: imageUrl }];
      }));
      
      _materialStock.value = Object.fromEntries(stockRes.data.map(s => [s.producto_sku, s.cantidad]));
      _movements.value = movementsRes.data.map(m => ({
        id: m.id, fechaPedido: m.fecha_pedido, fechaEntrega: m.fecha_entrega, pallets: m.pallets, comentarios: m.comentarios, items: m.elementos, tipo: m.tipo, created_at: m.created_at
      }));
      
      if (!hasLoaded.value) { showSuccess('Datos de inventario cargados.'); }
    } catch (error) {
      showError('No se pudo cargar el inventario principal.');
      console.error('Error cargando inventario:', error);
    } finally {
      hasLoaded.value = true;
    }
  }

  // ... (El resto de funciones del archivo se quedan exactamente igual)
  // ... (fetchPendingIncomings, addMovement, approvePendingIncoming, etc.)

  async function fetchPendingIncomings() {
    try {
      const { data, error } = await supabase
        .from('entradas_pendientes')
        .select('*')
        .eq('status', 'pendiente')
        .order('created_at', { ascending: true });

      if (error) throw error;
      _pendingIncomings.value = data;
    } catch (error) {
      showError('No se pudieron cargar las entradas pendientes.');
      console.error('Error cargando entradas pendientes:', error);
    }
  }

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
    
    hasLoaded.value = false;
    await loadFromServer();
  }

  async function approvePendingIncoming(pendingEntry, movementDetails) {
    try {
      const newMovement = {
        fechaPedido: new Date().toISOString().slice(0, 10),
        fechaEntrega: new Date().toISOString().slice(0, 10),
        comentarios: `Entrada aprobada desde albarán. ID Pendiente: ${pendingEntry.id}.`,
        tipo: 'Entrada',
        items: movementDetails.items,
        pallets: movementDetails.pallets
      };
      await addMovement(newMovement);
      const { error: updateError } = await supabase
        .from('entradas_pendientes')
        .update({ status: 'aprobado' })
        .eq('id', pendingEntry.id);
      if (updateError) throw updateError;
      showSuccess('¡Entrada aprobada y registrada en el historial!');
      await fetchPendingIncomings();
    } catch (error) {
      showError('Error al aprobar la entrada.');
      console.error('Error aprobando:', error);
    }
  }

  async function addProduct(productInfo) {
    const { error: productError } = await supabase.from('productos').insert({ sku: productInfo.sku, descripcion: productInfo.desc });
    if (productError) { showError('Error al crear producto. ¿SKU duplicado?'); console.error(productError); return; }
    const { error: stockError } = await supabase.from('stock').insert({ producto_sku: productInfo.sku, cantidad: productInfo.initialStock || 0 });
    if (stockError) { showError('Error al crear stock inicial.'); console.error(stockError); return; }
    showSuccess('¡Producto añadido con éxito!');
    hasLoaded.value = false;
    await loadFromServer();
  }

  async function recordManualInventoryCount(newStockData, reason) {
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
      showError('Error al registrar el ajuste en el historial.');
      console.error("Error de Supabase al insertar movimiento:", insertError);
      return; 
    }
    const updates = changedItems.map(({ sku, cantidad }) =>
      supabase.from('stock').update({ cantidad }).eq('producto_sku', sku)
    );
    const results = await Promise.all(updates);
    if (results.some(res => res.error)) {
      showError('Error al actualizar las cantidades de stock.');
    } else {
      showSuccess('Ajuste de inventario registrado con éxito en el historial.');
    }
    hasLoaded.value = false;
    await loadFromServer();
    await fetchPendingIncomings();
  }
  
  async function deleteProduct(productDesc) {
    const isProductInUse = _movements.value.some(m => m.items.some(i => i.desc === productDesc));
    if (isProductInUse) {
      showError('No se puede borrar material con movimientos en el historial.');
      return;
    }
    const skuToDelete = _productsWithSku.value[productDesc]?.sku;
    if (!skuToDelete) return;
    await supabase.from('stock').delete().eq('producto_sku', skuToDelete);
    await supabase.from('productos').delete().eq('sku', skuToDelete);
    showSuccess('Material borrado con éxito.');
    hasLoaded.value = false;
    await loadFromServer();
  }

  async function deleteMovement(movementId, movementType, itemsToRevert) {
    try {
      if (movementType === 'Entrada' || movementType === 'Salida') {
        for (const item of itemsToRevert) {
          const amountToRevert = movementType === 'Salida' ? Number(item.cantidad) : -Number(item.cantidad);
          const { error: rpcError } = await supabase.rpc('actualizar_stock', {
            sku_producto: item.sku,
            cantidad_cambio: amountToRevert
          });
          if (rpcError) throw rpcError;
        }
      } else if (movementType === 'Recuento Manual' || movementType === 'Ajuste') {
        const { error: deleteError } = await supabase.from('MOVIMIENTOS').delete().eq('id', movementId);
        if (deleteError) throw deleteError;

        for (const item of itemsToRevert) {
          const { data: allMovementsForItem, error: historyError } = await supabase
            .from('MOVIMIENTOS')
            .select('tipo, elementos')
            .order('created_at', { ascending: true });

          if (historyError) throw historyError;
          
          let recalculatedStock = 0;
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
          
          const { error: updateError } = await supabase
            .from('stock')
            .update({ cantidad: recalculatedStock })
            .eq('producto_sku', item.sku);
          
          if (updateError) throw updateError;
        }
      }

      if (movementType === 'Entrada' || movementType === 'Salida') {
          const { error: deleteError } = await supabase.from('MOVIMIENTOS').delete().eq('id', movementId);
          if (deleteError) throw deleteError;
      }

      showSuccess('Movimiento anulado y stock revertido con éxito.');
      
    } catch (error) {
      showError('La operación de anulación no se pudo completar.');
      console.error('Error en la anulación:', error);
    } finally {
      hasLoaded.value = false;
      await loadFromServer();
    }
  }

  return {
    productsWithSku: readonly(_productsWithSku),
    materialStock: readonly(_materialStock),
    movements: readonly(_movements),
    pendingIncomings: readonly(_pendingIncomings),
    loadFromServer,
    fetchPendingIncomings,
    addMovement,
    approvePendingIncoming,
    addProduct,
    recordManualInventoryCount,
    deleteProduct,
    deleteMovement,
  };
}