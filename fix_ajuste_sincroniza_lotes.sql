-- ============================================================
-- FIX: el Ajuste de inventario (recuento manual) cambiaba stock
-- pero NO stock_lotes -> se desincronizaban y el desfase se
-- arrastraba para siempre (caso PURA PIÑA: stock 16 / lotes 24).
--
-- Ahora, tras fijar el stock, se sincronizan los lotes para que
-- sumen exactamente la cantidad nueva:
--   - Si sobran pallets  -> se consumen (incompletos primero, luego FIFO)
--   - Si faltan pallets  -> se añade un lote estándar con la diferencia
--
-- OJO: la variable local ya NO se llama 'movimiento_id' porque
-- chocaba con stock_lotes.movimiento_id (error "ambiguous column").
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_ajuste_inventario(
  ajustes jsonb,    -- [{sku, desc, oldQuantity, newQuantity}, ...]
  motivo text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  mov_id bigint;
  ajuste jsonb;
  elementos_movimiento jsonb := '[]'::jsonb;
  v_sku text;
  v_nueva bigint;
  v_total_lotes bigint;
  v_diferencia bigint;
  v_upp integer;
  v_por_consumir bigint;
  lote RECORD;
BEGIN
  IF jsonb_array_length(ajustes) = 0 THEN
    RAISE EXCEPTION 'No hay ajustes que registrar';
  END IF;

  FOR ajuste IN SELECT * FROM jsonb_array_elements(ajustes)
  LOOP
    v_sku := ajuste->>'sku';
    v_nueva := (ajuste->>'newQuantity')::bigint;

    -- 1) Fijar el stock a la cantidad contada
    INSERT INTO stock (producto_sku, cantidad)
    VALUES (v_sku, v_nueva)
    ON CONFLICT (producto_sku) DO UPDATE
      SET cantidad = EXCLUDED.cantidad;

    -- 2) Sincronizar los lotes para que sumen exactamente v_nueva
    SELECT COALESCE(SUM(sl.pallets), 0) INTO v_total_lotes
    FROM stock_lotes sl WHERE sl.producto_sku = v_sku;

    v_diferencia := v_nueva - v_total_lotes;

    IF v_diferencia < 0 THEN
      -- Sobran pallets en lotes: consumir incompletos primero, luego el más antiguo
      v_por_consumir := -v_diferencia;
      FOR lote IN
        SELECT sl.id, sl.pallets, sl.unidades_por_pallet
        FROM stock_lotes sl
        WHERE sl.producto_sku = v_sku AND sl.pallets > 0
        ORDER BY sl.unidades_por_pallet ASC, sl.fecha_entrada ASC
      LOOP
        EXIT WHEN v_por_consumir <= 0;
        IF lote.pallets <= v_por_consumir THEN
          DELETE FROM stock_lotes WHERE id = lote.id;
          v_por_consumir := v_por_consumir - lote.pallets;
        ELSE
          UPDATE stock_lotes
          SET pallets = pallets - v_por_consumir,
              unidades_totales = (pallets - v_por_consumir) * lote.unidades_por_pallet
          WHERE id = lote.id;
          v_por_consumir := 0;
        END IF;
      END LOOP;

    ELSIF v_diferencia > 0 THEN
      -- Faltan pallets en lotes: añadir la diferencia como lote estándar
      SELECT p.unidades_por_pallet INTO v_upp FROM productos p WHERE p.sku = v_sku;
      IF v_upp IS NULL OR v_upp < 1 THEN v_upp := 1; END IF;
      INSERT INTO stock_lotes (producto_sku, pallets, unidades_por_pallet, unidades_totales)
      VALUES (v_sku, v_diferencia, v_upp, v_diferencia * v_upp);
    END IF;

    elementos_movimiento := elementos_movimiento || jsonb_build_object(
      'sku', v_sku,
      'desc', ajuste->>'desc',
      'cantidad_anterior', (ajuste->>'oldQuantity')::bigint,
      'cantidad_nueva', v_nueva,
      'diferencia', v_nueva - (ajuste->>'oldQuantity')::bigint
    );
  END LOOP;

  INSERT INTO "MOVIMIENTOS" (
    fecha_pedido, fecha_entrega, comentarios, tipo, elementos, pallets
  ) VALUES (
    CURRENT_DATE, CURRENT_DATE, motivo, 'Ajuste', elementos_movimiento, 0
  )
  RETURNING id INTO mov_id;

  RETURN mov_id;
END;
$function$;
