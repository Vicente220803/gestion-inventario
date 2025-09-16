import { ref, readonly } from 'vue';
import { useToasts } from './useToasts';
import { supabase } from '../supabase';

// --- ESTADO GLOBAL DEL INVENTARIO ---
const _productsWithSku = ref({});
const _materialStock = ref({});
const _movements = ref([]);
const hasLoaded = ref(false);
const _pendingIncomings = ref([]);

export function useInventory() {
  const { showSuccess, showError } = useToasts();

  /**
   * Carga los datos principales del inventario (productos, stock, movimientos).
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
   * Carga las entradas de albaranes pendientes de revisión.
   */
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

  /**
   * Registra un movimiento (Entrada/Salida) y actualiza el stock.
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
    
    hasLoaded.value = false;
    await loadFromServer();
  }

  /**
   * Procesa la aprobación de una entrada pendiente del OCR.
   */
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

  /**
   * Añade un nuevo producto.
   */
  async function addProduct(productInfo) {
    const { error: productError } = await supabase.from('productos').insert({ sku: productInfo.sku, descripcion: productInfo.desc });
    if (productError) { showError('Error al crear producto. ¿SKU duplicado?'); console.error(productError); return; }
    const { error: stockError } = await supabase.from('stock').insert({ producto_sku: productInfo.sku, cantidad: productInfo.initialStock || 0 });
    if (stockError) { showError('Error al crear stock inicial.'); console.error(stockError); return; }
    showSuccess('¡Producto añadido con éxito!');
    hasLoaded.value = false;
    await loadFromServer();
  }

  /**
   * Registra un ajuste manual en el historial y actualiza el stock.
   */
  async function recordManualInventoryCount(newStockData) {
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
      comentarios: 'Recuento manual de inventario.',
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
  
  /**
   * Borra un producto si no está en uso.
   */
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

  /**
   * VERSIÓN DE DEPURACIÓN: Anula un movimiento y revierte el stock.
   * Esta versión tiene logs para encontrar el punto exacto del fallo.
   */
  async function deleteMovement(movementId, movementType, itemsToRevert) {
    console.log(`[DEBUG] 1. Iniciando anulación para el movimiento ID: ${movementId}`);
    
    try {
      // --- PASO 1: Revertir el stock ---
      console.log(`[DEBUG] 2. Revertiendo stock para un movimiento de tipo: "${movementType}"`);
      
      // Solo revertimos el stock para Entradas y Salidas.
      // Para 'Recuento Manual', no se toca el stock, solo se borra el registro.
      if (movementType === 'Entrada' || movementType === 'Salida') {
        for (const item of itemsToRevert) {
          const cantidad = Number(item.cantidad);
          if (isNaN(cantidad)) {
            console.error(`[ERROR] La cantidad para el item ${item.sku} no es un número. Saltando.`);
            continue;
          }

          const amountToRevert = movementType === 'Salida' ? cantidad : -cantidad;
          
          console.log(`[DEBUG] 3. Llamando a la función 'actualizar_stock' para SKU ${item.sku} con cantidad ${amountToRevert}`);
          const { error: rpcError } = await supabase.rpc('actualizar_stock', {
            sku_producto: item.sku,
            cantidad_cambio: amountToRevert
          });

          if (rpcError) {
            // Si hay un error aquí, lo mostraremos y detendremos todo.
            showError('Error CRÍTICO al revertir el stock.');
            console.error('[ERROR FATAL EN RPC]:', rpcError);
            throw new Error('Falló la llamada RPC a actualizar_stock');
          }
        }
      }

      // --- PASO 2: Borrar el movimiento del historial ---
      console.log('[DEBUG] 4. Borrando el movimiento del historial...');
      const { error: deleteError } = await supabase.from('MOVIMIENTOS').delete().eq('id', movementId);

      if (deleteError) {
        // Si hay un error aquí, lo mostraremos.
        showError('Error CRÍTICO al anular el movimiento del historial.');
        console.error('[ERROR FATAL EN DELETE]:', deleteError);
        throw new Error('Falló el borrado en la tabla MOVIMIENTOS');
      }

      console.log('[DEBUG] 5. Movimiento borrado con éxito.');
      showSuccess('Movimiento anulado con éxito.');
      
      // --- PASO 3: Recargar los datos de la aplicación ---
      console.log('[DEBUG] 6. Recargando datos...');
      hasLoaded.value = false;
      await loadFromServer();

    } catch (error) {
      console.error('[DEBUG] La operación de anulación falló en algún punto.', error);
      showError('La operación de anulación no se pudo completar.');
    }
  }

  // Se exponen todas las funciones y el estado (como solo lectura)
  return {
    // Estado
    productsWithSku: readonly(_productsWithSku),
    materialStock: readonly(_materialStock),
    movements: readonly(_movements),
    pendingIncomings: readonly(_pendingIncomings),

    // Funciones
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