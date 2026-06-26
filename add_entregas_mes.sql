-- Añade el nº de entregas en que el proveedor reparte el pedido mensual.
-- 1 = entrega única (pedido normal). >1 = pedido mensual repartido (ITC, cajas, etc.)
-- Se usa en la "Previsión de compra" del Dashboard para mostrar el reparto.
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS entregas_mes integer NOT NULL DEFAULT 1;
