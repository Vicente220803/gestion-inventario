// Ruta: src/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wktqxfudyskiffqvzttf.supabase.co' // <-- Pega tu URL aquí
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrdHF4ZnVkeXNraWZmcXZ6dHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMDIxNjEsImV4cCI6MjA3MTc3ODE2MX0.oZPq8gEKdEYiJuzgikpnSZ89THyB1xrHFNn4va06wn0' // <-- Pega tu clave aquí

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

