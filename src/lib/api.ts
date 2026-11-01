import { supabase } from './supabase'
import type {
  Category,
  JoinRequest,
  Message,
  Profile,
  ReportCategory,
  Review,
  Task,
} from '../types'

/* ------------------------------------------------------------------ */
/* Feed                                                                */
/* ------------------------------------------------------------------ */

const TASK_COLUMNS = `
  id, host_id, host_name, host_avatar_url, title, description, category,
  area, city, meeting_point, date_time, spots_needed, spots_filled, status,
  is_sponsored, sponsor_name, sponsored_until, created_at
`

const isLiveSponsor = (t: Task) =>
  t.is_sponsored && (!t.sponsored_until || new Date(t.sponsored_until) >= new Date(new Date().toDateString()))

export interface FeedParams {
  category?: Category | 'all'
  area?: string | 'all'
  forYou?: Category[] | null
  search?: string | null
  limit?: number
  offset?: number
}

/**
 * One round trip for the whole feed. No per-card profile lookups — host_name and
 * host_avatar_url are already denormalised onto the row.
 */
export async function fetchFeed({
  category = 'all',
  area = 'all',
  forYou = null,
  search = null,
  limit = 20,
  offset = 0,
}: FeedParams): Promise<Task[]> {
  let q = supabase
    .from('tasks')
    .select(TASK_COLUMNS)
    .in('status', ['open', 'full'])
    .gte('date_time', new Date(Date.now() - 6 * 3600_000).toISOString())
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (category !== 'all') q = q.eq('category', category)
  if (area !== 'all') q = q.eq('area', area)
  if (forYou && forYou.length > 0) q = q.in('category', forYou)
  if (search && search.trim().length > 0) {
    q = q.or(`title.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%,area.ilike.%${search.trim()}%`)
  }

  const { data, error } = await q
  if (error) throw error

  const rows = (data ?? []) as unknown as Task[]
  // Stable partition: live sponsors first, then everything else in date order.
  const sponsored = rows.filter(isLiveSponsor)
  const rest = rows.filter((t) => !isLiveSponsor(t))
  return [...sponsored, ...rest]
}

export async function fetchTask(id: string): Promise<Task | null> {
  const { data, error } = await supabase.from('tasks').select(TASK_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return (data as unknown as Task) ?? null
}

/** Tasks the user is hosting or accepted for in the next 24 hours, for the reminder banner. */
export async function fetchUpcomingForUser(userId: string): Promise<Task[]> {
  const { data: joined } = await supabase
    .from('join_requests')
    .select('task_id')
    .eq('requester_id', userId)
    .eq('status', 'accepted')

  const ids = (joined ?? []).map((r) => r.task_id as string)
  const now = new Date().toISOString()
  const soon = new Date(Date.now() + 86_400_000).toISOString()

  let q = supabase
    .from('tasks')
    .select(TASK_COLUMNS)
    .in('status', ['open', 'full'])
    .gte('date_time', now)
    .lte('date_time', soon)

  q = ids.length ? q.or(`host_id.eq.${userId},id.in.(${ids.join(',')})`) : q.eq('host_id', userId)

  const { data, error } = await q.order('date_time', { ascending: true }).limit(3)
  if (error) throw error
  return (data ?? []) as unknown as Task[]
}

export async function createTask(
  input: {
    title: string
    description: string
    category: Category
    area: string
    meeting_point: string
    date_time: string
    spots_needed: number
    fill_mode: 'review' | 'first_come'
  },
  profile: Profile,
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      ...input,
      host_id: profile.id,
      host_name: profile.display_name,
      host_avatar_url: profile.avatar_url,
      city: profile.city || 'Lagos',
    })
    .select(TASK_COLUMNS)
    .single()
  if (error) throw error
  return data as unknown as Task
}

export async function markTaskDone(taskId: string) {
  const { error } = await supabase.from('tasks').update({ status: 'completed' }).eq('id', taskId)
  if (error) throw error
}

export async function cancelTask(taskId: string) {
  const { error } = await supabase.from('tasks').update({ status: 'cancelled' }).eq('id', taskId)
  if (error) throw error
}

/* ------------------------------------------------------------------ */
/* Join requests                                                       */
/* ------------------------------------------------------------------ */

export async function fetchJoinRequests(taskId: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase
    .from('join_requests')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as JoinRequest[]
}

export async function fetchMyJoinRequest(
  taskId: string,
  userId: string,
): Promise<JoinRequest | null> {
  const { data, error } = await supabase
    .from('join_requests')
    .select('*')
    .eq('task_id', taskId)
    .eq('requester_id', userId)
    .neq('status', 'withdrawn')
    .maybeSingle()
  if (error) throw error
  return (data as JoinRequest) ?? null
}

export async function requestJoin(task: Task, profile: Profile, message: string) {
  const { error } = await supabase.from('join_requests').insert({
    task_id: task.id,
    requester_id: profile.id,
    requester_name: profile.display_name,
    requester_avatar_url: profile.avatar_url,
    message: message.trim() || null,
    status: task.fill_mode === 'first_come' ? 'accepted' : 'pending',
  })
  if (error) throw error
}

/** Claim a spot immediately in First Come, First Served mode. */
export async function claimSpot(taskId: string, profile: Profile) {
  const { data: task } = await supabase
    .from('tasks')
    .select('fill_mode, status, spots_needed, spots_filled')
    .eq('id', taskId)
    .single()
  if (!task || task.fill_mode !== 'first_come' || task.status !== 'open') {
    throw new Error('This spot is no longer available.')
  }

  const { error } = await supabase.from('join_requests').insert({
    task_id: taskId,
    requester_id: profile.id,
    requester_name: profile.display_name,
    requester_avatar_url: profile.avatar_url,
    message: null,
    status: 'accepted',
  })
  if (error) throw error
}

export async function setJoinStatus(requestId: string, status: 'accepted' | 'declined') {
  const { error } = await supabase.from('join_requests').update({ status }).eq('id', requestId)
  if (error) throw error
}

export async function withdrawJoin(requestId: string) {
  const { error } = await supabase.from('join_requests').update({ status: 'withdrawn' }).eq('id', requestId)
  if (error) throw error
}

/** Accepted participants for a task, for the avatar row. RLS limits this to host + requester. */
export async function fetchParticipants(taskId: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase
    .from('join_requests')
    .select('*')
    .eq('task_id', taskId)
    .eq('status', 'accepted')
  if (error) throw error
  return (data ?? []) as JoinRequest[]
}

/* ------------------------------------------------------------------ */
/* Chat — RLS guarantees only participants can read these rows          */
/* ------------------------------------------------------------------ */

export async function fetchMessages(taskId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  return (data ?? []) as Message[]
}

/** Upload an image or audio file to the private chat-media bucket and return a signed URL. */
export async function uploadChatMedia(taskId: string, file: File): Promise<{ path: string; signedUrl: string }> {
  const safeName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')
  const path = `tasks/${taskId}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from('chat-media').upload(path, file)
  if (error) throw error
  const { data, error: signedError } = await supabase.storage.from('chat-media').createSignedUrl(path, 3600)
  if (signedError || !data?.signedUrl) throw signedError ?? new Error('Could not create media URL')
  return { path, signedUrl: data.signedUrl }
}

export async function sendMessage(
  taskId: string,
  profile: Profile,
  body: string,
  type: 'text' | 'image' | 'audio' = 'text',
  url: string | null = null,
  duration: number | null = null,
) {
  const { error } = await supabase.from('messages').insert({
    task_id: taskId,
    sender_id: profile.id,
    sender_name: profile.display_name,
    sender_avatar_url: profile.avatar_url,
    body: body.trim(),
    type,
    url,
    duration,
  })
  if (error) throw error
}

export function subscribeToMessages(taskId: string, onNew: (m: Message) => void) {
  const channel = supabase
    .channel(`messages:${taskId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `task_id=eq.${taskId}` },
      (payload) => onNew(payload.new as Message),
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Profile) ?? null
}

export async function fetchProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle()
  if (error) throw error
  return (data as Profile) ?? null
}

export async function updateProfile(id: string, patch: Partial<Profile>) {
  // Note: verification_status, trust_score, tasks_completed and no_shows are
  // overwritten by a database trigger even if you send them. That is deliberate.
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as Profile
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  // profiles are publicly readable, so this is a cheap direct check.
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username.trim().toLowerCase())
    .maybeSingle()
  return Boolean(data)
}

/* ------------------------------------------------------------------ */
/* Reviews and reports                                                 */
/* ------------------------------------------------------------------ */

export async function fetchReviews(revieweeId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('reviewee_id', revieweeId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as Review[]
}

export async function createReview(input: {
  task_id: string
  reviewer_id: string
  reviewee_id: string
  rating: number
  comment: string
}) {
  const { error } = await supabase.from('reviews').insert(input)
  if (error) throw error
}

export async function submitReport(input: {
  reporter_id: string
  category: ReportCategory
  details: string
  task_id?: string | null
  reported_user_id?: string | null
}) {
  const { error } = await supabase.from('reports').insert({
    ...input,
    task_id: input.task_id ?? null,
    reported_user_id: input.reported_user_id ?? null,
  })
  if (error) throw error
}

/* ------------------------------------------------------------------ */
/* Verification                                                        */
/* ------------------------------------------------------------------ */

export async function submitVerification(userId: string, file: File) {
  const path = `${userId}/selfie-${Date.now()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from('verifications')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError

  const { error } = await supabase
    .from('verifications')
    .insert({ user_id: userId, selfie_url: path, status: 'pending' })
  if (error) throw error
}

/**
 * The owner can read their own submission (RLS), nobody else's.
 * `profiles.verification_status` is admin-controlled and cannot be set by the
 * user, so this row is the honest source of "have I sent one yet".
 */
export async function fetchMyVerification(userId: string) {
  const { data, error } = await supabase
    .from('verifications')
    .select('id, status, created_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return null
  return data as { id: string; status: 'pending' | 'approved' | 'rejected'; created_at: string } | null
}
