import { createClient } from '@supabase/supabase-js'

// Leemos las variables de entorno del archivo .env
// Vite reemplazará estas líneas con los valores reales durante la compilación.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Exportamos el cliente para usarlo en toda la aplicación
export const supabase = createClient(supabaseUrl, supabaseAnonKey);