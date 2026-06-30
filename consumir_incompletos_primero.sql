-- Opción A: al hacer salidas, consumir SIEMPRE los pallets incompletos primero
-- (y luego FIFO, el más antiguo). Evita que un pallet incompleto se quede
-- "atrapado" cuando se envía uno que no es el más antiguo.
--
-- Único cambio respecto a las funciones actuales: el ORDER BY del bucle de
-- consumo pasa de:   ORDER BY fecha_entrada ASC
--                a:   ORDER BY unidades_por_pallet ASC, fecha_entrada ASC
-- (menos unidades por pallet = incompleto -> sale primero; a igualdad, el más antiguo).

CREATE OR REPLACE FUNCTION public.actualizar_stock(sku_producto text, cantidad_cambio integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pallets_a_consumir INTEGER;
  lote RECORD;
BEGIN
  UPDATE stock
  SET cantidad = cantidad + cantidad_cambio
  WHERE producto_sku = sku_producto;

  IF cantidad_cambio < 0 THEN
    pallets_a_consumir := ABS(cantidad_cambio);
    FOR lote IN
      SELECT id, pallets, unidades_por_pallet
      FROM stock_lotes
      WHERE producto_sku = sku_producto AND pallets > 0
      ORDER BY unidades_por_pallet ASC, fecha_entrada ASC
    LOOP
      IF pallets_a_consumir <= 0 THEN EXIT; END IF;
      IF lote.pallets <= pallets_a_consumir THEN
        DELETE FROM stock_lotes WHERE id = lote.id;
        pallets_a_consumir := pallets_a_consumir - lote.pallets;
      ELSE
        UPDATE stock_lotes
        SET pallets = pallets - pallets_a_consumir,
            unidades_totales = (pallets - pallets_a_consumir) * lote.unidades_por_pallet
        WHERE id = lote.id;
        pallets_a_consumir := 0;
      END IF;
    END LOOP;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.actualizar_stock_con_unidades(sku_producto text, cantidad_pallets integer, unidades_pallet integer, movimiento_ref bigint DEFAULT NULL::bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  unidades_calculadas INTEGER;
  pallets_a_consumir INTEGER;
  lote RECORD;
BEGIN
  unidades_calculadas := cantidad_pallets * unidades_pallet;

  UPDATE stock
  SET cantidad = cantidad + cantidad_pallets
  WHERE producto_sku = sku_producto;

  IF NOT FOUND THEN
    INSERT INTO stock (producto_sku, cantidad)
    VALUES (sku_producto, cantidad_pallets);
  END IF;

  IF cantidad_pallets > 0 THEN
    INSERT INTO stock_lotes (
      producto_sku, movimiento_id, pallets, unidades_por_pallet, unidades_totales
    )
    VALUES (
      sku_producto, movimiento_ref, cantidad_pallets, unidades_pallet, unidades_calculadas
    );
  END IF;

  IF cantidad_pallets < 0 THEN
    pallets_a_consumir := ABS(cantidad_pallets);
    FOR lote IN
      SELECT id, pallets, unidades_por_pallet
      FROM stock_lotes
      WHERE producto_sku = sku_producto AND pallets > 0
      ORDER BY unidades_por_pallet ASC, fecha_entrada ASC
    LOOP
      IF pallets_a_consumir <= 0 THEN EXIT; END IF;
      IF lote.pallets <= pallets_a_consumir THEN
        DELETE FROM stock_lotes WHERE id = lote.id;
        pallets_a_consumir := pallets_a_consumir - lote.pallets;
      ELSE
        UPDATE stock_lotes
        SET pallets = pallets - pallets_a_consumir,
            unidades_totales = (pallets - pallets_a_consumir) * lote.unidades_por_pallet
        WHERE id = lote.id;
        pallets_a_consumir := 0;
      END IF;
    END LOOP;
  END IF;
END;
$function$;
