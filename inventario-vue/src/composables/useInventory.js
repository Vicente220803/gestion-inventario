// RUTA: src/composables/useInventory.js (VERSIÓN FINAL COMPLETA CON SUPABASE)
import { ref, readonly } from 'vue';
import { useToasts } from './useToasts';
import { supabase } from '../supabase'; // IMPORTAMOS NUESTRO CLIENTE DE SUPABASE

// El estado sigue siendo el mismo: guardaremos los datos de la BD aquí
const _productsWithSku = ref({});
const _materialStock = ref({});
const _movements = ref([]);
const hasLoaded = ref(false);

export function useInventory() {
  const { showSuccess, showError } = useToasts();

  // --- NUEVA LÓGICA DE CARGA DESDE EL SERVIDOR ---
  async function loadFromServer() {
    // Para evitar recargas innecesarias, pero permitiendo refrescar
    // if (hasLoaded.value) return; 

    try {
      // Usamos Promise.all para cargar todo en paralelo, es más rápido
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
      showError('No se pudo cargar el inventario desde la base de datos.');
      console.error('Error Supabase:', error);
    } finally {
      hasLoaded.value = true;
    }
  }
  
  // --- ACCIONES ADAPTADAS A SUPABASE ---
  
  async function addMovement(movementData) {
    // 1. Insertar el nuevo movimiento
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

    // 2. Actualizar el stock
    for (const item of movementData.items) {
      const { error: stockError } = await supabase.rpc('actualizar_stock', {
          sku_producto: item.sku,
          cantidad_cambio: movementData.tipo === 'Salida' ? -item.cantidad : item.cantidad
      });
       if (stockError) {
        showError(`Error al actualizar el stock para ${item.sku}.`);
        console.error('Error Supabase:', stockError);
      }
    }
    
    // 3. Volver a cargar los datos para refrescar la interfaz
    await loadFromServer();
  }
  
  async function addProduct(productInfo) {
    // 1. Insertar en la tabla de productos
    const { error: productError } = await supabase.from('productos').insert({
      sku: productInfo.sku,
      descripcion: productInfo.desc
    });
    if (productError) {
        showError('Error al crear el producto. ¿Quizás el SKU ya existe?');
        console.error(productError);
        return;
    }

    // 2. Insertar en la tabla de stock
    const { error: stockError } = await supabase.from('stock').insert({
        producto_sku: productInfo.sku,
        cantidad: productInfo.initialStock || 0
    });
    if (stockError) {
        showError('Error al establecer el stock inicial.');
        console.error(stockError);
        return;
    }

    showSuccess('¡Producto añadido con éxito!');
    await loadFromServer();
  }
  
  async function updateFullStock(newStock) {
    // Esta función es más compleja con la nueva estructura, requiere un bucle de updates.
    // Por ahora, la dejamos funcional pero menos optimizada.
    const updates = Object.entries(newStock).map(([sku, cantidad]) => 
      supabase.from('stock').update({ cantidad }).eq('producto_sku', sku)
    );
    
    const results = await Promise.all(updates);
    const someError = results.some(res => res.error);

    if (someError) {
        showError('Hubo un error al actualizar algunas entradas de stock.');
        console.error(results.map(r => r.error).filter(Boolean));
    } else {
        showSuccess('Stock actualizado con éxito.');
    }
    await loadFromServer();
  }

  async function deleteProduct(productDesc) {
    // ... (La lógica de comprobación de si está en uso sigue siendo válida)
    const isProductInUse = _movements.value.some(m => m.items.some(i => i.desc === productDesc));
    if (isProductInUse) {
      showError('No se puede borrar un material con movimientos en el historial.'); return;
    }

    const skuToDelete = _productsWithSku.value[productDesc]?.sku;
    if (!skuToDelete) return;

    // Borramos de la tabla de stock y de productos
    await supabase.from('stock').delete().eq('producto_sku', skuToDelete);
    await supabase.from('productos').delete().eq('sku', skuToDelete);
    
    showSuccess('Material borrado con éxito.');
    await loadFromServer();
  }

  async function deleteMovement(movementToDelete) {
    // 1. Revertir el stock
    for (const item of movementToDelete.items) {
      await supabase.rpc('actualizar_stock', {
        sku_producto: item.sku,
        // Invertimos la cantidad: si era salida (-), la anulación es (+).
        cantidad_cambio: movementToDelete.tipo === 'Salida' ? item.cantidad : -item.cantidad
      });
    }

    // 2. Borrar el movimiento
    await supabase.from('MOVIMIENTOS').delete().eq('id', movementToDelete.id);

    showSuccess('Movimiento anulado con éxito.');
    await loadFromServer();
  }

  // --- VALORES EXPUESTOS ---
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