import { ref, readonly } from 'vue';
import { useToasts } from './useToasts';
import { useNotifications } from './useNotifications';
import { supabase } from '../supabase';

const _productsWithSku = ref({});
const _materialStock = ref({});
const _movements = ref([]);
const _pendingIncomings = ref([]);
const hasLoaded = ref(false);
const isLoading = ref(false);
const updateCounter = ref(0);

export function useInventory() {
  const { showSuccess, showError } = useToasts();
  const { createNotification } = useNotifications();

  async function loadFromServer() {
    if (hasLoaded.value || isLoading.value) return;
    isLoading.value = true;
    console.log('loadFromServer: Iniciando carga de datos...');
    try {
      const [productsRes, stockRes, movementsRes, pendingRes] = await Promise.all([
        supabase.from('productos').select('sku, descripcion, url_imagen'),
        supabase.from('stock').select('*'),
        supabase.from('MOVIMIENTOS').select('*').order('created_at', { ascending: false }),
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
      _movements.value = movementsRes.data.map(m => ({
        id: m.id, fechaPedido: m.fecha_pedido, fechaEntrega: m.fecha_entrega, pallets: m.pallets, comentarios: m.comentarios, items: m.elementos, tipo: m.tipo, created_at: m.created_at
      }));
      _pendingIncomings.value = pendingRes.data || [];
      console.log('loadFromServer: Carga de datos completada con éxito.');
      console.log('[DEBUG] Products loaded:', Object.keys(_productsWithSku.value));
      updateCounter.value++;
      hasLoaded.value = true;

    } catch (error) {
      showError('No se pudo cargar el inventario principal.');
      console.error('Error en loadFromServer:', error);
    } finally {
      isLoading.value = false;
    }
  }

  if (!hasLoaded.value) {
    loadFromServer();
  }

  async function addProduct(productInfo) {
    console.log('[DEBUG] addProduct called with productInfo:', productInfo);
    try {
      const { data: productData, error: productError } = await supabase
        .from('productos')
        .insert({
          descripcion: productInfo.desc,
          sku: productInfo.sku,
        })
        .select()
        .single();
      
      if (productError) throw productError;

      const { error: stockError } = await supabase
        .from('stock')
        .upsert({
          producto_sku: productData.sku,
          cantidad: productInfo.stockInicial
        }, { onConflict: 'producto_sku' });

      if (stockError) {
        await supabase.from('productos').delete().eq('sku', productData.sku);
        throw stockError;
      }
      
      showSuccess('Material añadido con éxito.');
      hasLoaded.value = false;
      await loadFromServer();
      
    } catch (error) {
      if (error.code === '23505') {
        showError('Error: El SKU ya existe. Elige un código único.');
      } else {
        showError('No se pudo añadir el nuevo material.');
      }
      console.error('Error en addProduct:', error);
    }
  }

  async function deleteProduct(productSku) {
    console.log('[DEBUG] deleteProduct called with sku:', productSku);
    console.log('[DEBUG] Checking if product exists...');
    const { data: existingProduct, error: checkError } = await supabase
      .from('productos')
      .select('sku, descripcion')
      .eq('sku', productSku)
      .single();

    if (checkError || !existingProduct) {
      console.error('[DEBUG] Product not found or error checking existence:', checkError);
      showError('Producto no encontrado.');
      return;
    }
    console.log('[DEBUG] Product exists, proceeding with deletion.');

    // Obtener la cantidad actual de stock antes de borrar
    const { data: stockData, error: stockCheckError } = await supabase
      .from('stock')
      .select('cantidad')
      .eq('producto_sku', productSku)
      .single();

    const currentStock = stockData ? Number(stockData.cantidad) : 0;

    try {
      console.log('[DEBUG] Deleting from stock table...');
      const { error: stockError } = await supabase
        .from('stock')
        .delete()
        .eq('producto_sku', productSku);

      if (stockError && stockError.code !== 'PGRST204') {
        console.error('[DEBUG] Error deleting from stock:', stockError);
        throw stockError;
      }
      console.log('[DEBUG] Stock deletion successful or no stock found.');

      console.log('[DEBUG] Deleting from productos table...');
      const { error: productError } = await supabase
        .from('productos')
        .delete()
        .eq('sku', productSku);

      if (productError) {
        console.error('[DEBUG] Error deleting from productos:', productError);
        throw productError;
      }
      console.log('[DEBUG] Product deletion successful.');

      // Registrar movimiento de eliminación si había stock
      if (currentStock > 0) {
        const deleteMovementData = {
          fechaPedido: new Date().toISOString().slice(0, 10),
          fechaEntrega: new Date().toISOString().slice(0, 10),
          pallets: currentStock,
          comentarios: `Eliminación de producto: ${existingProduct.descripcion} (SKU: ${productSku})`,
          items: [{ sku: productSku, desc: existingProduct.descripcion, cantidad: currentStock }],
          tipo: 'Eliminación',
        };
        await addMovement(deleteMovementData);
        console.log('[DEBUG] Deletion movement registered.');
      }

      showSuccess('Material borrado con éxito.');
      hasLoaded.value = false;
      await loadFromServer();
      console.log('[DEBUG] Data reloaded after deletion.');
      console.log('[DEBUG] materialStock after delete:', _materialStock.value);

    } catch (error) {
      if (error.code === '23503') {
        showError('Error: Este material no se puede borrar porque tiene movimientos en el historial.');
        console.log('[DEBUG] Deletion blocked due to foreign key constraint.');
      } else {
        showError('No se pudo borrar el material.');
        console.error('[DEBUG] Unexpected error in deleteProduct:', error);
      }
    }
  }
  
  async function addMovement(movementData) {
    try {
      const { fechaPedido, fechaEntrega, pallets, comentarios, items, tipo } = movementData;

      const { error: insertError } = await supabase.from('MOVIMIENTOS').insert([{
        fecha_pedido: fechaPedido,
        fecha_entrega: fechaEntrega,
        pallets,
        comentarios: comentarios || '',
        elementos: items,
        tipo,
      }]);
      if (insertError) throw insertError;

      // Solo actualizar stock para tipos que afectan inventario físico
      if (tipo !== 'Eliminación') {
        for (const item of items) {
          const amountChange = tipo === 'Salida' ? -Number(item.cantidad) : Number(item.cantidad);
          const { error: rpcError } = await supabase.rpc('actualizar_stock', {
              sku_producto: item.sku,
              cantidad_cambio: amountChange
          });
          if (rpcError) throw rpcError;
        }
      }

      // No mostrar notificación de éxito para evitar spam
      // showSuccess(`Movimiento de "${tipo}" registrado con éxito.`);

    } catch (error) {
      showError(`No se pudo registrar el movimiento de "${movementData.tipo}".`);
      console.error('Error en addMovement:', error);
    } finally {
      hasLoaded.value = false;
      await loadFromServer();
    }
  }

  async function recordManualInventoryCount(newStockCounts, reason) {
    try {
      const currentStock = _materialStock.value;
      const itemsToUpdate = [];
      const movementItems = [];

      for (const sku in newStockCounts) {
        const newQuantity = Number(newStockCounts[sku]);
        const oldQuantity = Number(currentStock[sku] || 0);

        if (newQuantity !== oldQuantity) {
          const productDesc = Object.keys(_productsWithSku.value).find(
            desc => _productsWithSku.value[desc].sku === sku
          ) || 'SKU Desconocido';
          
          itemsToUpdate.push({ sku, newQuantity });
          movementItems.push({ sku, desc: productDesc, cantidad_anterior: oldQuantity, cantidad_nueva: newQuantity, diferencia: newQuantity - oldQuantity });
        }
      }

      if (itemsToUpdate.length === 0) {
        showSuccess('No se detectaron cambios en el stock.');
        return;
      }

      const stockUpdatePromises = itemsToUpdate.map(item =>
        supabase.from('stock').upsert({ producto_sku: item.sku, cantidad: item.newQuantity }, { onConflict: 'producto_sku' })
      );
      await Promise.all(stockUpdatePromises);

      const { error: insertError } = await supabase.from('MOVIMIENTOS').insert([{
        fecha_pedido: new Date().toISOString().slice(0, 10),
        fecha_entrega: new Date().toISOString().slice(0, 10),
        comentarios: reason,
        tipo: 'Ajuste',
        elementos: movementItems,
        pallets: 0,
      }]);
      if (insertError) {
        showError('¡Atención! El stock se actualizó, pero falló el registro en el historial.');
        throw insertError;
      }

      showSuccess('Ajuste de inventario registrado con éxito.');
      hasLoaded.value = false;
      await loadFromServer();
      
    } catch (error) {
      showError('No se pudo completar el ajuste de inventario.');
      console.error("Error en recordManualInventoryCount:", error);
    } 
  }

  async function deleteMovement(movementId, movementType, itemsToRevert) {
    try {
      const { error: deleteError } = await supabase.from('MOVIMIENTOS').delete().eq('id', movementId);
      if (deleteError) throw deleteError;

      if (movementType === 'Entrada' || movementType === 'Salida') {
        for (const item of itemsToRevert) {
          const amountToRevert = movementType === 'Salida' ? Number(item.cantidad) : -Number(item.cantidad);
          await supabase.rpc('actualizar_stock', { sku_producto: item.sku, cantidad_cambio: amountToRevert });
        }
      }

      // No mostrar notificación de éxito para evitar spam
      // showSuccess('Movimiento anulado y stock revertido con éxito.');

    } catch (error) {
      showError('La operación de anulación no se pudo completar.');
      console.error('Error en la anulación:', error);
    } finally {
      hasLoaded.value = false;
      await loadFromServer();
    }
  }

  async function fetchPendingIncomings() {
    try {
      const { data, error } = await supabase.from('entradas_pendientes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      _pendingIncomings.value = data || [];
    } catch (error) {
      console.error('Error fetching pending incomings:', error);
    }
  }

  async function approvePendingIncoming(pendingEntry, movementDetails) {
    try {
      const movementData = {
        fechaPedido: pendingEntry.fecha_albaran || new Date().toISOString().slice(0, 10),
        fechaEntrega: new Date().toISOString().slice(0, 10),
        pallets: movementDetails.pallets,
        comentarios: `Entrada desde albarán - Proveedor: ${pendingEntry.proveedor || 'N/A'}`,
        items: movementDetails.items,
        tipo: 'Entrada'
      };
      await addMovement(movementData);

      const { error: deleteError } = await supabase.from('entradas_pendientes').delete().eq('id', pendingEntry.id);
      if (deleteError) throw deleteError;

      showSuccess('Entrada aprobada y stock actualizado.');
      await fetchPendingIncomings();

    } catch (error) {
      showError('Error al aprobar la entrada. La operación fue cancelada.');
      console.error('Error in approvePendingIncoming:', error);
    }
  }

  return {
    productsWithSku: readonly(_productsWithSku),
    materialStock: readonly(_materialStock),
    movements: readonly(_movements),
    pendingIncomings: readonly(_pendingIncomings),
    hasLoaded: readonly(hasLoaded),
    updateCounter: readonly(updateCounter),

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