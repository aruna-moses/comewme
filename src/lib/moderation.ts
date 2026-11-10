import { supabase } from './supabase'

export interface ModerationCounts {
  is_moderator: boolean
  sos: number
  reports: number
  appeals: number
  ads: number
  latest_sos: {
    id: string
    created_at: string
    location_address: string | null
    display_name: string | null
    task_title: string | null
  } | null
}

export const EMPTY_MODERATION: ModerationCounts = {
  is_moderator: false,
  sos: 0,
  reports: 0,
  appeals: 0,
  ads: 0,
  latest_sos: null,
}

/** Everything moderators need for their badges, in a single round trip. */
export async function fetchModerationCounts(): Promise<ModerationCounts> {
  const { data, error } = await supabase.rpc('moderation_counts')
  if (error) throw error
  return { ...EMPTY_MODERATION, ...(data as Partial<ModerationCounts>) }
}

export type SOSStatus = 'pending' | 'reviewed' | 'resolved' | 'false_alarm'

export interface SOSAlert {
  id: string
  task_id: string
  task_title: string | null
  user_id: string
  display_name: string | null
  username: string | null
  location_lat: number | null
  location_lng: number | null
  location_address: string | null
  media_url: string | null
  media_type: 'image' | 'video' | null
  status: SOSStatus
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
}

export async function fetchSOSAlerts(): Promise<SOSAlert[]> {
  const { data, error } = await supabase.rpc('list_sos_alerts')
  if (error) throw error
  return (data ?? []) as SOSAlert[]
}

export async function reviewSOSAlert(id: string, status: SOSStatus, note: string | null) {
  const { error } = await supabase.rpc('review_sos_alert', {
    p_id: id,
    p_status: status,
    p_note: note,
  })
  if (error) throw error
}

export function mapLink(lat: number | null, lng: number | null, address: string | null) {
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  }
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  return null
}
