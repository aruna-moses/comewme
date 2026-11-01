export type Category =
  | 'market_run'
  | 'ride'
  | 'food'
  | 'study'
  | 'dev'
  | 'event'
  | 'errands'
  | 'other'

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'market_run', label: 'Market run' },
  { value: 'ride', label: 'Ride' },
  { value: 'food', label: 'Food' },
  { value: 'study', label: 'Study' },
  { value: 'dev', label: 'Dev' },
  { value: 'event', label: 'Event' },
  { value: 'errands', label: 'Errands' },
  { value: 'other', label: 'Other' },
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
export type JoinStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn'

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
