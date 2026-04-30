-- ============================================================
-- Mejora de fiabilidad de datos: RPC atómica para ajustes
-- Fecha: 2026-04-30
--
-- Reemplaza el patrón "actualizar stock + insertar movimiento"
-- (que dejaba datos divergentes si fallaba el insert) por una
-- única transacción atómica.
--
-- También permite reverir el caso "📦 Ajustar Unidades":
-- guardamos el snapshot de lotes anteriores en el movimiento.
-- ============================================================

-- 1) Ajuste manual de stock (recuento manual desde StockView)
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
  movimiento_id bigint;
  ajuste jsonb;
  elementos_movimiento jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_array_length(ajustes) = 0 THEN
    RAISE EXCEPTION 'No hay ajustes que registrar';
  END IF;

  FOR ajuste IN SELECT * FROM jsonb_array_elements(ajustes)
  LOOP
    INSERT INTO stock (producto_sku, cantidad)
    VALUES (ajuste->>'sku', (ajuste->>'newQuantity')::bigint)
    ON CONFLICT (producto_sku) DO UPDATE
      SET cantidad = EXCLUDED.cantidad;

    elementos_movimiento := elementos_movimiento || jsonb_build_object(
      'sku', ajuste->>'sku',
      'desc', ajuste->>'desc',
      'cantidad_anterior', (ajuste->>'oldQuantity')::bigint,
      'cantidad_nueva', (ajuste->>'newQuantity')::bigint,
      'diferencia', (ajuste->>'newQuantity')::bigint - (ajuste->>'oldQuantity')::bigint
    );
  END LOOP;

  INSERT INTO "MOVIMIENTOS" (
    fecha_pedido, fecha_entrega, comentarios, tipo, elementos, pallets
  ) VALUES (
    CURRENT_DATE, CURRENT_DATE, motivo, 'Ajuste', elementos_movimiento, 0
  )
  RETURNING id INTO movimiento_id;

  RETURN movimiento_id;
END;
$function$;


-- 2) Ajuste de pallets incompletos (📦 Ajustar Unidades)
--    Guarda snapshot de lotes anteriores para permitir revertir.
CREATE OR REPLACE FUNCTION public.ajustar_unidades_reales_atomico(
  sku_producto text,
  pallets_completos integer,
  pallets_incompletos integer,
  unidades_pallets_incompletos integer,
  unidades_estandar integer,
  motivo text,
  desc_producto text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  movimiento_id bigint;
  lotes_anteriores jsonb;
  unidades_antes integer;
  unidades_despues integer;
  stock_actual bigint;
BEGIN
  SELECT cantidad INTO stock_actual FROM stock WHERE producto_sku = sku_producto;
  IF stock_actual IS NULL THEN stock_actual := 0; END IF;

  IF (pallets_completos + pallets_incompletos) <> stock_actual THEN
    RAISE EXCEPTION 'El total de pallets (%) no coincide con el stock actual (%)',
      pallets_completos + pallets_incompletos, stock_actual;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'pallets', pallets,
    'unidades_por_pallet', unidades_por_pallet,
    'unidades_totales', unidades_totales,
    'fecha_entrada', fecha_entrada,
    'movimiento_id', movimiento_id
  )), '[]'::jsonb)
  INTO lotes_anteriores
  FROM stock_lotes
  WHERE producto_sku = sku_producto;

  SELECT COALESCE(SUM(unidades_totales), 0) INTO unidades_antes
  FROM stock_lotes WHERE producto_sku = sku_producto;

  unidades_despues := (pallets_completos * unidades_estandar)
                    + (pallets_incompletos * unidades_pallets_incompletos);

  DELETE FROM stock_lotes WHERE producto_sku = sku_producto;

  IF pallets_completos > 0 THEN
    INSERT INTO stock_lotes (producto_sku, pallets, unidades_por_pallet, unidades_totales)
    VALUES (sku_producto, pallets_completos, unidades_estandar, pallets_completos * unidades_estandar);
  END IF;

  IF pallets_incompletos > 0 THEN
    INSERT INTO stock_lotes (producto_sku, pallets, unidades_por_pallet, unidades_totales)
    VALUES (sku_producto, pallets_incompletos, unidades_pallets_incompletos,
            pallets_incompletos * unidades_pallets_incompletos);
  END IF;

  INSERT INTO "MOVIMIENTOS" (
    fecha_pedido, fecha_entrega, comentarios, tipo, elementos, pallets
  ) VALUES (
    CURRENT_DATE, CURRENT_DATE,
    motivo || ' | ' || desc_producto || ': ' || pallets_completos
      || ' pallets completos (' || unidades_estandar || ' uds/pallet) + '
      || pallets_incompletos || ' pallets incompletos ('
      || unidades_pallets_incompletos || ' uds/pallet) | Diferencia: '
      || (unidades_despues - unidades_antes) || ' unidades',
    'Ajuste',
    jsonb_build_array(jsonb_build_object(
      'sku', sku_producto,
      'desc', desc_producto,
      'cantidad', stock_actual,
      'unidades_antes', unidades_antes,
      'unidades_despues', unidades_despues,
      'diferencia_unidades', unidades_despues - unidades_antes,
      'lotes_anteriores', lotes_anteriores
    )),
    0
  )
  RETURNING id INTO movimiento_id;

  RETURN movimiento_id;
END;
$function$;


-- 3) Revertir un ajuste de unidades reales (anular movimiento "📦 Ajustar Unidades")
CREATE OR REPLACE FUNCTION public.revertir_ajuste_unidades(
  sku_producto text,
  lotes_anteriores jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  lote jsonb;
BEGIN
  DELETE FROM stock_lotes WHERE producto_sku = sku_producto;

  FOR lote IN SELECT * FROM jsonb_array_elements(lotes_anteriores)
  LOOP
    INSERT INTO stock_lotes (
      producto_sku, pallets, unidades_por_pallet, unidades_totales,
      fecha_entrada, movimiento_id
    ) VALUES (
      sku_producto,
      (lote->>'pallets')::integer,
      (lote->>'unidades_por_pallet')::integer,
      (lote->>'unidades_totales')::integer,
      COALESCE((lote->>'fecha_entrada')::timestamptz, now()),
      NULLIF(lote->>'movimiento_id', 'null')::bigint
    );
  END LOOP;
END;
$function$;
