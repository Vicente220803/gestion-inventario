import { createClient } from '@supabase/supabase-js'

// Rellena estas dos variables con los datos de tu proyecto en Supabase
const supabaseUrl = 'https://wktqxfudyskiffqvzttf.supabase.co'; // Tu URL de Supabase
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrdHF4ZnVkeXNraWZmcXZ6dHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMDIxNjEsImV4cCI6MjA3MTc3ODE2MX0.oZPq8gEKdEYiJuzgikpnSZ89THyB1xrHFNn4va06wn0'; // TU CLAVE PÚBLICA (ANON KEY)

// Exportamos el cliente para usarlo en toda la aplicación
export const supabase = createClient(supabaseUrl, supabaseAnonKey);