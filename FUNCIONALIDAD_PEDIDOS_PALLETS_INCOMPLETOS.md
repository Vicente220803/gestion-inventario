# 📦 Nueva Funcionalidad: Alertas de Pallets Incompletos en Pedidos

## 🎯 ¿Qué hace esta funcionalidad?

Cuando creas un **pedido de salida** (New Order) de un material que tiene **pallets incompletos** en stock, el sistema te pregunta automáticamente si quieres despachar primero el pallet incompleto.

---

## ✨ Comportamiento

### Escenario

Tienes en stock:
- **Material**: CAJA PLASTICO
- **Total stock**: 10 pallets
- **Composición**:
  - 8 pallets completos (100 uds/pallet)
  - 2 pallets incompletos (75 uds/pallet)
- **Indicador**: ⚠️ en la vista de Stock

### Al Crear un Pedido

1. Vas a **New Order (Nuevo Pedido)**
2. Añades **CAJA PLASTICO** - Cantidad: **3 pallets**
3. Haces click en **"Enviar Pedido"**

### ⚠️ Se Abre un Modal

El sistema detecta que hay pallets incompletos y te muestra:

```
⚠️ Pallet Incompleto Disponible

Material: CAJA PLASTICO

Hay un pallet incompleto con 75 unidades
(en lugar de 100 unidades estándar).

¿Quieres despachar este pallet incompleto primero?

✅ Si eliges "Sí": Se despachará el pallet incompleto
   y desaparecerá el símbolo ⚠️ del inventario.

ℹ️ Si eliges "No": Se despachará un pallet completo normal
   y el incompleto quedará en stock.

[No, usar pallet completo]  [Sí, despachar incompleto]
```

---

## 🔄 Flujos de Usuario

### Opción 1: SÍ, Despachar Pallet Incompleto

**Acción:** Click en "Sí, despachar incompleto"

**Resultado:**
1. Se despacha 1 pallet incompleto (75 unidades)
2. Se descuenta 1 pallet del stock total
3. El lote incompleto se consume
4. Se muestra notificación: "Pallet incompleto de CAJA PLASTICO será despachado (75 unidades)"
5. El pedido continúa con los 2 pallets restantes (pallets completos)
6. ⚠️ **Desaparece** si ya no quedan más pallets incompletos

**Stock después:**
- 9 pallets totales
  - 8 pallets completos (100 uds) - 1 = 7 completos
  - 1 pallet incompleto (75 uds) ← Queda 1 incompleto

### Opción 2: NO, Usar Pallet Completo

**Acción:** Click en "No, usar pallet completo"

**Resultado:**
1. El pallet incompleto **NO se despacha**
2. Se despachan 3 pallets completos normales (FIFO)
3. El lote incompleto permanece en stock
4. El pedido se procesa normalmente
5. ⚠️ **Permanece** en la vista de Stock

**Stock después:**
- 7 pallets totales
  - 5 pallets completos (100 uds)
  - 2 pallets incompletos (75 uds) ← Se mantienen

---

## 💡 Casos de Uso

### Caso 1: Múltiples Pallets Incompletos

Si pides **5 pallets** y hay **2 pallets incompletos** en stock:

1. Se pregunta por el **primer** pallet incompleto
2. Si dices "Sí", se despacha
3. Se pregunta por el **segundo** pallet incompleto
4. Si dices "Sí", se despacha
5. Los 3 restantes se despachan como pallets completos normales

### Caso 2: Varios Materiales con Pallets Incompletos

Si tu pedido incluye:
- **CAJA PLASTICO**: 2 pallets (tiene incompletos ⚠️)
- **TORNILLOS M8**: 5 pallets (tiene incompletos ⚠️)

El sistema preguntará:
1. Primero por CAJA PLASTICO
2. Luego por TORNILLOS M8
3. Material por material

### Caso 3: Solo 1 Pallet Pedido

Si pides **1 pallet** y hay un incompleto:
- Se pregunta si quieres el incompleto
- Si dices "Sí": Se despacha solo el incompleto
- Si dices "No": Se despacha 1 pallet completo

---

## 🔍 Ventajas

✅ **Control total**: Decides qué despachar en cada pedido
✅ **Limpieza de stock**: Puedes deshacerte de pallets incompletos fácilmente
✅ **Transparencia**: Siempre sabes cuándo hay pallets incompletos
✅ **Flexibilidad**: Si necesitas unidades exactas, puedes elegir el incompleto
✅ **Actualización automática**: El símbolo ⚠️ desaparece cuando ya no hay incompletos

---

## 🎨 Interfaz

### Modal de Confirmación

El modal muestra:
- **Icono**: ⚠️ (alerta)
- **Título**: "Pallet Incompleto Disponible"
- **Información del material**: Nombre del producto
- **Unidades del incompleto**: Ej. "75 unidades"
- **Unidades estándar**: Ej. "100 unidades estándar"
- **Explicación clara** de cada opción
- **2 botones**:
  - Gris: "No, usar pallet completo"
  - Verde: "Sí, despachar incompleto"

---

## 🔧 Detalles Técnicos

### Detección Automática

El sistema verifica automáticamente:
1. Si el material tiene lotes en `stock_lotes`
2. Si algún lote tiene `unidades_por_pallet < unidades_estandar`
3. Si ese lote tiene `pallets > 0`

### Consumo por FIFO

- Los lotes se ordenan por `fecha_entrada` (más antiguo primero)
- Si eliges despachar el incompleto, se consume de ese lote específico
- Si dices "No", el sistema sigue FIFO normal

### Actualización de Stock

Cuando eliges "Sí":
1. Se resta 1 pallet del lote incompleto
2. Se actualiza `stock_lotes`: `pallets - 1`
3. Se recalcula `unidades_totales`
4. Se actualiza tabla `stock`: `cantidad - 1`
5. Si `pallets = 0`, el lote se queda en 0 (no se elimina)

---

## 📋 Ejemplo Completo Paso a Paso

### Estado Inicial

**Stock de CAJA PLASTICO:**
- Total: 10 pallets
- Lote 1: 8 pallets × 100 uds = 800 uds
- Lote 2: 2 pallets × 75 uds = 150 uds ⚠️
- **Total unidades**: 950 uds

### Crear Pedido

1. Ir a **New Order**
2. Añadir material: **CAJA PLASTICO**
3. Cantidad: **3 pallets**
4. Click en **"Enviar Pedido"**

### Modal Aparece

```
⚠️ Pallet Incompleto Disponible
Material: CAJA PLASTICO
Hay un pallet incompleto con 75 unidades
(en lugar de 100 unidades estándar).
```

### Usuario Elige "Sí"

Notificación:
```
✅ Pallet incompleto de CAJA PLASTICO será despachado (75 unidades)
```

### Procesamiento

El sistema verifica si hay más incompletos:
- Quedan 2 pallets incompletos - 1 = 1 pallet incompleto
- Se pregunta de nuevo

### Usuario Elige "Sí" otra vez

```
✅ Pallet incompleto de CAJA PLASTICO será despachado (75 unidades)
```

### Pedido Final

Se despachan:
- 2 pallets incompletos (75 uds cada uno) = 150 uds
- 1 pallet completo (100 uds) = 100 uds
- **Total**: 3 pallets = 250 unidades

### Estado Final

**Stock de CAJA PLASTICO:**
- Total: 7 pallets
- Lote 1: 7 pallets × 100 uds = 700 uds
- ⚠️ **Ha desaparecido** porque ya no hay incompletos

---

## ⚙️ Integración con Otras Funcionalidades

### Con Historial
- Los pallets incompletos despachados se registran normalmente
- El movimiento muestra el SKU y cantidad
- No se distingue en el historial si fue incompleto o completo

### Con Email
- El email del pedido se envía normalmente
- Muestra la cantidad de pallets despachados
- No menciona si fueron incompletos

### Con Stock View
- El símbolo ⚠️ se actualiza automáticamente
- Si ya no quedan incompletos, desaparece
- Los totales de unidades se recalculan correctamente

---

## 🚫 Validaciones

El sistema NO mostrará el modal si:
- No hay pallets incompletos en stock
- El lote incompleto tiene 0 pallets
- El material solo tiene pallets completos
- La cantidad pedida es 0

---

## 🎉 Resumen

Esta funcionalidad te permite **gestionar inteligentemente los pallets incompletos** en cada pedido, dándote control total sobre qué despachar y manteniendo tu inventario limpio y preciso.

**Flujo simplificado:**
```
Crear Pedido → Detectar Incompleto → Preguntar → Elegir → Despachar → Actualizar
```

¡Ahora tienes control total sobre tus pallets incompletos! 🚀
