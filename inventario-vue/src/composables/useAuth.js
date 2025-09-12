// Ruta: src/composables/useAuth.js (CORREGIDO)
import { ref } from 'vue'; // Ya no necesitamos onMounted aquí
import { supabase } from '../supabase';
import { useToasts } from './useToasts';

const user = ref(null);
const profile = ref(null);
const isSessionLoading = ref(true);

export function useAuth() {
  const { showError, showSuccess } = useToasts();

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { showError(error.message); return; }
    user.value = data.user;
    await fetchUserProfile(data.user.id);
    showSuccess('¡Bienvenido!');
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) { showError(error.message); return; }
    user.value = null;
    profile.value = null;
  };

  const fetchUserProfile = async (userId) => {
    const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
    if (error) {
      console.error("Error al obtener el perfil:", error);
      profile.value = null;
    } else {
      profile.value = data;
    }
  };

  const checkSession = async () => {
    // Ya no seteamos isSessionLoading a true aquí, porque empieza como true por defecto.
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        user.value = data.session.user;
        await fetchUserProfile(data.session.user.id);
      }
    } catch (e) {
      console.error("Error al comprobar la sesión:", e);
    } finally {
      isSessionLoading.value = false; // La carga siempre termina.
    }
  };

  // --- HEMOS ELIMINADO EL onMounted DE AQUÍ ---

  return {
    user,
    profile,
    isSessionLoading,
    signIn,
    signOut,
    checkSession, // <-- AHORA EXPORTAMOS LA FUNCIÓN
  };
}