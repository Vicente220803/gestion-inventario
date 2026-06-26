-- Añade el plazo de entrega (lead time) por producto, en días.
-- Se usa en la "Previsión de compra" del Dashboard para calcular el margen
-- para pedir y la cantidad sugerida.
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS lead_time integer NOT NULL DEFAULT 7;
