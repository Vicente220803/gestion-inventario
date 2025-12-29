-- =====================================================
-- SCRIPT: Crear lotes para stock existente
-- Descripción: Crea lotes en stock_lotes para todos
--              los productos que ya tienen stock
-- =====================================================

-- IMPORTANTE: Este script debe ejecutarse DESPUÉS de migracion_unidades_pallet.sql

-- Para cada producto con stock, crear un lote inicial
-- Asume que todos los pallets actuales tienen las unidades estándar
INSERT INTO stock_lotes (producto_sku, pallets, unidades_por_pallet, unidades_totales, movimiento_id)
SELECT
    s.producto_sku,
    s.cantidad AS pallets,
    COALESCE(p.unidades_por_pallet, 1) AS unidades_por_pallet,
    s.cantidad * COALESCE(p.unidades_por_pallet, 1) AS unidades_totales,
    NULL as movimiento_id
FROM stock s
JOIN productos p ON s.producto_sku = p.sku
WHERE s.cantidad > 0
  -- Solo insertar si no existen lotes para este producto
  AND NOT EXISTS (
    SELECT 1 FROM stock_lotes sl
    WHERE sl.producto_sku = s.producto_sku
  );

-- Verificar resultados
SELECT
    sl.producto_sku,
    p.descripcion,
    sl.pallets,
    sl.unidades_por_pallet,
    sl.unidades_totales,
    sl.fecha_entrada
FROM stock_lotes sl
JOIN productos p ON sl.producto_sku = p.sku
ORDER BY sl.fecha_entrada DESC;
