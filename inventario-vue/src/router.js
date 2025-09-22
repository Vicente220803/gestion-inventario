import { createRouter, createWebHistory } from 'vue-router';
import { user, profile } from './authState';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('./views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('./components/AuthenticatedLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/new-order'
      },
      {
        path: '/inventory',
        name: 'Inventory',
        component: () => import('./views/StockView.vue'),
        meta: { allowedRoles: ['admin', 'operario'] }
      },
      {
        path: '/movements',
        name: 'Movements',
        component: () => import('./views/HistoryView.vue'),
        meta: { allowedRoles: ['admin'] }
      },
      {
        path: '/incomings',
        name: 'Incomings',
        component: () => import('./views/IncomingsView.vue'),
        meta: { allowedRoles: ['admin'] }
      },
      {
        path: '/settings',
        name: 'Settings',
        component: () => import('./views/SettingsView.vue'),
        meta: { allowedRoles: ['admin'] }
      },
      {
        path: '/new-order',
        name: 'NewOrder',
        component: () => import('./views/NewOrderView.vue'),
        meta: { allowedRoles: ['admin', 'operario'] }
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  const requiresAuth = to.meta.requiresAuth;
  const allowedRoles = to.meta.allowedRoles;

  if (requiresAuth && !user.value) {
    next('/login');
  } else if (to.path === '/login' && user.value) {
    next('/new-order');
  } else if (allowedRoles && profile.value && !allowedRoles.includes(profile.value.role)) {
    console.log(`[DEBUG] Acceso denegado a ${to.path} para rol ${profile.value.role}`);
    next('/'); // Redirigir al dashboard si no tiene permisos
  } else {
    next();
  }
});

export default router;