-- ======================================================
-- FIXES DE SEGURIDAD DETECTADOS POR EL LINTER DE SUPABASE
-- Ejecutar en: SQL Editor de Supabase
-- Revisar hallazgos: Database > Advisors (después de aplicar)
-- ======================================================

-- 1. [ERROR] Habilitar RLS en stock_lotes (actualmente TODO el mundo con anon key puede leer/modificar)
ALTER TABLE public.stock_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acceso a usuarios autenticados"
  ON public.stock_lotes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. [WARN] Fijar search_path en funciones RPC (previene SQL injection)
ALTER FUNCTION public.actualizar_stock(text, integer) SET search_path = public;
ALTER FUNCTION public.actualizar_stock_con_unidades(text, integer, integer, bigint) SET search_path = public;
ALTER FUNCTION public.validar_unidades_lote() SET search_path = public;
ALTER FUNCTION public.obtener_lotes_producto(text) SET search_path = public;

-- 3. [ERROR] La vista stock_con_unidades usa SECURITY DEFINER (privilegios del creador).
--    Recreada como SECURITY INVOKER para que respete los permisos del usuario.
--    Nota: ejecutar solo si la vista no requiere permisos elevados para funcionar.
--    Si al ejecutar rompe la vista de Stock, revertir con SECURITY DEFINER.
-- ALTER VIEW public.stock_con_unidades SET (security_invoker = true);
