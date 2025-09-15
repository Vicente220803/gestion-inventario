// Ruta: src/composables/useAuth.js (VERSIÓN FINAL CORREGIDA)
import { ref } from 'vue';
import { supabase } from '../supabase';
import { useToasts } from './useToasts';

// Estado global reactivo
const user = ref(null);
const profile = ref(null);
const isSessionLoading = ref(true); // Siempre empieza en 'true' al cargar la web

export function useAuth() {
  const { showError, showSuccess } = useToasts();

  /**
   * Inicia sesión. Controla el estado de carga global.
   */
  const signIn = async (email, password) => {
    isSessionLoading.value = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showError(error.message);
        // IMPORTANTE: Si hay error, también tenemos que salir del estado de carga
        isSessionLoading.value = false; 
        return;
      }
      user.value = data.user;
      await fetchUserProfile(data.user.id);
      showSuccess('¡Bienvenido!');
    } catch (e) {
      showError('Ocurrió un error inesperado al iniciar sesión.');
    } finally {
      // Al final del proceso de login, SIEMPRE quitamos el estado de carga
      isSessionLoading.value = false;
    }
  };

  /**
   * Cierra la sesión.
   */
  const signOut = async () => {
    await supabase.auth.signOut();
    user.value = null;
    profile.value = null;
  };

  /**
   * Obtiene los datos del perfil del usuario (rol, nombre, etc.).
   */
  const fetchUserProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error("Error al obtener el perfil:", error);
      profile.value = null;
    } else {
      profile.value = data;
    }
  };

  /**
   * Comprueba si ya existe una sesión al cargar la aplicación.
   */
  const checkSession = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        user.value = data.session.user;
        await fetchUserProfile(data.session.user.id);
      }
    } catch (e) {
      console.error("Error al comprobar la sesión:", e);
    } finally {
      // ¡ESTA ERA LA LÍNEA QUE FALTABA!
      // Al terminar de comprobar, haya sesión o no, la carga inicial ha terminado.
      isSessionLoading.value = false;
    }
  };

  return {
    user,
    profile,
    isSessionLoading,
    signIn,
    signOut,
    checkSession,
  };
}