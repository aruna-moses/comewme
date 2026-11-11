import { supabase } from './supabase'

export interface ModerationCounts {
  is_moderator: boolean
  sos: number
  reports: number
  appeals: number
  ads: number
  verifications: number
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
  verifications: 0,
  latest_sos: null,
}

/** Everything moderators need for their badges, in a single round trip. */
export async function fetchModerationCounts(): Promise<ModerationCounts> {
  const { data, error } = await supabase.rpc('moderation_counts')
  if (error) throw error
  return { ...EMPTY_MODERATION, ...(data as Partial<ModerationCounts>) }
}

export type SOSStatus = 'pending' | 'reviewed' | 'resolved' | 'false_alarm'

export interface VerificationSubmission {
  id: string
  user_id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  selfie_path: string
  /** Signed by the moderator on read — only valid for an hour. */
  selfie_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export async function fetchPendingVerifications(): Promise<VerificationSubmission[]> {
  const { data, error } = await supabase.rpc('list_pending_verifications')
  if (error) throw error
  const rows = (data ?? []) as Array<{
    id: string
    user_id: string
    display_name: string | null
    username: string | null
    avatar_url: string | null
    selfie_path: string
    status: 'pending'
    created_at: string
  }>
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await supabase.storage
        .from('verifications')
        .createSignedUrl(row.selfie_path, 60 * 60)
      return { ...row, selfie_url: signed?.signedUrl ?? null }
    }),
  )
  return enriched
}

export async function reviewVerification(
  id: string,
  status: 'approved' | 'rejected',
  note: string | null,
) {
  const { error } = await supabase.rpc('review_verification', {
    p_id: id,
    p_status: status,
    p_note: note?.trim() || null,
  })
  if (error) throw error
}

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

export type ReviewKind = 'sos' | 'report' | 'appeal' | 'ad' | 'verification'

export interface RecentReviewDetail {
  task_title?: string | null
  location_lat?: number | null
  location_lng?: number | null
  location_address?: string | null
  media_url?: string | null
  media_type?: 'image' | 'video' | null
  description?: string | null
  severity?: string | null
  action_taken?: string | null
  reported_by?: string | null
  appeal_reason?: string | null
  admin_response?: string | null
  violation_description?: string | null
  violation_category?: string | null
  violation_severity?: string | null
  brand_name?: string | null
  cta_text?: string | null
  destination_url?: string | null
  image_url?: string | null
  brand_color?: string | null
  start_date?: string | null
  end_date?: string | null
  selfie_path?: string | null
  avatar_url?: string | null
  username?: string | null
}

export interface RecentReview {
  kind: ReviewKind
  id: string
  title: string
  status: string
  note: string | null
  reviewed_at: string
  display_name: string | null
  username: string | null
  detail?: RecentReviewDetail | null
  related_kind?: 'task' | 'profile' | 'admin_ads' | null
  related_id?: string | null
}

/** Everything the reviewer has finished in the last while, newest first — for later reference. */
export async function fetchRecentReviews(limit = 30): Promise<RecentReview[]> {
  const { data, error } = await supabase.rpc('list_recent_reviews', { p_limit: limit })
  if (error) throw error
  return (data ?? []) as RecentReview[]
}

export function mapLink(lat: number | null, lng: number | null, address: string | null) {
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  }
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  return null
}
