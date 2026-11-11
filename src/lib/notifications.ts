import { supabase } from './supabase'

export type NotificationType = 'join_request' | 'selfie' | 'appeal' | 'violation' | 'chat' | 'info' | 'reminder'

export interface InAppNotification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  link_path: string | null
  created_at: string
  read_at: string | null
}

export async function fetchNotifications(limit = 30): Promise<InAppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, body, link_path, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as InAppNotification[]
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)
  if (error) throw error
}

export async function markAllNotificationsRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  if (error) throw error
}
