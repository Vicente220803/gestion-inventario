import { ref } from 'vue';
import { supabase } from './supabase';
import { useToasts } from './composables/useToasts';

// ESTADOS GLOBALES
export const user = ref(null);
export const profile = ref(null);

const { showError, showSuccess } = useToasts();

/**
 * Inicia sesión con email y contraseña.
 * Devuelve `true` si fue exitoso, `false` si no.
 */
export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showError(error.message);
      return false;
    }
    showSuccess('¡Bienvenido!');
    return true;
  } catch (e) {
    showError('Ocurrió un error inesperado al iniciar sesión.');
    return false;
  }
}

/**
 * Cierra la sesión del usuario.
 */
export async function signOut() {
  await supabase.auth.signOut();
  user.value = null;
  profile.value = null;
}