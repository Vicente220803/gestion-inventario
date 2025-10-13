import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// En lugar de una variable global, creamos una función que actúa como "guardián".
// Esto a veces funciona mejor con la recarga en caliente de Vite.
const getSupabase = () => {
  // Usamos una clave en el objeto 'window' para almacenar la instancia.
  const INSTANCE_KEY = '__SUPABASE_CLIENT__';

  // Si la instancia no existe en 'window', la creamos y la guardamos.
  if (!window[INSTANCE_KEY]) {
    console.log('[DEBUG] supabase.js: Creando nueva instancia del cliente.');
    window[INSTANCE_KEY] = createClient(supabaseUrl, supabaseAnonKey);
  } else {
    console.log('[DEBUG] supabase.js: Reutilizando instancia existente.');
  }
  
  // Devolvemos la instancia (ya sea la nueva o la que ya existía).
  return window[INSTANCE_KEY];
}

// Exportamos el resultado de llamar a la función guardiana.
export const supabase = getSupabase();