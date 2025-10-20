<template>
  <!-- 
    Cambiamos la clase 'flex' por 'lg:flex' para que solo se aplique en pantallas grandes.
    'relative' es necesario para posicionar el menú lateral correctamente.
  -->
  <div class="relative min-h-screen bg-gray-100 dark:bg-gray-900 lg:flex">
    
    <!-- === INICIO: CAMBIOS EN LA BARRA LATERAL (SIDEBAR) === -->

    <!-- 1. Overlay para el fondo oscuro en móvil -->
    <!-- Este div solo aparece cuando el menú está abierto en móvil, y si haces clic en él, cierra el menú -->
    <div
      v-if="isSidebarOpen"
      class="fixed inset-0 z-20 bg-black opacity-50 lg:hidden"
      @click="isSidebarOpen = false"
    ></div>

    <!-- 2. Contenedor del Sidebar con nuevas clases para el comportamiento móvil -->
    <!-- 
      - 'fixed inset-y-0 left-0 z-30': Lo posiciona como un menú flotante en móvil.
      - 'transform transition duration-300': Añade una animación suave de deslizamiento.
      - 'lg:relative lg:translate-x-0': En pantallas grandes, vuelve a ser un elemento estático y visible.
      - La clase condicional :class controla si el menú está visible ('translate-x-0') u oculto ('-translate-x-full') en móvil.
    -->
    <div
      :class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full'"
      class="fixed inset-y-0 left-0 z-30 w-64 transform bg-white dark:bg-gray-800 shadow-lg transition duration-300 ease-in-out lg:relative lg:translate-x-0 lg:shadow-none"
    >
      <!-- Tu componente Sidebar original va aquí dentro, sin cambios -->
      <Sidebar />
    </div>

    <!-- === FIN: CAMBIOS EN LA BARRA LATERAL (SIDEBAR) === -->


    <!-- Contenido Principal (Main content) -->
    <div class="flex-1 flex flex-col overflow-hidden">
      
      <!-- Cabecera (Header) -->
      <Header />

      <!-- 
        3. Botón de Hamburguesa para Móvil
        Este botón solo es visible en pantallas pequeñas ('lg:hidden')
        y al hacerle clic, cambia el estado de 'isSidebarOpen' para mostrar/ocultar el menú.
        Lo posicionamos de forma absoluta para que aparezca sobre la cabecera.
      -->
      <button 
        @click="isSidebarOpen = !isSidebarOpen" 
        class="absolute top-4 right-4 z-10 p-2 text-gray-700 dark:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 lg:hidden"
      >
        <!-- Icono de hamburguesa (puedes cambiarlo por un texto si quieres) -->
        <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      </button>


      <!-- Contenido de la página (Page content) -->
      <main class="flex-1 overflow-y-auto p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'; // Importamos 'ref' de Vue para crear una variable reactiva
import Sidebar from './Sidebar.vue';
import Header from './Header.vue';

// Creamos una variable 'isSidebarOpen' para saber si el menú lateral debe mostrarse o no en móvil.
// Por defecto, está cerrado (false).
const isSidebarOpen = ref(false);
</script>