import { createClient } from '@supabase/supabase-js'

// Cliente para una SEGUNDA base de datos (independiente de la principal de inventario).
// Rellena estas variables en el archivo .env para activar la conexión:
//   VITE_SUPABASE_URL_2=...
//   VITE_SUPABASE_ANON_KEY_2=...
const url = import.meta.env.VITE_SUPABASE_URL_2
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY_2

// Solo creamos el cliente si las credenciales están configuradas.
export const isSecondaryConfigured = Boolean(url && anonKey)

export const supabaseSecondary = isSecondaryConfigured
  ? createClient(url, anonKey)
  : null
