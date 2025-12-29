# 📦 Cómo Registrar Pallets Incompletos en el Inventario

## 🎯 Objetivo

Este documento explica cómo registrar en la aplicación los **pallets incompletos** que tienes físicamente en tu almacén.

---

## 📝 ¿Cuándo usar esta funcionalidad?

Usa esta funcionalidad cuando:
- **Tienes pallets con menos unidades de lo normal** en tu inventario actual
- Quieres que el sistema refleje **exactamente** cuántas unidades tienes en realidad
- Ya registraste tu stock inicial pero algunos pallets están incompletos

**Ejemplo:**
```
Material: CAJA PLASTICO
Stock registrado: 10 pallets
Unidades estándar: 100 uds/pallet

Situación real:
- 8 pallets tienen 100 unidades (completos)
- 2 pallets tienen solo 75 unidades (incompletos)

Total real: (8 × 100) + (2 × 75) = 950 unidades
Sin ajuste el sistema calcularía: 10 × 100 = 1000 unidades ❌
```

---

## 🚀 Pasos para Registrar Pallets Incompletos

### Paso 1: Ir a la Vista de Stock (Inventario)

1. Inicia sesión como **administrador**
2. Ve a la sección **"Inventario"** o **"Stock"**

### Paso 2: Localizar el Material

1. Usa el buscador si tienes muchos materiales
2. Busca el material que tiene pallets incompletos

### Paso 3: Hacer Click en "Ajustar Unidades"

En la columna **"Acciones"** (última columna), haz click en el botón:

```
📦 Ajustar Unidades
```

### Paso 4: Completar el Formulario

Se abrirá un modal con la siguiente información:

#### Información del Material
- Material: Nombre del producto
- SKU: Código del material
- Stock actual: Total de pallets registrados
- Unidades estándar: Unidades que normalmente tiene un pallet completo

#### Campos a Rellenar

**1. Pallets Completos**
- ¿Cuántos pallets tienen la cantidad estándar de unidades?
- Ejemplo: Si tienes 8 pallets completos, escribe `8`

**2. Pallets Incompletos**
- ¿Cuántos pallets tienen menos unidades?
- Ejemplo: Si tienes 2 pallets incompletos, escribe `2`
- Se auto-calcula al cambiar "Pallets Completos"

**3. Unidades en Pallets Incompletos**
- ¿Cuántas unidades REALES tiene cada pallet incompleto?
- Ejemplo: Si cada pallet incompleto tiene 75 unidades, escribe `75`
- **Debe ser menor que las unidades estándar**

**4. Motivo del Ajuste**
- Explica por qué haces el ajuste
- Ejemplo: "Ajuste de inventario inicial: 2 pallets llegaron incompletos del proveedor"

#### Resumen (Se calcula automáticamente)

El modal te mostrará:
```
📊 Resumen:
Total pallets: 10 / 10 ✓
Pallets completos: 8 × 100 = 800 uds
Pallets incompletos: 2 × 75 = 150 uds
─────────────────────────────────
Total unidades: 950
```

### Paso 5: Validar y Guardar

1. Asegúrate que **Total pallets** coincide con tu stock (aparece en verde)
2. Revisa que el **Total unidades** es correcto
3. Haz click en **"Guardar Ajuste"**

---

## ✅ Resultado

Después de guardar:

1. **Se crea un movimiento de tipo "Ajuste"** en el historial
2. **Se actualizan los lotes** en la base de datos:
   - Lote 1: X pallets completos con Y unidades cada uno
   - Lote 2: Z pallets incompletos con W unidades cada uno
3. **La vista de Stock muestra**:
   - Símbolo de advertencia ⚠️ en la columna "Uds/Pallet"
   - Total de unidades real
4. **Se genera una notificación** con el resumen del ajuste

---

## 📊 Ejemplo Completo

### Situación Inicial

```
Material: TORNILLOS M8
SKU: TORN-M8-001
Stock: 15 pallets
Unidades estándar: 1000 uds/pallet
```

Sistema asume: **15 × 1000 = 15,000 unidades**

### Realidad Física

Al contar físicamente encuentras:
- 12 pallets con 1000 unidades (completos)
- 3 pallets con solo 850 unidades (incompletos)

Total real: **(12 × 1000) + (3 × 850) = 14,550 unidades**

### Pasos en la App

1. Click en "📦 Ajustar Unidades" en la fila de TORNILLOS M8
2. Rellenar:
   - Pallets Completos: `12`
   - Pallets Incompletos: `3`
   - Unidades en Pallets Incompletos: `850`
   - Motivo: `Inventario inicial: 3 pallets llegaron incompletos`
3. Verificar resumen:
   ```
   Total pallets: 15 / 15 ✓
   Pallets completos: 12 × 1000 = 12,000 uds
   Pallets incompletos: 3 × 850 = 2,550 uds
   Total unidades: 14,550
   ```
4. Click en "Guardar Ajuste"

### Resultado

- Stock en pallets sigue siendo: **15 pallets** ✓
- Total de unidades ahora es: **14,550 unidades** ✓
- Aparece ⚠️ en la columna "Uds/Pallet" indicando discrepancia
- Se registra movimiento de ajuste con diferencia: **-450 unidades**

---

## ⚠️ Validaciones del Sistema

El sistema **NO permitirá** guardar el ajuste si:

1. **Total de pallets no coincide:**
   ```
   Error: El total de pallets (14) no coincide con el stock actual (15)
   ```

2. **No especificas unidades en pallets incompletos:**
   ```
   Error: Debes especificar las unidades reales de los pallets incompletos
   ```

3. **Unidades incompletas >= unidades estándar:**
   ```
   Error: Los pallets incompletos deben tener menos unidades que el estándar
   ```

---

## 🔍 ¿Cómo Verificar que Funcionó?

1. **En la Vista de Stock:**
   - Verás ⚠️ junto a "Uds/Pallet"
   - El "Total Unidades" mostrará el valor real

2. **En el Historial:**
   - Aparecerá un movimiento de tipo "Ajuste"
   - Con el comentario que escribiste
   - Mostrando la diferencia de unidades

3. **En la Base de Datos:**
   - Tabla `stock_lotes` tendrá 2 lotes para ese material:
     - Lote 1: pallets completos
     - Lote 2: pallets incompletos

---

## 💡 Consejos

1. **Haz el ajuste lo antes posible** después de registrar el stock inicial
2. **Cuenta físicamente** antes de hacer el ajuste
3. **Escribe un motivo claro** para referencia futura
4. **Verifica el resumen** antes de guardar
5. **Este ajuste NO cambia el número de pallets**, solo registra las unidades reales

---

## 🔄 ¿Qué Pasa con las Futuras Entradas y Salidas?

### Entradas Nuevas
- Puedes registrar las unidades reales por pallet
- El sistema creará un nuevo lote con esas unidades
- Si difieren del estándar, recibirás una alerta

### Salidas (Pedidos)
- El sistema consume lotes por **FIFO** (primero en entrar, primero en salir)
- Los pallets incompletos se consumen después de los completos (si entraron después)
- No necesitas hacer nada especial

---

## 📞 Preguntas Frecuentes

**P: ¿Puedo ajustar el mismo material varias veces?**
R: Sí, pero cada ajuste reemplaza los lotes anteriores. Es mejor hacerlo una vez con los datos correctos.

**P: ¿Se puede deshacer un ajuste?**
R: No directamente. Tendrías que hacer un nuevo ajuste con los valores correctos.

**P: ¿Afecta esto al número de pallets en stock?**
R: No, el número de pallets permanece igual. Solo se ajustan las unidades reales.

**P: ¿Qué pasa si todos mis pallets están completos?**
R: No necesitas usar esta funcionalidad. El sistema ya calcula correctamente las unidades.

**P: ¿Puedo ver el detalle de los lotes?**
R: Actualmente no hay vista de lotes en la interfaz, pero se registran en la base de datos y afectan correctamente los cálculos.

---

## ✨ Funcionalidades Relacionadas

- **Editar Unidades Estándar**: Click en ✏️ en la columna "Uds/Pallet" (cambia el estándar del producto)
- **Registrar Entrada**: En "Entradas" puedes especificar unidades reales al recibir mercancía
- **Historial**: Todos los ajustes quedan registrados con timestamp y motivo

---

**¡Listo! Ahora puedes registrar correctamente tus pallets incompletos y tener un inventario preciso en unidades reales.** 🎉
