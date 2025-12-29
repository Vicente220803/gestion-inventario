-- =====================================================
-- MIGRACIÓN: Sistema de Unidades por Pallet
-- Fecha: 2025-12-26
-- Descripción: Añade trazabilidad de unidades por pallet
--              con seguimiento por lotes/entradas
-- =====================================================

-- 1. Añadir columna unidades_por_pallet a productos
ALTER TABLE productos
ADD COLUMN IF NOT EXISTS unidades_por_pallet INTEGER DEFAULT 1;

COMMENT ON COLUMN productos.unidades_por_pallet IS 'Cantidad estándar de unidades que contiene un pallet de este producto';

-- 2. Crear tabla para tracking de lotes de stock
-- Permite saber exactamente qué pallets tienen cuántas unidades
CREATE TABLE IF NOT EXISTS stock_lotes (
  id BIGSERIAL PRIMARY KEY,
  producto_sku TEXT NOT NULL REFERENCES productos(sku) ON DELETE CASCADE,
  movimiento_id BIGINT REFERENCES MOVIMIENTOS(id) ON DELETE SET NULL,
  pallets INTEGER NOT NULL DEFAULT 0,
  unidades_por_pallet INTEGER NOT NULL,
  unidades_totales INTEGER NOT NULL,
  fecha_entrada TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT stock_lotes_pallets_positivo CHECK (pallets >= 0),
  CONSTRAINT stock_lotes_unidades_positivas CHECK (unidades_por_pallet > 0 AND unidades_totales > 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_lotes_producto ON stock_lotes(producto_sku);
CREATE INDEX IF NOT EXISTS idx_stock_lotes_movimiento ON stock_lotes(movimiento_id);

COMMENT ON TABLE stock_lotes IS 'Registro de lotes de stock para tracking de unidades reales por entrada';
COMMENT ON COLUMN stock_lotes.pallets IS 'Cantidad de pallets en este lote';
COMMENT ON COLUMN stock_lotes.unidades_por_pallet IS 'Unidades reales por pallet en este lote';
COMMENT ON COLUMN stock_lotes.unidades_totales IS 'Total de unidades en este lote (pallets × unidades_por_pallet)';

-- 3. Crear vista para consultar stock con unidades
CREATE OR REPLACE VIEW stock_con_unidades AS
SELECT
  s.producto_sku,
  p.descripcion,
  p.unidades_por_pallet AS unidades_estandar,
  s.cantidad AS pallets_totales,
  -- Calcular unidades totales desde los lotes
  COALESCE(SUM(sl.unidades_totales), s.cantidad * p.unidades_por_pallet) AS unidades_totales,
  -- Detectar si hay discrepancias
  CASE
    WHEN COUNT(DISTINCT sl.unidades_por_pallet) > 1 THEN true
    WHEN EXISTS (
      SELECT 1 FROM stock_lotes sl2
      WHERE sl2.producto_sku = s.producto_sku
      AND sl2.unidades_por_pallet != p.unidades_por_pallet
    ) THEN true
    ELSE false
  END AS tiene_discrepancias
FROM stock s
JOIN productos p ON s.producto_sku = p.sku
LEFT JOIN stock_lotes sl ON sl.producto_sku = s.producto_sku
GROUP BY s.producto_sku, p.descripcion, p.unidades_por_pallet, s.cantidad;

COMMENT ON VIEW stock_con_unidades IS 'Vista que combina stock en pallets con unidades reales por lote';

-- 4. Función para actualizar stock con unidades (reemplaza actualizar_stock en casos con unidades)
CREATE OR REPLACE FUNCTION actualizar_stock_con_unidades(
  sku_producto TEXT,
  cantidad_pallets INTEGER,
  unidades_pallet INTEGER,
  movimiento_ref BIGINT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  unidades_calculadas INTEGER;
BEGIN
  SET search_path = public;

  -- Calcular unidades totales
  unidades_calculadas := cantidad_pallets * unidades_pallet;

  -- Actualizar stock de pallets (tabla stock)
  UPDATE stock
  SET cantidad = cantidad + cantidad_pallets
  WHERE producto_sku = sku_producto;

  -- Si no existe el producto en stock, insertarlo
  IF NOT FOUND THEN
    INSERT INTO stock (producto_sku, cantidad)
    VALUES (sku_producto, cantidad_pallets);
  END IF;

  -- Si es una entrada (cantidad positiva), crear lote
  IF cantidad_pallets > 0 THEN
    INSERT INTO stock_lotes (
      producto_sku,
      movimiento_id,
      pallets,
      unidades_por_pallet,
      unidades_totales
    )
    VALUES (
      sku_producto,
      movimiento_ref,
      cantidad_pallets,
      unidades_pallet,
      unidades_calculadas
    );
  END IF;

  -- Si es una salida (cantidad negativa), consumir de los lotes más antiguos (FIFO)
  IF cantidad_pallets < 0 THEN
    DECLARE
      pallets_a_consumir INTEGER := ABS(cantidad_pallets);
      lote RECORD;
    BEGIN
      FOR lote IN
        SELECT id, pallets
        FROM stock_lotes
        WHERE producto_sku = sku_producto
        AND pallets > 0
        ORDER BY fecha_entrada ASC
      LOOP
        IF pallets_a_consumir <= 0 THEN
          EXIT;
        END IF;

        IF lote.pallets <= pallets_a_consumir THEN
          -- Consumir el lote completo
          UPDATE stock_lotes
          SET pallets = 0, unidades_totales = 0
          WHERE id = lote.id;

          pallets_a_consumir := pallets_a_consumir - lote.pallets;
        ELSE
          -- Consumir parcialmente el lote
          UPDATE stock_lotes
          SET
            pallets = pallets - pallets_a_consumir,
            unidades_totales = (pallets - pallets_a_consumir) * unidades_por_pallet
          WHERE id = lote.id;

          pallets_a_consumir := 0;
        END IF;
      END LOOP;
    END;
  END IF;
END;
$function$;

COMMENT ON FUNCTION actualizar_stock_con_unidades IS 'Actualiza stock considerando unidades por pallet y gestiona lotes FIFO';

-- 5. Trigger para validar que las unidades totales en lotes coincidan con el cálculo
CREATE OR REPLACE FUNCTION validar_unidades_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Validar que unidades_totales = pallets × unidades_por_pallet
  IF NEW.unidades_totales != (NEW.pallets * NEW.unidades_por_pallet) THEN
    RAISE EXCEPTION 'Las unidades totales (%) no coinciden con pallets × unidades_por_pallet (% × % = %)',
      NEW.unidades_totales, NEW.pallets, NEW.unidades_por_pallet, NEW.pallets * NEW.unidades_por_pallet;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_validar_unidades_lote ON stock_lotes;
CREATE TRIGGER trigger_validar_unidades_lote
  BEFORE INSERT OR UPDATE ON stock_lotes
  FOR EACH ROW
  EXECUTE FUNCTION validar_unidades_lote();

-- 6. Actualizar datos existentes (asignar unidades_por_pallet = 1 por defecto)
UPDATE productos
SET unidades_por_pallet = 1
WHERE unidades_por_pallet IS NULL;

-- 7. Migrar stock actual a lotes (crear un lote inicial por cada producto)
INSERT INTO stock_lotes (producto_sku, pallets, unidades_por_pallet, unidades_totales, movimiento_id)
SELECT
  s.producto_sku,
  s.cantidad AS pallets,
  p.unidades_por_pallet,
  s.cantidad * p.unidades_por_pallet AS unidades_totales,
  NULL AS movimiento_id
FROM stock s
JOIN productos p ON s.producto_sku = p.sku
WHERE s.cantidad > 0
ON CONFLICT DO NOTHING;

-- 8. Crear función para obtener resumen de lotes por producto
CREATE OR REPLACE FUNCTION obtener_lotes_producto(sku_producto TEXT)
RETURNS TABLE (
  lote_id BIGINT,
  pallets INTEGER,
  unidades_por_pallet INTEGER,
  unidades_totales INTEGER,
  fecha_entrada TIMESTAMP WITH TIME ZONE,
  es_estandar BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  SET search_path = public;

  RETURN QUERY
  SELECT
    sl.id,
    sl.pallets,
    sl.unidades_por_pallet,
    sl.unidades_totales,
    sl.fecha_entrada,
    (sl.unidades_por_pallet = p.unidades_por_pallet) AS es_estandar
  FROM stock_lotes sl
  JOIN productos p ON sl.producto_sku = p.sku
  WHERE sl.producto_sku = sku_producto
  AND sl.pallets > 0
  ORDER BY sl.fecha_entrada ASC;
END;
$function$;

COMMENT ON FUNCTION obtener_lotes_producto IS 'Obtiene todos los lotes activos de un producto con indicador de conformidad';

-- =====================================================
-- ÍNDICES ADICIONALES PARA OPTIMIZACIÓN
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_stock_lotes_activos
  ON stock_lotes(producto_sku, fecha_entrada)
  WHERE pallets > 0;

-- =====================================================
-- PERMISOS (ajustar según tus políticas RLS)
-- =====================================================

-- Permitir lectura de la vista a usuarios autenticados
-- GRANT SELECT ON stock_con_unidades TO authenticated;

-- Permitir operaciones en stock_lotes a usuarios autenticados
-- GRANT SELECT, INSERT, UPDATE ON stock_lotes TO authenticated;
-- GRANT USAGE ON SEQUENCE stock_lotes_id_seq TO authenticated;

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar que la migración fue exitosa
DO $$
DECLARE
  productos_count INTEGER;
  lotes_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO productos_count FROM productos WHERE unidades_por_pallet IS NOT NULL;
  SELECT COUNT(*) INTO lotes_count FROM stock_lotes;

  RAISE NOTICE '✅ Migración completada:';
  RAISE NOTICE '   - Productos con unidades_por_pallet: %', productos_count;
  RAISE NOTICE '   - Lotes de stock creados: %', lotes_count;
END $$;
