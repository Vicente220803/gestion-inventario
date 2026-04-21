--- INFORME DE ESTRUCTURA DE BASE DE DATOS ---
--- Actualizado: 2026-04-21 ---

--- TABLAS ---

Schema: public | Tabla: MOVIMIENTOS  (RLS: on)
  - id (bigint) NOT NULL  [identity]
  - created_at (timestamp with time zone) NOT NULL  [default now()]
  - tipo (text)
  - fecha_pedido (date)
  - fecha_entrega (date)
  - comentarios (text)
  - elementos (jsonb)
  - pallets (bigint)

Schema: public | Tabla: productos  (RLS: on)
  - sku (text) NOT NULL  [PK]
  - descripcion (text)
  - url_imagen (text)
  - unidades_por_pallet (integer) [default 1]
  - precio_unitario (numeric) [default 0]
  - numero_material (text)
  - aliases (text[]) [default '{}']
  - tipo_pallet (text)

Schema: public | Tabla: stock  (RLS: on)
  - producto_sku (text) NOT NULL  [PK, FK -> productos.sku]
  - cantidad (bigint)
  - user_id (uuid) [FK -> auth.users.id]
  - tipo_pallet (text)

Schema: public | Tabla: stock_lotes  (RLS: on)  -- RLS habilitado 2026-04-21
  - id (bigint) NOT NULL  [PK]
  - producto_sku (text) [FK -> productos.sku]
  - movimiento_id (bigint) [FK -> MOVIMIENTOS.id]
  - pallets (integer) [default 0, CHECK pallets >= 0]
  - unidades_por_pallet (integer)
  - unidades_totales (integer)
  - fecha_entrada (timestamp with time zone) [default now()]
  - created_at (timestamp with time zone) [default now()]

Schema: public | Tabla: profiles  (RLS: on)
  - id (uuid) NOT NULL  [PK, default auth.uid()]
  - created_at (timestamp with time zone) NOT NULL  [default now()]
  - role (text) [default 'operario']

Schema: public | Tabla: entradas_pendientes  (RLS: on)
  - id (bigint) NOT NULL  [identity]
  - created_at (timestamp with time zone) NOT NULL  [default now()]
  - status (text) [default 'pendiente']
  - parsed_data (jsonb)
  - file_url (text)
  - excel_row_id (bigint) [UNIQUE]

Schema: public | Tabla: notifications  (RLS: on)
  - id (uuid) NOT NULL  [PK, default uuid_generate_v4()]
  - message (text)
  - type (text) [default 'info']
  - read (boolean) [default false]
  - created_at (timestamp with time zone) [default now()]
  - user_id (uuid) NOT NULL  [FK -> auth.users.id, default auth.uid()]

Schema: public | Tabla: pdf_email_queue  (RLS: on)
  - id (uuid) NOT NULL  [PK, default gen_random_uuid()]
  - pdf_base64 (text)
  - email_to (text) [default 'vicentemarco@surexport.es']
  - created_at (timestamp with time zone) [default now()]
  - sent (boolean) [default false]


--- VISTAS ---
Schema: public | Vista: stock_con_unidades
  (Definida con SECURITY DEFINER — advisor WARN: revisar cuando se pueda migrar a security_invoker)


--- FUNCIONES ---

CREATE OR REPLACE FUNCTION public.actualizar_stock(sku_producto text, cantidad_cambio integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE stock
  SET cantidad = cantidad + cantidad_cambio
  WHERE producto_sku = sku_producto;
END;
$function$

CREATE OR REPLACE FUNCTION public.actualizar_stock_con_unidades(
  sku_producto text,
  cantidad_pallets integer,
  unidades_pallet integer,
  movimiento_ref bigint DEFAULT NULL::bigint
)
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
      ORDER BY fecha_entrada ASC
    LOOP
      IF pallets_a_consumir <= 0 THEN EXIT; END IF;
      IF lote.pallets <= pallets_a_consumir THEN
        UPDATE stock_lotes SET pallets = 0, unidades_totales = 0 WHERE id = lote.id;
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
$function$

CREATE OR REPLACE FUNCTION public.obtener_lotes_producto(sku_producto text)
 RETURNS TABLE(lote_id bigint, pallets integer, unidades_por_pallet integer, unidades_totales integer, fecha_entrada timestamp with time zone, es_estandar boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT sl.id, sl.pallets, sl.unidades_por_pallet, sl.unidades_totales, sl.fecha_entrada,
         (sl.unidades_por_pallet = p.unidades_por_pallet) AS es_estandar
  FROM stock_lotes sl
  JOIN productos p ON sl.producto_sku = p.sku
  WHERE sl.producto_sku = sku_producto AND sl.pallets > 0
  ORDER BY sl.fecha_entrada ASC;
END;
$function$

CREATE OR REPLACE FUNCTION public.validar_unidades_lote()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.unidades_totales != (NEW.pallets * NEW.unidades_por_pallet) THEN
    RAISE EXCEPTION 'Las unidades totales (%) no coinciden con pallets × unidades_por_pallet (% × % = %)',
      NEW.unidades_totales, NEW.pallets, NEW.unidades_por_pallet, NEW.pallets * NEW.unidades_por_pallet;
  END IF;
  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$function$


--- POLICIES RLS ---
- Todas las tablas tienen RLS habilitado.
- Policies permisivas: "Permitir acceso total a usuarios autenticados" (USING true / WITH CHECK true)
  en: MOVIMIENTOS, productos, stock, stock_lotes, profiles, notifications, entradas_pendientes.
- pdf_email_queue: "Allow anon update" + "Allow authenticated insert" (ambas con CHECK true).
- Nota: el advisor marca como WARN estas policies "always true" — bastan para entorno
  autenticado único, pero no aíslan datos entre usuarios.


--- TRIGGERS ---
(No se listan aquí — gestionados por Supabase Auth y validar_unidades_lote sobre stock_lotes)
