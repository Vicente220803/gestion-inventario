import { createClient } from '@supabase/supabase-js'

// Rellena estas dos variables con los datos de tu proyecto en Supabase
const supabaseUrl = 'https://wktqxfudyskiffqvzttf.supabase.co'; 
// Pega aquí la clave pública (ANON KEY) que encuentras en Project Settings > API
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrdHF4ZnVkeXNraWZmcXZ6dHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMDIxNjEsImV4cCI6MjA3MTc3ODE2MX0.oZPq8gEKdEYiJuzgikpnSZ89THyB1xrHFNn4va06wn0'; // <--- ¡¡PÉGALA AQUÍ!!

// Exportamos el cliente para usarlo en toda la aplicación
export const supabase = createClient(supabaseUrl, supabaseAnonKey);