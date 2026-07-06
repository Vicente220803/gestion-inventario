-- ============================================================
-- Picking: guardar los HU de cada salida en la BBDD (no en el
-- navegador) para que persistan al recargar y tener historial.
-- Una fila por (fecha, referencia/sku) del día.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.picking_salidas (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fecha       date        NOT NULL,
  sku         text        NOT NULL,
  referencia  text,
  pallets     integer     NOT NULL DEFAULT 0,
  hus         jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- lista de HU escaneados
  sin_hu      boolean     NOT NULL DEFAULT false,        -- material que no lleva HU
  enviado     boolean     NOT NULL DEFAULT false,        -- si ya se mandó el correo
  enviado_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fecha, sku)
);

ALTER TABLE public.picking_salidas ENABLE ROW LEVEL SECURITY;

-- App cerrada a empleados: policy permisiva como el resto de tablas
DROP POLICY IF EXISTS "Permitir acceso total a usuarios autenticados" ON public.picking_salidas;
CREATE POLICY "Permitir acceso total a usuarios autenticados"
  ON public.picking_salidas FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
