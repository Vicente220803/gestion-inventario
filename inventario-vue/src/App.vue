<script setup>
import { ref, onMounted } from 'vue';
import { useInventory } from './composables/useInventory';
import TheHeader from './components/TheHeader.vue';
import TheNavigation from './components/TheNavigation.vue';
import NewOrderView from './views/NewOrderView.vue';
import StockView from './views/StockView.vue';
import IncomingsView from './views/IncomingsView.vue';
import HistoryView from './views/HistoryView.vue';
import SettingsView from './views/SettingsView.vue';

const activeTab = ref('form');
const { loadFromLocalStorage } = useInventory();
onMounted(() => {
  loadFromLocalStorage();
});
</script>

<template>
  <div class="max-w-4xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden md:p-8 p-4">
    <TheHeader />
    <TheNavigation 
      :active-tab="activeTab" 
      @navigate="newTab => activeTab = newTab" 
    />
    <main>
      <NewOrderView v-if="activeTab === 'form'" />
      <StockView v-else-if="activeTab === 'stock'" />
      <IncomingsView v-else-if="activeTab === 'incomings'" />
      <SettingsView v-else-if="activeTab === 'settings'" />
      <HistoryView v-else-if="activeTab === 'history'" />
    </main>
  </div>
</template>

<style>
body {
    font-family: 'Inter', sans-serif;
    background-color: #f3f4f6;
}
</style>```
