// RUTA: src/composables/useInventory.js (VERSIÓN FINAL PARA UNA SOLA TABLA)
import { ref, readonly } from 'vue';
import { useToasts } from './useToasts';
import { supabase } from '../supabase';

// --- ESTADO GLOBAL ---
// Guardaremos el estado en memoria después de calcularlo.
const _productsWithSku = ref({});
const _materialStock = ref({});
const _movements = ref([]);
const hasLoaded = ref(false);

// --- DATOS POR DEFECTO ---
// Estos son los datos "de fábrica" de la aplicación.
const defaultProducts = {
  "PALE 1200X800 C.81 LOGIFRUIT": { sku: "LOGIFRUIT81" },
  "CAJA PLAST IFCO 400X300 A-162 RF.BLL4314": { sku: "BLACK4314" },
  "CAJA PLST LOGIFRUIT 400X300 A-160 RF.316": { sku: "LOGIFRUIT316" },
  "CAJA PLAST IFCO 400X300 A-119 RF.BLL4310": { sku: "BLACK4310" },
  "CAJA PLAST EUROPOOL 400X300 A150 RF.154": { sku: "154CAJAVERDE" },
  "TARR. CILIN. PIÑA - PURA PIÑA - T1296": { sku: "PURAPIÑA" },
  "TARR. CILIN. PIÑA - ALDI - T1296": { sku: "ALDI1" },
  "TARR. CILIN. PIÑA - DEL MONTE - T1296": { sku: "DELMONTE" },
  "TARR. CILIN. PIÑA - MERCADONA - T1296": { sku: "HACENDADO1" },
  "TAPA TARRINA CILINDRO PINA": { sku: "TAPAPIÑA" },
  "TARRINA REDONDA D97,5 - H75 - T1398": { sku: "TARRINA97,5" },
  "CAJA CARTON 320X230 A-125 VERDE LIDL": { sku: "MONTADA A-125" },
  "TARRINA REDONDA D119 - H73,5 - T1835": { sku: "TARRINA119" },
  "TARR. RED. D97,5-H100-T1398 ZANAH.PALITO": { sku: "TARRINA ZANAHORIA" },
  "TARRINA K 2187-1AF": { sku: "TARRINA 1AF" },
};
const defaultStock = {
  "LOGIFRUIT81": 120, "BLACK4314": 80, "LOGIFRUIT316": 150, "BLACK4310": 110, "154CAJAVERDE": 95, "PURAPIÑA": 200, "ALDI1": 150, "DELMONTE": 180, "HACENDADO1": 75, "TAPAPIÑA": 250, "TARRINA97,5": 300, "MONTADA A-125": 50, "TARRINA119": 170, "TARRINA ZANAHORIA": 220, "TARRINA 1AF": 90
};


export function useInventory() {
  const { showSuccess, showError } = useToasts();

  async function loadFromServer() {
    if (hasLoaded.value) return;
    try {
      // 1. CARGAMOS la lista de productos desde el código.
      _productsWithSku.value = { ...defaultProducts };

      // 2. LEEMOS TODOS los movimientos de tu tabla `MOVIMIENTOS`.
      const { data: movementsData, error: movementsError } = await supabase.from('MOVIMIENTOS').select('*');
      if (movementsError) throw movementsError;
      
      _movements.value = movementsData.map(m => ({
        id: m.id, fechaPedido: m.fecha_pedido, fechaEntrega: m.fecha_entrega, pallets: m.pallets, comentarios: m.comentarios, items: m.elementos, tipo: m.tipo
      }));

      // 3. CALCULAMOS el stock actual en tiempo real.
      let calculatedStock = { ...defaultStock }; // Partimos del stock de fábrica
      for (const movement of _movements.value) {
          for (const item of movement.items) {
              if (movement.tipo === 'Entrada') {
                  calculatedStock[item.sku] = (calculatedStock[item.sku] || 0) + item.cantidad;
              } else { // Salida
                  calculatedStock[item.sku] = (calculatedStock[item.sku] || 0) - item.cantidad;
              }
          }
      }
      _materialStock.value = calculatedStock;
      
      showSuccess('Datos cargados desde la nube.');
    } catch (error) {
      showError('No se pudo cargar el inventario.');
      console.error('Error Supabase:', error);
    } finally {
      hasLoaded.value = true;
    }
  }
  
  async function addMovement(movementData) {
    // Esta función ahora solo inserta en MOVIMIENTOS.
    const { error } = await supabase.from('MOVIMIENTOS').insert([{
        fecha_pedido: movementData.fechaPedido, fecha_entrega: movementData.fechaEntrega, comentarios: movementData.comentarios, tipo: movementData.tipo, elementos: movementData.items, pallets: movementData.pallets
    }]);

    if (error) {
      showError('Error al guardar el movimiento.'); console.error(error); return;
    }
    
    // Forzamos una recarga completa para que el stock se recalcule.
    hasLoaded.value = false;
    await loadFromServer();
  }
  
  async function deleteMovement(movementId) {
    const { error } = await supabase.from('MOVIMIENTOS').delete().eq('id', movementId);

    if (error) {
      showError('Error al anular el movimiento.'); console.error(error); return;
    }
    
    showSuccess('Movimiento anulado con éxito.');
    hasLoaded.value = false;
    await loadFromServer();
  }

  // Las siguientes funciones son para gestionar la lista de productos y el stock en memoria.
  // No interactúan con la BD, ya que no tienes esas tablas.
  function addProduct(productInfo) {
    if (_productsWithSku.value[productInfo.desc] || Object.values(_productsWithSku.value).some(p => p.sku === productInfo.sku)) {
      showError('Error: La descripción o el SKU ya existen.'); return;
    }
    _productsWithSku.value[productInfo.desc] = { sku: productInfo.sku };
    _materialStock.value[productInfo.sku] = Number(productInfo.initialStock) || 0;
    showSuccess('¡Producto añadido con éxito! (Solo en esta sesión)');
  }

  function deleteProduct(productDesc) {
    const skuToDelete = _productsWithSku.value[productDesc]?.sku;
    if (_productsWithSku.value[productDesc]) {
      delete _productsWithSku.value[productDesc];
    }
    if (skuToDelete && _materialStock.value[skuToDelete]) {
      delete _materialStock.value[skuToDelete];
    }
    showSuccess('Material borrado con éxito. (Solo en esta sesión)');
  }
  
  function updateFullStock(newStock) {
    _materialStock.value = newStock;
    showSuccess('Stock actualizado. (Solo en esta sesión)');
  }

  return {
    productsWithSku: readonly(_productsWithSku),
    materialStock: readonly(_materialStock),
    movements: readonly(_movements),
    loadFromServer,
    addMovement,
    deleteMovement,
    addProduct,
    deleteProduct,
    updateFullStock
  };
}