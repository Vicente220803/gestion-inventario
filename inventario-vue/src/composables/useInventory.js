import { ref, readonly } from 'vue';
import { useToasts } from './useToasts';
import { useNotifications } from './useNotifications';
import { supabase } from '../supabase';

const _productsWithSku = ref({});
const _materialStock = ref({});
const _stockConUnidades = ref({}); // Nuevo: Stock con información de unidades
const _stockLotes = ref({}); // Nuevo: Lotes por producto
const _movements = ref([]);
const _pendingIncomings = ref([]);
const hasLoaded = ref(false);
const isLoading = ref(false);
const updateCounter = ref(0);

export function useInventory() {
  const { showSuccess, showError, showInfo } = useToasts();
  const { createNotification } = useNotifications();

  async function loadFromServer() {
    if (hasLoaded.value || isLoading.value) return;
    isLoading.value = true;
    console.log('loadFromServer: Iniciando carga de datos...');
    try {
      const [productsRes, stockRes, stockUnidadesRes, movementsRes, pendingRes] = await Promise.all([
        supabase.from('productos').select('sku, descripcion, url_imagen, unidades_por_pallet'),
        supabase.from('stock').select('*'),
        supabase.from('stock_con_unidades').select('*'),
        supabase.from('MOVIMIENTOS').select('*').order('created_at', { ascending: false }),
        supabase.from('entradas_pendientes').select('*').order('created_at', { ascending: false })
      ]);

      if (productsRes.error) throw productsRes.error;
      if (stockRes.error) throw stockRes.error;
      if (stockUnidadesRes.error) throw stockUnidadesRes.error;
      if (movementsRes.error) throw movementsRes.error;
      if (pendingRes.error) throw pendingRes.error;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const bucketName = 'imagenes-productos';
      _productsWithSku.value = Object.fromEntries(productsRes.data.map(p => {
        const imageUrl = p.url_imagen ? `${supabaseUrl}/storage/v1/object/public/${bucketName}/${p.url_imagen}` : null;
        return [p.descripcion, {
          sku: p.sku,
          url_imagen: imageUrl,
          unidades_por_pallet: p.unidades_por_pallet || 1
        }];
      }));

      _materialStock.value = Object.fromEntries(stockRes.data.map(s => [s.producto_sku, s.cantidad]));

      // Cargar información de unidades
      _stockConUnidades.value = Object.fromEntries(
        stockUnidadesRes.data.map(s => [
          s.producto_sku,
          {
            pallets: s.pallets_totales,
            unidades_estandar: s.unidades_estandar,
            unidades_totales: s.unidades_totales,
            tiene_discrepancias: s.tiene_discrepancias
          }
        ])
      );

      _movements.value = movementsRes.data.map(m => ({
        id: m.id, fechaPedido: m.fecha_pedido, fechaEntrega: m.fecha_entrega, pallets: m.pallets, comentarios: m.comentarios, items: m.elementos, tipo: m.tipo, created_at: m.created_at
      }));
      _pendingIncomings.value = pendingRes.data || [];
      console.log('loadFromServer: Carga de datos completada con éxito.');
      console.log('[DEBUG] Products loaded:', Object.keys(_productsWithSku.value));
      console.log('[DEBUG] Stock con unidades loaded:', _stockConUnidades.value);
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
          unidades_por_pallet: productInfo.unidadesPorPallet || 1
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

      // Crear lote inicial si hay stock
      if (productInfo.stockInicial > 0) {
        const { error: loteError } = await supabase
          .from('stock_lotes')
          .insert({
            producto_sku: productData.sku,
            pallets: productInfo.stockInicial,
            unidades_por_pallet: productInfo.unidadesPorPallet || 1,
            unidades_totales: productInfo.stockInicial * (productInfo.unidadesPorPallet || 1)
          });

        if (loteError) {
          console.error('Error creando lote inicial:', loteError);
        }
      }

      showSuccess('Material añadido con éxito.');
      showInfo('Nuevo material registrado en el inventario.');
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
      showInfo('Material eliminado del inventario.');
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

      // Insertar movimiento y obtener su ID
      const { data: movementInserted, error: insertError } = await supabase
        .from('MOVIMIENTOS')
        .insert([{
          fecha_pedido: fechaPedido,
          fecha_entrega: fechaEntrega,
          pallets,
          comentarios: comentarios || '',
          elementos: items,
          tipo,
        }])
        .select('id')
        .single();

      if (insertError) throw insertError;

      const movementId = movementInserted?.id;

      // Solo actualizar stock para tipos que afectan inventario físico
      if (tipo !== 'Eliminación' && tipo !== 'Sin Pedido') {
        for (const item of items) {
          // Si el item tiene información de unidades, usar la función con unidades
          if (item.unidades_por_pallet && tipo === 'Entrada') {
            const { error: rpcError } = await supabase.rpc('actualizar_stock_con_unidades', {
              sku_producto: item.sku,
              cantidad_pallets: Number(item.cantidad),
              unidades_pallet: Number(item.unidades_por_pallet),
              movimiento_ref: movementId
            });
            if (rpcError) throw rpcError;

            // Crear notificación si hay discrepancia
            if (item.unidades_por_pallet !== item.unidades_estandar) {
              const diferencia = (item.unidades_por_pallet - item.unidades_estandar) * item.cantidad;
              await createNotification(
                `⚠️ Discrepancia en entrada: ${item.desc} (${diferencia > 0 ? '+' : ''}${diferencia} unidades)`,
                'warning'
              );
            }
          } else {
            // Usar la función tradicional para salidas y ajustes
            const amountChange = tipo === 'Salida' ? -Number(item.cantidad) : Number(item.cantidad);
            const { error: rpcError } = await supabase.rpc('actualizar_stock', {
              sku_producto: item.sku,
              cantidad_cambio: amountChange
            });
            if (rpcError) throw rpcError;
          }
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
      showInfo('Inventario actualizado manualmente.');
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
      showInfo('Nueva entrada registrada en el inventario.');
      await fetchPendingIncomings();

    } catch (error) {
      showError('Error al aprobar la entrada. La operación fue cancelada.');
      console.error('Error in approvePendingIncoming:', error);
    }
  }

  async function updateUnidadesPorPallet(sku, newUnidades) {
    console.log('[DEBUG] updateUnidadesPorPallet called with sku:', sku, 'newUnidades:', newUnidades);
    try {
      // Actualizar en tabla productos
      const { error: updateError } = await supabase
        .from('productos')
        .update({ unidades_por_pallet: newUnidades })
        .eq('sku', sku);

      if (updateError) throw updateError;

      // Actualizar lotes existentes con las nuevas unidades
      const { error: lotesError } = await supabase.rpc('actualizar_lotes_unidades', {
        sku_producto: sku,
        nuevas_unidades: newUnidades
      });

      // Si la función RPC no existe, actualizamos manualmente
      if (lotesError && lotesError.code === '42883') {
        // Actualizar lotes directamente
        const { data: lotes } = await supabase
          .from('stock_lotes')
          .select('id, pallets')
          .eq('producto_sku', sku)
          .gt('pallets', 0);

        if (lotes) {
          for (const lote of lotes) {
            await supabase
              .from('stock_lotes')
              .update({
                unidades_por_pallet: newUnidades,
                unidades_totales: lote.pallets * newUnidades
              })
              .eq('id', lote.id);
          }
        }
      } else if (lotesError) {
        console.warn('Error actualizando lotes:', lotesError);
      }

      showSuccess('Unidades por pallet actualizadas correctamente.');
      hasLoaded.value = false;
      await loadFromServer();

    } catch (error) {
      showError('No se pudo actualizar las unidades por pallet.');
      console.error('Error en updateUnidadesPorPallet:', error);
    }
  }

  /**
   * Ajusta las unidades reales de pallets incompletos en el inventario actual.
   * Registra un ajuste de inventario con las unidades reales que tienes físicamente.
   * @param {string} sku - SKU del producto
   * @param {number} palletsCompletos - Número de pallets con unidades completas
   * @param {number} palletsIncompletos - Número de pallets incompletos
   * @param {number} unidadesPalletsIncompletos - Unidades reales en los pallets incompletos
   * @param {string} motivo - Motivo del ajuste
   */
  async function ajustarUnidadesReales(sku, palletsCompletos, palletsIncompletos, unidadesPalletsIncompletos, motivo) {
    try {
      const productDesc = Object.keys(_productsWithSku.value).find(
        desc => _productsWithSku.value[desc].sku === sku
      ) || 'Producto Desconocido';

      const unidadesEstandar = _productsWithSku.value[productDesc]?.unidades_por_pallet || 1;
      const stockActual = _materialStock.value[sku] || 0;
      const totalPallets = palletsCompletos + palletsIncompletos;

      // Validaciones
      if (totalPallets !== stockActual) {
        showError(`El total de pallets (${totalPallets}) no coincide con el stock actual (${stockActual})`);
        return;
      }

      if (palletsIncompletos > 0 && unidadesPalletsIncompletos >= unidadesEstandar) {
        showError('Los pallets incompletos deben tener menos unidades que el estándar');
        return;
      }

      // Eliminar lotes antiguos de este producto
      const { error: deleteError } = await supabase
        .from('stock_lotes')
        .delete()
        .eq('producto_sku', sku);

      if (deleteError) throw deleteError;

      // Crear nuevos lotes que reflejen la realidad
      const lotesNuevos = [];

      // Lote de pallets completos (si hay)
      if (palletsCompletos > 0) {
        lotesNuevos.push({
          producto_sku: sku,
          pallets: palletsCompletos,
          unidades_por_pallet: unidadesEstandar,
          unidades_totales: palletsCompletos * unidadesEstandar,
          movimiento_id: null
        });
      }

      // Lote de pallets incompletos (si hay)
      if (palletsIncompletos > 0) {
        lotesNuevos.push({
          producto_sku: sku,
          pallets: palletsIncompletos,
          unidades_por_pallet: unidadesPalletsIncompletos,
          unidades_totales: palletsIncompletos * unidadesPalletsIncompletos,
          movimiento_id: null
        });
      }

      // Insertar nuevos lotes
      const { error: insertError } = await supabase
        .from('stock_lotes')
        .insert(lotesNuevos);

      if (insertError) throw insertError;

      // Registrar movimiento de ajuste
      const unidadesAntes = stockActual * unidadesEstandar;
      const unidadesDespues = (palletsCompletos * unidadesEstandar) + (palletsIncompletos * unidadesPalletsIncompletos);
      const diferenciaUnidades = unidadesDespues - unidadesAntes;

      await supabase.from('MOVIMIENTOS').insert([{
        fecha_pedido: new Date().toISOString().slice(0, 10),
        fecha_entrega: new Date().toISOString().slice(0, 10),
        comentarios: `${motivo} | ${productDesc}: ${palletsCompletos} pallets completos (${unidadesEstandar} uds/pallet) + ${palletsIncompletos} pallets incompletos (${unidadesPalletsIncompletos} uds/pallet) | Diferencia: ${diferenciaUnidades > 0 ? '+' : ''}${diferenciaUnidades} unidades`,
        tipo: 'Ajuste',
        elementos: [{
          sku,
          desc: productDesc,
          cantidad: stockActual,
          unidades_antes: unidadesAntes,
          unidades_despues: unidadesDespues,
          diferencia_unidades: diferenciaUnidades
        }],
        pallets: 0,
      }]);

      showSuccess('Ajuste de unidades reales registrado correctamente.');
      showInfo(`${productDesc}: ${diferenciaUnidades > 0 ? '+' : ''}${diferenciaUnidades} unidades ajustadas`);

      hasLoaded.value = false;
      await loadFromServer();

    } catch (error) {
      showError('No se pudo registrar el ajuste de unidades reales.');
      console.error('Error en ajustarUnidadesReales:', error);
    }
  }

  /**
   * Obtiene los lotes de un producto ordenados por FIFO (primero el más antiguo).
   * Permite detectar si hay pallets incompletos disponibles.
   * @param {string} sku - SKU del producto
   * @returns {Promise<Array>} Array de lotes con información de pallets y unidades
   */
  async function obtenerLotesProducto(sku) {
    try {
      const { data, error } = await supabase
        .from('stock_lotes')
        .select('*')
        .eq('producto_sku', sku)
        .gt('pallets', 0)
        .order('fecha_entrada', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error en obtenerLotesProducto:', error);
      return [];
    }
  }

  /**
   * Consume pallets de un lote específico (usado para salidas priorizadas).
   * @param {number} loteId - ID del lote
   * @param {number} palletsAConsumir - Cantidad de pallets a consumir
   */
  async function consumirLoteEspecifico(loteId, palletsAConsumir) {
    try {
      // Obtener el lote
      const { data: lote, error: fetchError } = await supabase
        .from('stock_lotes')
        .select('*')
        .eq('id', loteId)
        .single();

      if (fetchError) throw fetchError;

      if (lote.pallets < palletsAConsumir) {
        throw new Error('No hay suficientes pallets en el lote');
      }

      // Actualizar el lote
      const nuevosPallets = lote.pallets - palletsAConsumir;
      const nuevasUnidades = nuevosPallets * lote.unidades_por_pallet;

      const { error: updateError } = await supabase
        .from('stock_lotes')
        .update({
          pallets: nuevosPallets,
          unidades_totales: nuevasUnidades
        })
        .eq('id', loteId);

      if (updateError) throw updateError;

      return true;
    } catch (error) {
      console.error('Error en consumirLoteEspecifico:', error);
      throw error;
    }
  }

  return {
    productsWithSku: readonly(_productsWithSku),
    materialStock: readonly(_materialStock),
    stockConUnidades: readonly(_stockConUnidades),
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
    updateUnidadesPorPallet,
    ajustarUnidadesReales,
    obtenerLotesProducto,
    consumirLoteEspecifico,
  };
}