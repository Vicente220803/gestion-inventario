import { ref, computed } from 'vue'
import { supabase } from '../supabase'
import { user } from '../authState'

const notifications = ref([])
const loading = ref(false)

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

const loadNotifications = async () => {
  loading.value = true
  try {
    // Clear old notifications (older than 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('notifications').delete().lt('created_at', twentyFourHoursAgo).eq('user_id', user.value?.id)

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.value?.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    notifications.value = data || []
  } catch (error) {
    console.error('Error loading notifications:', error)
  } finally {
    loading.value = false
  }
}

const markAsRead = async (id) => {
  const notification = notifications.value.find(n => n.id === id)
  if (notification) {
    notification.read = true
    await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', user.value?.id)
  }
}

const markAllAsRead = async () => {
  notifications.value.forEach(n => n.read = true)
  await supabase.from('notifications').update({ read: true }).eq('read', false).eq('user_id', user.value?.id)
}

const createNotification = async (message, type = 'info') => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([{ message, type, read: false, user_id: user.value?.id }])
    if (error) throw error
    // Reload notifications to include the new one
    await loadNotifications()
  } catch (error) {
    console.error('Error creating notification:', error)
  }
}

export function useNotifications() {
  return {
    notifications,
    loading,
    unreadCount,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    createNotification
  }
}