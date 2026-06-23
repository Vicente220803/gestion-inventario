import { createRouter, createWebHistory } from 'vue-router';
import { supabase } from './supabase';
import { user, profile } from './authState';

// Ya no necesitamos importar useInventory aquí.

async function fetchProfile(sessionUser) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', sessionUser.id)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error al obtener el perfil del usuario:", error.message);
    return null;
  }
}

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('./views/LoginView.vue'),
  },
  {
    path: '/',
    component: () => import('./components/AuthenticatedLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/new-order' },
      { path: 'stock', name: 'Stock', component: () => import('./views/StockView.vue'), meta: { allowedRoles: ['admin', 'operario'] } },
      { path: 'historial', name: 'Historial', component: () => import('./views/HistoryView.vue'), meta: { allowedRoles: ['admin', 'operario'] } },
      { path: 'incomings', name: 'Incomings', component: () => import('./views/IncomingsView.vue'), meta: { allowedRoles: ['admin'] } },
      { path: 'settings', name: 'Settings', component: () => import('./views/SettingsView.vue'), meta: { allowedRoles: ['admin'] } },
      { path: 'new-order', name: 'NewOrder', component: () => import('./views/NewOrderView.vue'), meta: { allowedRoles: ['admin', 'operario'] } }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, from, next) => {
  const { data: { session } } = await supabase.auth.getSession();
  const currentUser = session?.user;
  user.value = currentUser;

  if (currentUser && (!profile.value || profile.value.id !== currentUser.id)) {
    profile.value = await fetchProfile(currentUser);
  } else if (!currentUser) {
    profile.value = null;
  }

  // --- LÓGICA DE CARGA DE DATOS ELIMINADA DE AQUÍ ---

  const requiresAuth = to.meta.requiresAuth;
  const allowedRoles = to.meta.allowedRoles;

  if (requiresAuth && !currentUser) {
    return next({ name: 'Login' });
  }

  if (to.name === 'Login' && currentUser) {
    return next({ name: 'NewOrder' });
  }

  if (allowedRoles && profile.value && !allowedRoles.includes(profile.value.role)) {
    return next({ name: 'NewOrder' });
  }

  next();
});

export default router;