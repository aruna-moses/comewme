export type Category =
  | 'market_run'
  | 'ride'
  | 'food'
  | 'study'
  | 'dev'
  | 'event'
  | 'errands'
  | 'other'

export const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: 'market_run', label: 'Errands', emoji: '🛒' },
  { value: 'ride', label: 'Rides', emoji: '🚗' },
  { value: 'food', label: 'Food', emoji: '🍽️' },
  { value: 'study', label: 'Study', emoji: '📚' },
  { value: 'dev', label: 'Skill Meetups', emoji: '💻' },
  { value: 'event', label: 'Events', emoji: '🎉' },
  { value: 'errands', label: 'Errands', emoji: '📦' },
  { value: 'other', label: 'Other', emoji: '➕' },
]

export const categoryLabel = (c: Category) =>
  CATEGORIES.find((x) => x.value === c)?.label ?? 'Other'

export const AREAS = [
  'Yaba',
  'Ikeja',
  'Victoria Island',
  'Surulere',
  'Ajah',
  'Lekki',
  'Ikorodu',
  'Festac',
  'Lagos Island',
  'Other',
]

export type VerificationStatus = 'unverified' | 'pending' | 'verified'
export type TaskStatus = 'open' | 'full' | 'completed' | 'cancelled'
export type JoinStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'waitlisted'
export type CharacterPersona =
  | 'tari'
  | 'ibrahim'
  | 'zainab'
  | 'tunde'
  | 'runo'
  | 'kemi'
  | 'ese'
  | 'ngozi'
  | 'david'
  | 'maya'
  | 'burna'
  | 'chidi'

export interface Profile {
  id: string
  display_name: string
  username: string
  avatar_url: string | null
  area: string | null
  city: string
  bio: string | null
  phone: string | null
  interests: Category[]
  trust_score: number
  tasks_completed: number
  no_shows: number
  verification_status: VerificationStatus
  community_check_passed_at: string | null
  character_persona?: CharacterPersona | null
  created_at: string
}

export interface Task {
  id: string
  host_id: string
  host_name: string
  host_avatar_url: string | null
  title: string
  description: string | null
  category: Category
  area: string
  city: string
  meeting_point: string
  date_time: string
  spots_needed: number
  spots_filled: number
  status: TaskStatus
  fill_mode: 'review'
  is_sponsored: boolean
  sponsor_name: string | null
  sponsored_until: string | null
  created_at: string
}

export interface JoinRequest {
  id: string
  task_id: string
  requester_id: string
  requester_name: string
  requester_avatar_url: string | null
  message: string | null
  status: JoinStatus
  created_at: string
}

export interface Message {
  id: string
  task_id: string
  sender_id: string
  sender_name: string
  sender_avatar_url: string | null
  body: string
  type: 'text' | 'image' | 'audio'
  url: string | null
  duration: number | null
  reply_to_message_id?: string | null
  reply_to_sender_id?: string | null
  reply_to_sender_name?: string | null
  reply_to_preview?: string | null
  deleted_at?: string | null
  /** Client-only: media is still uploading; the bubble shows a spinner. */
  pending?: boolean
  created_at: string
}

export interface Review {
  id: string
  task_id: string
  reviewer_id: string
  reviewee_id: string
  rating: number
  comment: string | null
  created_at: string
}

export interface ChatSystemEvent {
  id: string
  task_id: string
  event_type: 'joined' | 'left' | 'on_my_way' | 'arrived' | 'completed' | 'recap'
  actor_id: string | null
  actor_name: string
  body: string | null
  created_at: string
}

export interface ProfileMedia {
  id: string
  profile_id: string
  storage_path: string
  media_type: 'image' | 'video'
  created_at: string
}

export type ViolationCategory =
  | 'harassment'
  | 'no_show'
  | 'fake_profile'
  | 'scam'
  | 'inappropriate'
  | 'spam'
  | 'illegal_content'
  | 'minor_safety'
  | 'ban_evasion'
  | 'other'

export type ViolationSeverity =
  | 'warning'
  | 'suspension_24h'
  | 'suspension_7d'
  | 'suspension_30d'
  | 'permanent_ban'

export type ViolationStatus = 'pending' | 'reviewed' | 'resolved' | 'appealed'

export interface Violation {
  id: string
  user_id: string
  reported_by: string | null
  reported_task_id: string | null
  category: ViolationCategory
  severity: ViolationSeverity
  status: ViolationStatus
  description: string
  action_taken: string | null
  banned_until: string | null
  warning_acknowledged: boolean
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface ViolationAppeal {
  id: string
  violation_id: string
  user_id: string
  appeal_reason: string
  status: 'pending' | 'granted' | 'denied'
  admin_response: string | null
  created_at: string
  reviewed_at: string | null
}

export const VIOLATION_CATEGORIES: { value: ViolationCategory; label: string }[] = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'no_show', label: "Didn't show up" },
  { value: 'fake_profile', label: 'Fake profile' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'inappropriate', label: 'Inappropriate behaviour' },
  { value: 'spam', label: 'Spam' },
  { value: 'illegal_content', label: 'Illegal content' },
  { value: 'minor_safety', label: 'Minor safety concern' },
  { value: 'ban_evasion', label: 'Ban evasion' },
  { value: 'other', label: 'Something else' },
]

export type ReportCategory =
  | 'harassment'
  | 'no_show'
  | 'fake_profile'
  | 'scam'
  | 'inappropriate'
  | 'feedback'
  | 'other'

export const REPORT_CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'no_show', label: "Didn't show up" },
  { value: 'fake_profile', label: 'Fake profile' },
  { value: 'scam', label: 'Scam' },
  { value: 'inappropriate', label: 'Inappropriate behaviour' },
  { value: 'feedback', label: 'Feedback about the app' },
  { value: 'other', label: 'Something else' },
]

/** Derived from completed task count — never stored. */
export function trustLevel(completed: number): string {
  if (completed >= 10) return 'Trusted'
  if (completed >= 3) return 'Regular'
  if (completed >= 1) return 'Explorer'
  return 'Newcomer'
}
