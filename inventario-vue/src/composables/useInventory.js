// CÓDIGO DEFINITIVO para: src/composables/useInventory.js

import { ref, readonly } from 'vue';

// Estado global reactivo (privado dentro de este módulo)
const _productsWithSku = ref({});
const _materialStock = ref({});
const _movements = ref([]);

// Función principal del composable
export function useInventory() {

  // --- Carga y Guardado (Persistencia) ---
  const loadFromLocalStorage = () => {
    const storedProducts = localStorage.getItem('productsWithSku');
    _productsWithSku.value = storedProducts ? JSON.parse(storedProducts) : {
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

    const storedStock = localStorage.getItem('materialStock');
    _materialStock.value = storedStock ? JSON.parse(storedStock) : {
      "LOGIFRUIT81": 120, "BLACK4314": 80, "LOGIFRUIT316": 150, "BLACK4310": 110, "154CAJAVERDE": 95, "PURAPIÑA": 200, "ALDI1": 150, "DELMONTE": 180, "HACENDADO1": 75, "TAPAPIÑA": 250, "TARRINA97,5": 300, "MONTADA A-125": 50, "TARRINA119": 170, "TARRINA ZANAHORIA": 220, "TARRINA 1AF": 90
    };

    const storedMovements = localStorage.getItem('inventoryMovements');
    _movements.value = storedMovements ? JSON.parse(storedMovements) : [];
  };

  const saveToLocalStorage = () => {
    localStorage.setItem('productsWithSku', JSON.stringify(_productsWithSku.value));
    localStorage.setItem('materialStock', JSON.stringify(_materialStock.value));
    localStorage.setItem('inventoryMovements', JSON.stringify(_movements.value));
  };

  // --- ACCIONES para modificar el estado ---
// Anula un movimiento: revierte su efecto en el stock y lo elimina del historial.
const deleteMovement = (movementToDelete) => {
  // 1. Revertir el efecto en el stock
  if (movementToDelete.tipo === 'Salida') {
    // Si fue una salida, VOLVEMOS A SUMAR los artículos al stock
    movementToDelete.items.forEach(item => {
      _materialStock.value[item.sku] = (_materialStock.value[item.sku] || 0) + Number(item.cantidad);
    });
  } else { // Si fue una Entrada
    // RESTAMOS los artículos del stock
    movementToDelete.items.forEach(item => {
      _materialStock.value[item.sku] = (_materialStock.value[item.sku] || 0) - Number(item.cantidad);
    });
  }

  // 2. Eliminar el movimiento del historial
  // Buscamos el índice del movimiento a borrar para eliminarlo del array
  const index = _movements.value.findIndex(m => m === movementToDelete);
  if (index > -1) {
    _movements.value.splice(index, 1);
  }
  
  // 3. Guardar todos los cambios
  saveToLocalStorage();
};

  const addMovement = (movementData) => {
    _movements.value.push(movementData);
    if (movementData.tipo === 'Salida') {
      movementData.items.forEach(item => { _materialStock.value[item.sku] = (_materialStock.value[item.sku] || 0) - Number(item.cantidad); });
    } else if (movementData.tipo === 'Entrada') {
      movementData.items.forEach(item => { _materialStock.value[item.sku] = (_materialStock.value[item.sku] || 0) + Number(item.cantidad); });
    }
    saveToLocalStorage();
  };
  
  const addProduct = (productInfo) => {
    if (_productsWithSku.value[productInfo.desc] || Object.values(_productsWithSku.value).some(p => p.sku === productInfo.sku)) {
      alert('Error: La descripción o el SKU de este producto ya existen.'); return;
    }
    _productsWithSku.value[productInfo.desc] = { sku: productInfo.sku };
    _materialStock.value[productInfo.sku] = Number(productInfo.initialStock) || 0;
    saveToLocalStorage();
    alert('¡Producto añadido con éxito!');
  };
  
  const updateFullStock = (newStock) => {
    _materialStock.value = newStock;
    saveToLocalStorage();
  };

  const clearAllData = () => {
    _movements.value = [];
    _materialStock.value = {};
    _productsWithSku.value = {};
    localStorage.removeItem('inventoryMovements');
    localStorage.removeItem('materialStock');
    localStorage.removeItem('productsWithSku');
  };

  // --- VALORES EXPUESTOS ---
  // La función de cálculo ya no vive aquí.
  return {
    productsWithSku: readonly(_productsWithSku),
    materialStock: readonly(_materialStock),
    movements: readonly(_movements),
    loadFromLocalStorage,
    addMovement,
    addProduct,
    updateFullStock,
    deleteMovement,
    clearAllData,
  };
}