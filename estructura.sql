--- INFORME DE ESTRUCTURA DE BASE DE DATOS ---
--- TABLAS ---
Schema: public | Tabla: MOVIMIENTOS
  - id (bigint) NOT NULL
  - created_at (timestamp with time zone) NOT NULL
  - tipo (text) 
  - fecha_pedido (date) 
  - fecha_entrega (date) 
  - comentarios (text) 
  - elementos (jsonb) 
  - pallets (bigint) 
Schema: public | Tabla: entradas_pendientes
  - id (bigint) NOT NULL
  - created_at (timestamp with time zone) NOT NULL
  - status (text) 
  - parsed_data (jsonb) 
  - file_url (text) 
  - excel_row_id (bigint) 
Schema: public | Tabla: notifications
  - id (uuid) NOT NULL
  - message (text) 
  - type (text) 
  - read (boolean) 
  - created_at (timestamp with time zone) 
  - user_id (uuid) NOT NULL
Schema: public | Tabla: productos
  - sku (text) NOT NULL
  - descripcion (text) 
  - url_imagen (text) 
Schema: public | Tabla: profiles
  - id (uuid) NOT NULL
  - created_at (timestamp with time zone) NOT NULL
  - role (text) 
Schema: public | Tabla: stock
  - producto_sku (text) NOT NULL
  - cantidad (bigint) 
  - user_id (uuid) 


--- FUNCIONES (procedimientos) ---
CREATE OR REPLACE FUNCTION public.actualizar_stock(sku_producto text, cantidad_cambio integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  SET search_path = public;
  UPDATE stock
  SET cantidad = cantidad + cantidad_cambio
  WHERE producto_sku = sku_producto;
END;
$function$

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$function$



--- TRIGGERS ---


--- TIPOS PERSONALIZADOS (ENUMs, etc.) ---