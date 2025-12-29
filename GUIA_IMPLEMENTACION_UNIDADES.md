# 📦 Guía de Implementación: Sistema de Unidades por Pallet

## 🎯 Objetivo de la Mejora

Implementar un sistema para registrar y trackear la cantidad exacta de **unidades** que contiene cada pallet de cada material, permitiendo:

1. ✅ Detectar cuando llegan pallets con menos/más unidades de lo esperado
2. ✅ Calcular el inventario total en unidades reales (no solo pallets)
3. ✅ Tener trazabilidad completa por lote/entrada
4. ✅ Recibir alertas cuando hay discrepancias en las unidades

---

## 📋 Pasos de Implementación

### PASO 1: Ejecutar la Migración de Base de Datos

**Archivo:** `migracion_unidades_pallet.sql`

#### Qué hace esta migración:

1. **Añade columna `unidades_por_pallet` a la tabla `productos`**
   - Valor por defecto: 1
   - Permite configurar cuántas unidades trae normalmente un pallet

2. **Crea tabla `stock_lotes`** para trazabilidad
   ```sql
   - id: Identificador del lote
   - producto_sku: Producto al que pertenece
   - movimiento_id: Movimiento que creó este lote
   - pallets: Cantidad de pallets en el lote
   - unidades_por_pallet: Unidades REALES en cada pallet de este lote
   - unidades_totales: Total de unidades (pallets × unidades_por_pallet)
   - fecha_entrada: Cuándo entró este lote
   ```

3. **Crea vista `stock_con_unidades`**
   - Combina datos de stock en pallets con unidades reales
   - Detecta automáticamente discrepancias
   - Facilita consultas de unidades totales

4. **Crea función `actualizar_stock_con_unidades()`**
   - Actualiza stock considerando unidades por pallet
   - Crea lotes automáticamente en entradas
   - Consume lotes por FIFO en salidas
   - Reemplaza a `actualizar_stock()` cuando se trabaja con unidades

5. **Migra datos existentes**
   - Asigna unidades_por_pallet = 1 a todos los productos
   - Crea un lote inicial por cada producto con stock actual

#### Cómo ejecutar:

**Opción A - Desde Supabase Dashboard:**
1. Ir a SQL Editor en Supabase
2. Copiar y pegar el contenido de `migracion_unidades_pallet.sql`
3. Ejecutar

**Opción B - Desde terminal con psql:**
```bash
psql -h <SUPABASE_HOST> -U postgres -d postgres -f migracion_unidades_pallet.sql
```

---

### PASO 2: Verificar Cambios en el Frontend

Los siguientes archivos ya han sido modificados:

#### ✅ `src/composables/useInventory.js`

**Cambios realizados:**
- Añadido estado `_stockConUnidades` y `_stockLotes`
- Modificado `loadFromServer()` para cargar vista `stock_con_unidades`
- Actualizado `addProduct()` para incluir `unidades_por_pallet` y crear lote inicial
- Modificado `addMovement()` para usar `actualizar_stock_con_unidades` en entradas con unidades
- Añadido sistema de alertas automáticas para discrepancias
- Exportado `stockConUnidades` para uso en componentes

#### ✅ `src/views/SettingsView.vue`

**Cambios realizados:**
- Añadido campo "Unidades por Pallet" al formulario de crear materiales
- Actualizado `newProduct` para incluir `unidadesPorPallet`
- Mostrar unidades por pallet en la lista de materiales actuales

#### ✅ `src/views/StockView.vue`

**Cambios realizados:**
- Importado `stockConUnidades` del composable
- Actualizado `allItems` para incluir:
  - `unidades_por_pallet`
  - `unidades_totales`
  - `tiene_discrepancias`
- Añadido `totalUnidades` computed
- Actualizado resumen de stock para mostrar "Total Pallets" y "Total Unidades"
- Añadidas columnas a la tabla:
  - "Uds/Pallet" (con ⚠️ si hay discrepancias)
  - "Total Unidades"

#### ✅ `src/views/IncomingsView.vue`

**Cambios realizados:**
- Actualizado `manualItems` para incluir `unidades_por_pallet` y `unidades_estandar`
- Modificado `updateManualSku()` para auto-rellenar unidades estándar
- Actualizado formulario con campos:
  - Input para "Uds/pallet" (con indicador visual si difiere del estándar)
  - Cálculo automático de unidades totales
  - Indicador de unidades estándar debajo del campo

---

## 🚀 Flujos de Uso

### Crear un Nuevo Material

1. Ir a **Settings (Materiales)**
2. Llenar formulario:
   - Descripción: "Tornillos M8"
   - SKU: "TORN-M8-001"
   - Stock Inicial: 10 pallets
   - **Unidades por Pallet: 1000** ← NUEVO
3. Guardar

**Resultado:**
- Se crea el producto con 1000 uds/pallet
- Se crea stock de 10 pallets
- Se crea un lote inicial: 10 pallets × 1000 uds = 10,000 unidades

---

### Registrar Entrada Manual

1. Ir a **Incomings (Entradas)**
2. Seleccionar material
3. Llenar:
   - Pallets: 5
   - **Uds/pallet: 950** ← NUEVO (el campo se auto-rellena con 1000, pero modificamos)
   - Verás: "= 4,750 uds" calculado automáticamente
   - El campo se marcará en naranja porque difiere del estándar (1000)
4. Registrar entrada

**Resultado:**
- Stock aumenta: 10 → 15 pallets
- Se crea lote nuevo: 5 pallets × 950 uds
- Sistema envía notificación: "⚠️ Discrepancia en entrada: Tornillos M8 (-250 unidades)"
- Unidades totales: 10,000 + 4,750 = 14,750 uds

---

### Ver Stock con Unidades

1. Ir a **Stock (Inventario)**
2. Verás en el resumen:
   - Total Pallets: 15
   - Total Unidades: 14,750
3. En la tabla verás:
   ```
   Material        | SKU          | Pallets | Uds/Pallet | Total Unidades
   ----------------------------------------------------------------
   Tornillos M8    | TORN-M8-001  | 15      | 1000 ⚠️    | 14,750
   ```
4. El ⚠️ indica que hay pallets con diferentes unidades

**Tooltip al pasar sobre ⚠️:**
"Hay pallets con diferentes unidades"

---

### Crear Pedido de Salida

1. Ir a **New Order**
2. Seleccionar "Tornillos M8"
3. Cantidad: 3 pallets
4. El sistema mostrará (en futuras actualizaciones):
   - "Aproximadamente 3,000 unidades"

**Resultado:**
- Stock disminuye: 15 → 12 pallets
- Consumo por FIFO:
  - Primero consume del lote más antiguo (10 pallets × 1000 uds)
  - Quedan: 7 pallets × 1000 uds + 5 pallets × 950 uds
- Unidades totales: 7,000 + 4,750 = 11,750 uds

---

## ⚙️ Configuración Técnica

### Variables de Entorno

No se requieren nuevas variables de entorno.

### Permisos de Base de Datos

Si usas Row Level Security (RLS) en Supabase, asegúrate de que los usuarios autenticados tengan permisos para:

```sql
-- Lectura de vista
GRANT SELECT ON stock_con_unidades TO authenticated;

-- Operaciones en stock_lotes
GRANT SELECT, INSERT, UPDATE ON stock_lotes TO authenticated;
GRANT USAGE ON SEQUENCE stock_lotes_id_seq TO authenticated;
```

---

## 📊 Ejemplos de Datos

### Tabla `productos` (después de migración)

| sku | descripcion | url_imagen | unidades_por_pallet |
|-----|-------------|------------|---------------------|
| ABC123 | CAJA PLASTICO | /caja.jpg | 500 |
| DEF456 | PALLET MADERA | /pallet.jpg | 1 |
| GHI789 | TORNILLOS M8 | /tornillo.jpg | 1000 |

### Tabla `stock_lotes`

| id | producto_sku | pallets | unidades_por_pallet | unidades_totales | fecha_entrada |
|----|--------------|---------|---------------------|------------------|---------------|
| 1 | ABC123 | 10 | 500 | 5000 | 2025-01-15 |
| 2 | ABC123 | 5 | 480 | 2400 | 2025-01-20 |
| 3 | GHI789 | 10 | 1000 | 10000 | 2025-01-10 |
| 4 | GHI789 | 5 | 950 | 4750 | 2025-01-22 |

### Vista `stock_con_unidades`

| producto_sku | descripcion | pallets_totales | unidades_estandar | unidades_totales | tiene_discrepancias |
|--------------|-------------|-----------------|-------------------|------------------|---------------------|
| ABC123 | CAJA PLASTICO | 15 | 500 | 7400 | true |
| GHI789 | TORNILLOS M8 | 15 | 1000 | 14750 | true |
| DEF456 | PALLET MADERA | 20 | 1 | 20 | false |

**Explicación:**
- **ABC123**: Tiene discrepancias porque hay lotes con 500 y 480 uds/pallet
- **GHI789**: Tiene discrepancias porque hay lotes con 1000 y 950 uds/pallet
- **DEF456**: No tiene discrepancias, todos los lotes tienen 1 ud/pallet

---

## 🐛 Solución de Problemas

### Error: "relation stock_con_unidades does not exist"

**Causa:** No se ejecutó la migración correctamente

**Solución:**
1. Verificar en Supabase SQL Editor si existe la vista:
   ```sql
   SELECT * FROM stock_con_unidades LIMIT 1;
   ```
2. Si no existe, ejecutar de nuevo `migracion_unidades_pallet.sql`

---

### Error: "column unidades_por_pallet does not exist"

**Causa:** La columna no se añadió a la tabla `productos`

**Solución:**
```sql
ALTER TABLE productos ADD COLUMN unidades_por_pallet INTEGER DEFAULT 1;
UPDATE productos SET unidades_por_pallet = 1 WHERE unidades_por_pallet IS NULL;
```

---

### Las unidades totales no coinciden

**Causa:** Los lotes no se crearon correctamente

**Diagnóstico:**
```sql
-- Ver lotes de un producto
SELECT * FROM stock_lotes WHERE producto_sku = 'ABC123';

-- Verificar suma de lotes vs stock
SELECT
  s.producto_sku,
  s.cantidad AS pallets_stock,
  SUM(sl.pallets) AS pallets_lotes,
  SUM(sl.unidades_totales) AS unidades_lotes
FROM stock s
LEFT JOIN stock_lotes sl ON s.producto_sku = sl.producto_sku
WHERE s.producto_sku = 'ABC123'
GROUP BY s.producto_sku, s.cantidad;
```

**Solución:**
- Si los pallets no coinciden, puede que haya movimientos antiguos sin lotes
- Ejecutar script de recálculo de lotes (contactar soporte)

---

### El indicador ⚠️ no aparece cuando debería

**Causa:** La vista no está detectando discrepancias

**Verificación:**
```sql
SELECT
  producto_sku,
  COUNT(DISTINCT unidades_por_pallet) as diferentes_unidades,
  tiene_discrepancias
FROM stock_lotes
GROUP BY producto_sku;
```

**Solución:**
- Refrescar la vista en Supabase
- Verificar que `tiene_discrepancias` está correctamente calculado en la vista

---

## 📈 Mejoras Futuras (Opcionales)

### 1. Mostrar detalles de lotes en StockView

Añadir un modal expandible que muestre:
```
Tornillos M8 - Detalles de Lotes:
├─ Lote 1: 7 pallets × 1000 uds = 7,000 uds (entrada: 2025-01-10)
└─ Lote 2: 5 pallets × 950 uds = 4,750 uds (entrada: 2025-01-22) ⚠️
```

### 2. Exportar PDF con unidades

Actualizar `generatePDF()` en StockView para incluir columnas de unidades.

### 3. Gráfico de discrepancias

Dashboard con:
- Materiales con más discrepancias
- Tendencia de unidades por pallet en el tiempo
- Proveedores con más variaciones

### 4. NewOrderView con unidades

Mostrar información de unidades al crear pedidos:
```
Material: Tornillos M8
Cantidad: 3 pallets
Unidades aproximadas: ~3,000 uds
(Basado en lotes disponibles: 2 pallets de 1000 uds + 1 pallet de 1000 uds)
```

### 5. HistoryView con unidades

Añadir columnas en el historial:
- Total de unidades por movimiento
- Detalle de unidades por item

---

## ✅ Checklist de Implementación

- [x] Crear archivo de migración SQL
- [x] Actualizar `useInventory.js` con lógica de unidades
- [x] Modificar `SettingsView.vue` para configurar unidades por pallet
- [x] Actualizar `StockView.vue` para mostrar unidades totales
- [x] Modificar `IncomingsView.vue` para registrar unidades reales
- [ ] **Ejecutar migración en base de datos de producción** ← PENDIENTE
- [ ] Probar creación de producto con unidades por pallet
- [ ] Probar entrada con unidades diferentes al estándar
- [ ] Verificar que aparecen alertas de discrepancias
- [ ] Verificar que el stock se calcula correctamente
- [ ] Verificar que las salidas consumen lotes por FIFO
- [ ] Actualizar NewOrderView (opcional)
- [ ] Actualizar HistoryView (opcional)

---

## 📞 Soporte

Para dudas sobre la implementación:
1. Revisar logs en consola del navegador (F12)
2. Verificar errores en Supabase Dashboard → Logs
3. Consultar esta documentación

**Próximos pasos recomendados:**
1. ✅ Ejecutar migración en Supabase
2. ✅ Probar crear un material nuevo con unidades por pallet
3. ✅ Registrar una entrada con unidades diferentes
4. ✅ Verificar en StockView que se muestran las unidades correctamente
