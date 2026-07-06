import { supabase } from '../supabase';

// Acceso a la tabla picking_salidas (HU de cada salida por día)
export function usePicking() {
  // Filas de una fecha concreta (YYYY-MM-DD)
  async function fetchByFecha(fecha) {
    const { data, error } = await supabase
      .from('picking_salidas')
      .select('*')
      .eq('fecha', fecha);
    if (error) throw error;
    return data || [];
  }

  // Upsert por (fecha, sku). Las columnas que no se envían se conservan.
  async function savePicking(rows) {
    if (!rows || rows.length === 0) return;
    const payload = rows.map(r => ({ ...r, updated_at: new Date().toISOString() }));
    const { error } = await supabase
      .from('picking_salidas')
      .upsert(payload, { onConflict: 'fecha,sku' });
    if (error) throw error;
  }

  // Todo el historial (más reciente primero)
  async function fetchHistorial() {
    const { data, error } = await supabase
      .from('picking_salidas')
      .select('*')
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  return { fetchByFecha, savePicking, fetchHistorial };
}
