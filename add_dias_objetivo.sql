-- Añade el "stock objetivo" por producto, en días de cobertura deseados.
-- Se usa en la "Previsión de compra" del Dashboard junto al lead time.
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS dias_objetivo integer NOT NULL DEFAULT 30;
