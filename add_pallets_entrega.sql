-- Añade el máximo de pallets por entrega (camión) por producto.
-- Cada proveedor/cliente tiene su capacidad por entrega (ITC 33, etc.)
-- Se usa en la "Previsión de compra" para calcular las entregas necesarias.
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS pallets_entrega integer NOT NULL DEFAULT 33;
