// RUTA: /src/supabase.js

import { createClient } from '@supabase/supabase-js'

// ANTES (La llave estaba aquí):
// const supabaseUrl = 'https://wktqxfudyskiffqvzttf.supabase.co'
// const supabaseAnonKey = 'eyJhbGciOi...'

// AHORA (Le decimos que la coja del bolsillo .env):
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)