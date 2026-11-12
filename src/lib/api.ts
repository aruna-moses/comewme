import { supabase } from './supabase'
import type {
  Category,
  JoinRequest,
  Message,
  Profile,
  ReportCategory,
  Review,
  Task,
  Violation,
  ViolationAppeal,
  ViolationCategory,
  ViolationSeverity,
} from '../types'
import { toError } from './errors'

/* ------------------------------------------------------------------ */
/* Feed                                                                */
/* ------------------------------------------------------------------ */

const TASK_COLUMNS = `
  id, host_id, host_name, host_avatar_url, title, description, category,
  area, city, meeting_point, date_time, spots_needed, spots_filled, status,
  fill_mode, is_sponsored, sponsor_name, sponsored_until, created_at
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
  if (error) throw toError(error)

  const rows = (data ?? []) as unknown as Task[]
  // Stable partition: live sponsors first, then everything else in date order.
  const sponsored = rows.filter(isLiveSponsor)
  const rest = rows.filter((t) => !isLiveSponsor(t))
  return [...sponsored, ...rest]
}

export async function fetchTask(id: string): Promise<Task | null> {
  const { data, error } = await supabase.from('tasks').select(TASK_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw toError(error)
  return (data as unknown as Task) ?? null
}

/** Activities in Lagos tomorrow, shown as a day-before reminder on Discover. */
export async function fetchUpcomingForUser(userId: string): Promise<Task[]> {
  const { data: joined, error: joinedError } = await supabase
    .from('join_requests')
    .select('task_id')
    .eq('requester_id', userId)
    .eq('status', 'accepted')
  if (joinedError) throw joinedError

  const ids = (joined ?? []).map((r) => r.task_id as string)
  const lagosOffsetMs = 60 * 60_000
  const lagosNow = new Date(Date.now() + lagosOffsetMs)
  const startOfTomorrow = Date.UTC(
    lagosNow.getUTCFullYear(),
    lagosNow.getUTCMonth(),
    lagosNow.getUTCDate() + 1,
  ) - lagosOffsetMs
  const startOfDayAfterTomorrow = startOfTomorrow + 86_400_000

  let q = supabase
    .from('tasks')
    .select(TASK_COLUMNS)
    .in('status', ['open', 'full'])
    .gte('date_time', new Date(startOfTomorrow).toISOString())
    .lt('date_time', new Date(startOfDayAfterTomorrow).toISOString())

  q = ids.length ? q.or(`host_id.eq.${userId},id.in.(${ids.join(',')})`) : q.eq('host_id', userId)

  const { data, error } = await q.order('date_time', { ascending: true }).limit(20)
  if (error) throw toError(error)
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
    fill_mode: 'review'
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
  if (error) throw toError(error)
  return data as unknown as Task
}

export async function markTaskDone(taskId: string) {
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'completed' })
    .eq('id', taskId)
    .select('id')
    .single()
  if (error) throw toError(error)
}

export async function cancelTask(taskId: string) {
  const { error } = await supabase.from('tasks').update({ status: 'cancelled' }).eq('id', taskId)
  if (error) throw toError(error)
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
  if (error) throw toError(error)
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
  if (error) throw toError(error)
  return (data as JoinRequest) ?? null
}

export async function requestJoin(task: Task, profile: Profile, message: string) {
  const { error } = await supabase.from('join_requests').upsert(
    {
      task_id: task.id,
      requester_id: profile.id,
      requester_name: profile.display_name,
      requester_avatar_url: profile.avatar_url,
      message: message.trim() || null,
      status: 'pending',
    },
    { onConflict: 'task_id,requester_id' },
  )
  if (error) throw toError(error)
}

export async function setJoinStatus(
  requestId: string,
  status: 'accepted' | 'declined' | 'waitlisted',
) {
  const { error } = await supabase.from('join_requests').update({ status }).eq('id', requestId)
  if (error) throw toError(error)
}

export async function withdrawJoin(requestId: string) {
  const { error } = await supabase.from('join_requests').update({ status: 'withdrawn' }).eq('id', requestId)
  if (error) throw toError(error)
}

/** Accepted participants for a task, for the avatar row. RLS limits this to host + requester. */
export async function fetchParticipants(taskId: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase
    .from('join_requests')
    .select('*')
    .eq('task_id', taskId)
    .eq('status', 'accepted')
  if (error) throw toError(error)
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
  if (error) throw toError(error)
  return resolveChatMedia((data ?? []) as Message[])
}

export interface NotificationBadgeCounts {
  pendingApplications: number
  unreadMessages: number
}

export async function fetchNotificationBadgeCounts(): Promise<NotificationBadgeCounts> {
  const { data, error } = await supabase.rpc('get_notification_badge_counts')
  if (error) throw toError(error)
  const row = Array.isArray(data) ? data[0] : data
  return {
    pendingApplications: Number(row?.pending_applications ?? 0),
    unreadMessages: Number(row?.unread_messages ?? 0),
  }
}

export async function fetchChatUnreadCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('get_chat_unread_counts')
  if (error) throw toError(error)
  return Object.fromEntries(
    (data ?? []).map((row: { task_id: string; unread_messages: number }) => [
      row.task_id,
      Number(row.unread_messages),
    ]),
  )
}

export async function markChatRead(taskId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_chat_read', { p_task_id: taskId })
  if (error) throw toError(error)
}

/** Resolve stored private object paths to fresh URLs, retaining support for older URL rows. */
export async function resolveChatMedia(messages: Message[]): Promise<Message[]> {
  const mediaPaths = [...new Set(
    messages
      .filter((message) => (message.type === 'image' || message.type === 'audio') && message.url && !/^https?:\/\//i.test(message.url))
      .map((message) => message.url!),
  )]
  if (mediaPaths.length === 0) return messages

  const { data, error } = await supabase.storage.from('chat-media').createSignedUrls(mediaPaths, 3600)
  if (error) throw toError(error)

  const signedUrls = new Map<string, string>()
  for (const item of data) {
    if (item.error || !item.path || !item.signedUrl) {
      throw new Error(item.error ?? 'Could not load a chat attachment.')
    }
    signedUrls.set(item.path, item.signedUrl)
  }

  return messages.map((message) => ({
    ...message,
    url: message.url ? signedUrls.get(message.url) ?? message.url : null,
  }))
}

/** Upload an image or audio file and return its durable object path for the message row. */
export async function uploadChatMedia(taskId: string, file: File): Promise<{ path: string }> {
  const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9.]/g, '') : ''
  const path = `tasks/${taskId}/${crypto.randomUUID()}${extension}`
  const contentType = file.type.split(';')[0]
  const { error } = await supabase.storage.from('chat-media').upload(path, file, {
    contentType,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw toError(error)
  return { path }
}

export async function deleteChatMedia(path: string): Promise<void> {
  const { error } = await supabase.storage.from('chat-media').remove([path])
  if (error) throw toError(error)
}

/** Sign a single private chat object path — used to shorten the media send path. */
export async function signChatMedia(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, 3600)
  if (error) throw toError(error)
  return data.signedUrl
}

export interface MessageViewRow {
  message_id: string
  user_id: string
}

/** Views on the given messages that RLS allows us to see (our own, plus our own sent media). */
export async function fetchMessageViews(messageIds: string[]): Promise<MessageViewRow[]> {
  const unique = Array.from(new Set(messageIds.filter(Boolean)))
  if (unique.length === 0) return []
  const { data, error } = await supabase
    .from('message_views')
    .select('message_id, user_id')
    .in('message_id', unique)
  if (error) {
    // Migration 029 may not be applied yet — degrade quietly.
    if (/message_views|does not exist|schema cache/i.test(error.message)) return []
    throw toError(error)
  }
  return (data ?? []) as MessageViewRow[]
}

/** Record that the signed-in member opened a view-once photo. */
export async function markMessageViewed(messageId: string): Promise<void> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return
  const { error } = await supabase
    .from('message_views')
    .insert({ message_id: messageId, user_id: data.user.id })
  if (error && !/duplicate key/i.test(error.message)) throw toError(error)
}

export async function sendMessage(
  taskId: string,
  profile: Profile,
  body: string,
  type: 'text' | 'image' | 'audio' = 'text',
  url: string | null = null,
  duration: number | null = null,
  replyTo: Message | null = null,
  options?: { resolveMedia?: boolean; viewOnce?: boolean },
): Promise<Message> {
  const replyPreview = replyTo
    ? replyTo.type === 'image'
      ? replyTo.body?.trim() || 'Photo'
      : replyTo.type === 'audio'
        ? 'Voice note'
        : replyTo.body.slice(0, 200)
    : null
  const { data, error } = await supabase.from('messages').insert({
    task_id: taskId,
    sender_id: profile.id,
    sender_name: profile.display_name,
    sender_avatar_url: profile.avatar_url,
    body: body.trim(),
    type,
    url,
    duration,
    ...(options?.viewOnce ? { view_once: true } : {}),
    reply_to_message_id: replyTo?.id ?? null,
    reply_to_sender_id: replyTo?.sender_id ?? null,
    reply_to_sender_name: replyTo?.sender_name ?? null,
    reply_to_preview: replyPreview,
  }).select('*').single()
  if (error) throw toError(error)
  if (options?.resolveMedia === false) return data as Message
  const [message] = await resolveChatMedia([data as Message])
  return message
}

export async function deleteMessage(messageId: string, senderId: string): Promise<{
  mediaPath: string | null
  message: Message
}> {
  const { data: existing, error: lookupError } = await supabase
    .from('messages')
    .select('type, url')
    .eq('id', messageId)
    .eq('sender_id', senderId)
    .single()
  if (lookupError) throw lookupError

  const { data: deletedMessage, error } = await supabase
    .from('messages')
    .update({
      body: 'This message was deleted',
      type: 'text',
      url: null,
      duration: null,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .eq('sender_id', senderId)
    .select('*')
    .single()
  if (error) throw toError(error)

  const isStoredMedia = existing.type === 'image' || existing.type === 'audio'
  return {
    mediaPath: isStoredMedia && existing.url && !/^https?:\/\//i.test(existing.url) ? existing.url : null,
    message: deletedMessage as Message,
  }
}

export function subscribeToMessages(
  taskId: string,
  onNew: (m: Message) => void,
  onUpdate?: (m: Message) => void,
) {
  const channel = supabase
    .channel(`messages:${taskId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `task_id=eq.${taskId}` },
      (payload) => onNew(payload.new as Message),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `task_id=eq.${taskId}` },
      (payload) => onUpdate?.(payload.new as Message),
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
  if (error) throw toError(error)
  return (data as Profile) ?? null
}

export async function fetchProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle()
  if (error) throw toError(error)
  return (data as Profile) ?? null
}

export async function updateProfile(id: string, patch: Partial<Profile>) {
  // Note: verification_status, trust_score, tasks_completed and no_shows are
  // overwritten by a database trigger even if you send them. That is deliberate.
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select().single()
  if (error) throw toError(error)
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
  if (error) throw toError(error)
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
  if (error) throw toError(error)
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
  if (error) throw toError(error)
}

/* ------------------------------------------------------------------ */
/* Community guidelines and moderation                                 */
/* ------------------------------------------------------------------ */

export async function hasAcceptedGuidelines(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('guideline_acceptances')
    .select('id')
    .eq('user_id', userId)
    .eq('guideline_version', '1.0')
    .maybeSingle()
  if (error) throw toError(error)
  return Boolean(data)
}

export async function acceptGuidelines(version: string): Promise<void> {
  const { error } = await supabase.rpc('accept_guidelines', {
    p_version: version,
    p_user_agent: navigator.userAgent,
  })
  if (error) throw toError(error)
}

export async function getMyViolations(): Promise<Violation[]> {
  const { data, error } = await supabase
    .from('violations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw toError(error)
  return (data ?? []) as Violation[]
}

export async function submitAppeal(violationId: string, reason: string): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('Sign in before submitting an appeal.')

  const { error } = await supabase.from('violation_appeals').insert({
    violation_id: violationId,
    user_id: userData.user.id,
    appeal_reason: reason.trim(),
  })
  if (error) throw toError(error)
}

export async function getMyViolationAppeals(): Promise<ViolationAppeal[]> {
  const { data, error } = await supabase
    .from('violation_appeals')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw toError(error)
  return (data ?? []) as ViolationAppeal[]
}

export async function reportViolation(input: {
  reportedUserId: string
  category: ViolationCategory
  description: string
  taskId?: string | null
}): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('Sign in before sending a report.')
  if (input.reportedUserId === userData.user.id) throw new Error('You cannot report your own account.')

  const { error } = await supabase.from('violations').insert({
    user_id: input.reportedUserId,
    reported_by: userData.user.id,
    reported_task_id: input.taskId ?? null,
    category: input.category,
    description: input.description.trim(),
  })
  if (error) throw toError(error)
}

export async function isModerator(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_moderator')
  if (error) throw toError(error)
  return Boolean(data)
}

export async function getPendingReports(): Promise<Violation[]> {
  const { data, error } = await supabase.rpc('list_pending_reports')
  if (error) throw toError(error)
  return (data ?? []) as Violation[]
}

export async function getPendingViolationAppeals() {
  const { data, error } = await supabase.rpc('list_pending_violation_appeals')
  if (error) throw toError(error)
  return (data ?? []) as Array<{
    id: string
    violation_id: string
    user_id: string
    appeal_reason: string
    created_at: string
    violation_category: ViolationCategory
    violation_description: string
    violation_severity: ViolationSeverity
  }>
}

export async function reviewViolation(
  violationId: string,
  severity: ViolationSeverity,
  actionTaken: string,
): Promise<void> {
  const { error } = await supabase.rpc('review_violation', {
    p_violation_id: violationId,
    p_severity: severity,
    p_action_taken: actionTaken,
  })
  if (error) throw toError(error)
}

export async function dismissViolation(violationId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('dismiss_violation', {
    p_violation_id: violationId,
    p_action_taken: reason,
  })
  if (error) throw toError(error)
}

export async function reviewViolationAppeal(
  appealId: string,
  status: 'granted' | 'denied',
  adminResponse: string,
): Promise<void> {
  const { error } = await supabase.rpc('review_violation_appeal', {
    p_appeal_id: appealId,
    p_status: status,
    p_admin_response: adminResponse,
  })
  if (error) throw toError(error)
}

export async function acknowledgeViolationWarning(violationId: string): Promise<void> {
  const { error } = await supabase.rpc('acknowledge_violation_warning', {
    p_violation_id: violationId,
  })
  if (error) throw toError(error)
}

/* ------------------------------------------------------------------ */
/* System events (joins/leaves/arrivals) and check-ins                       */
/* ------------------------------------------------------------------ */

export interface ChatSystemEvent {
  id: string
  task_id: string
  event_type: 'joined' | 'left' | 'on_my_way' | 'arrived' | 'completed' | 'recap'
  actor_id: string | null
  actor_name: string
  body: string | null
  created_at: string
}

export async function fetchSystemEvents(taskId: string): Promise<ChatSystemEvent[]> {
  const { data, error } = await supabase
    .from('activity_system_events')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) throw toError(error)
  return (data ?? []) as ChatSystemEvent[]
}

export async function checkInToActivity(taskId: string, _profile: { id: string; display_name: string }) {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) throw new Error('Sign in first.')

  const { error: checkInError } = await supabase
    .from('activity_checkins')
    .upsert({ task_id: taskId, user_id: u.user.id }, { onConflict: 'task_id,user_id' })
  if (checkInError) throw checkInError

  const { error: eventError } = await supabase
    .from('activity_system_events')
    .insert({ task_id: taskId, event_type: 'arrived', actor_id: u.user.id, actor_name: u.user.user_metadata?.display_name ?? (u.user.email ?? 'Someone') })
  if (eventError) throw eventError
}

export async function fetchCheckins(taskId: string): Promise<Array<{ user_id: string; checked_in_at: string }>> {
  const { data, error } = await supabase
    .from('activity_checkins')
    .select('user_id, checked_in_at')
    .eq('task_id', taskId)
  if (error) throw toError(error)
  return (data ?? []) as Array<{ user_id: string; checked_in_at: string }>
}

/* ------------------------------------------------------------------ */
/* Recap                                                                */
/* ------------------------------------------------------------------ */

export async function writeRecap(taskId: string, hostId: string, hostName: string, body: string) {
  const { error } = await supabase
    .from('activity_recaps')
    .upsert({ task_id: taskId, host_id: hostId, host_name: hostName, body }, { onConflict: 'task_id' })
  if (error) throw toError(error)

  // Broadcast the recap as a system event so it shows in the chat timeline.
  const { error: eventError } = await supabase
    .from('activity_system_events')
    .insert({ task_id: taskId, event_type: 'recap', actor_id: hostId, actor_name: hostName, body })
  if (eventError) throw eventError
}

export async function fetchRecap(taskId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('activity_recaps')
    .select('body')
    .eq('task_id', taskId)
    .maybeSingle()
  if (error) return null
  const row = data as { body: string } | null
  return row?.body ?? null
}

/* Message reactions                                                     */

export interface MessageReaction {
  message_id: string
  user_id: string
  emoji: string
}

export async function fetchMessageReactions(messageIds: string[]): Promise<MessageReaction[]> {
  const unique = Array.from(new Set(messageIds.filter(Boolean)))
  if (unique.length === 0) return []
  const { data, error } = await supabase
    .from('message_reactions')
    .select('message_id, user_id, emoji')
    .in('message_id', unique)
  if (error) throw toError(error)
  return (data ?? []) as MessageReaction[]
}

export async function toggleMessageReaction(messageId: string, emoji: string): Promise<'added' | 'removed'> {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) throw new Error('Sign in before reacting.')
  const existing = await supabase
    .from('message_reactions')
    .select('message_id')
    .eq('message_id', messageId)
    .eq('user_id', u.user.id)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing.data) {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', u.user.id)
      .eq('emoji', emoji)
    if (error) throw toError(error)
    return 'removed'
  }

  const { error } = await supabase
    .from('message_reactions')
    .upsert({ message_id: messageId, user_id: u.user.id, emoji }, { onConflict: 'message_id,user_id' })
  if (error) throw toError(error)
  return 'added'
}

/* Verification status batch fetch                                    */
/* ------------------------------------------------------------------ */

export async function fetchVerificationStatuses(
  ids: string[],
): Promise<Record<string, 'unverified' | 'pending' | 'verified'>> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (unique.length === 0) return {}
  const { data, error } = await supabase
    .from('profiles')
    .select('id, verification_status')
    .in('id', unique)
  if (error) return {}
  const map: Record<string, 'unverified' | 'pending' | 'verified'> = {}
  for (const row of data ?? []) {
    map[(row as { id: string; verification_status: 'unverified' | 'pending' | 'verified' }).id] =
      (row as { verification_status: 'unverified' | 'pending' | 'verified' }).verification_status
  }
  return map
}

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
  if (error) throw toError(error)
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
