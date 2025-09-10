// RUTA: src/composables/useInventory.js (VERSIÓN FINAL COMPLETA CON SUPABASE)
import { ref, readonly } from 'vue';
import { useToasts } from './useToasts';
import { supabase } from '../supabase';

const _productsWithSku = ref({});
const _materialStock = ref({});
const _movements = ref([]);
const hasLoaded = ref(false);

export function useInventory() {
  const { showSuccess, showError } = useToasts();

  async function loadFromServer() {
    // Evita recargas múltiples si no es necesario, pero permite refrescar
    // if (hasLoaded.value) return; 

    try {
      const [productsRes, stockRes, movementsRes] = await Promise.all([
        supabase.from('productos').select('*'),
        supabase.from('stock').select('*'),
        supabase.from('MOVIMIENTOS').select('*')
      ]);

      if (productsRes.error) throw productsRes.error;
      _productsWithSku.value = Object.fromEntries(productsRes.data.map(p => [p.descripcion, { sku: p.sku }]));

      if (stockRes.error) throw stockRes.error;
      _materialStock.value = Object.fromEntries(stockRes.data.map(s => [s.producto_sku, s.cantidad]));

      if (movementsRes.error) throw movementsRes.error;
      _movements.value = movementsRes.data.map(m => ({
        id: m.id,
        fechaPedido: m.fecha_pedido,
        fechaEntrega: m.fecha_entrega,
        pallets: m.pallets,
        comentarios: m.comentarios,
        items: m.elementos,
        tipo: m.tipo
      }));
      
      if (!hasLoaded.value) {
          showSuccess('Datos cargados desde la nube.');
      }
    } catch (error) {
      showError('No se pudo cargar el inventario.');
      console.error('Error Supabase:', error);
    } finally {
      hasLoaded.value = true;
    }
  }
  
  async function addMovement(movementData) {
    const { error: insertError } = await supabase.from('MOVIMIENTOS').insert([{
        fecha_pedido: movementData.fechaPedido,
        fecha_entrega: movementData.fechaEntrega,
        comentarios: movementData.comentarios,
        tipo: movementData.tipo,
        elementos: movementData.items,
        pallets: movementData.pallets
    }]);

    if (insertError) {
      showError('Error al guardar el movimiento.');
      console.error('Error Supabase:', insertError);
      return;
    }

    for (const item of movementData.items) {
      const { error: stockError } = await supabase.rpc('actualizar_stock', {
          sku_producto: item.sku,
          cantidad_cambio: movementData.tipo === 'Salida' ? -item.cantidad : item.cantidad
      });
       if (stockError) {
        showError(`Error al actualizar stock para ${item.sku}.`);
        console.error('Error Supabase:', stockError);
      }
    }
    
    await loadFromServer();
  }
  
  async function addProduct(productInfo) {
    const { error: productError } = await supabase.from('productos').insert({
      sku: productInfo.sku,
      descripcion: productInfo.desc
    });
    if (productError) {
        showError('Error al crear producto. ¿SKU duplicado?');
        console.error(productError);
        return;
    }

    const { error: stockError } = await supabase.from('stock').insert({
        producto_sku: productInfo.sku,
        cantidad: productInfo.initialStock || 0
    });
    if (stockError) {
        showError('Error al crear stock inicial.');
        console.error(stockError);
        return;
    }

    showSuccess('¡Producto añadido con éxito!');
    await loadFromServer();
  }
  
  async function updateFullStock(newStock) {
    const updates = Object.entries(newStock).map(([sku, cantidad]) => 
      supabase.from('stock').update({ cantidad }).eq('producto_sku', sku)
    );
    
    const results = await Promise.all(updates);
    const someError = results.some(res => res.error);

    if (someError) {
        showError('Hubo un error al actualizar algunas entradas de stock.');
        console.error(results.map(r => r.error).filter(Boolean));
    } else {
        showSuccess('Stock actualizado con éxito en la base de datos.');
    }
    await loadFromServer();
  }

  async function deleteProduct(productDesc) {
    const isProductInUse = _movements.value.some(m => m.items.some(i => i.desc === productDesc));
    if (isProductInUse) {
      showError('No se puede borrar material con movimientos en el historial.'); return;
    }

    const skuToDelete = _productsWithSku.value[productDesc]?.sku;
    if (!skuToDelete) return;

    await supabase.from('stock').delete().eq('producto_sku', skuToDelete);
    await supabase.from('productos').delete().eq('sku', skuToDelete);
    
    showSuccess('Material borrado con éxito.');
    await loadFromServer();
  }

  async function deleteMovement(movementId, movementType, itemsToRevert) {
    for (const item of itemsToRevert) {
      const { error: rpcError } = await supabase.rpc('actualizar_stock', {
        sku_producto: item.sku,
        cantidad_cambio: movementType === 'Salida' ? item.cantidad : -item.cantidad
      });
      if (rpcError) {
        showError(`Error al revertir stock para ${item.sku}.`);
        console.error(rpcError);
      }
    }

    const { error } = await supabase.from('MOVIMIENTOS').delete().eq('id', movementId);
    
    if (error) {
      showError('Error al anular el movimiento del historial.');
      console.error(error);
      return;
    }

    showSuccess('Movimiento anulado con éxito.');
    await loadFromServer();
  }

  return {
    productsWithSku: readonly(_productsWithSku),
    materialStock: readonly(_materialStock),
    movements: readonly(_movements),
    loadFromServer,
    addMovement,
    addProduct,
    updateFullStock,
    deleteProduct,
    deleteMovement,
  };
}