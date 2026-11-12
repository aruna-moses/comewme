import { supabase } from './supabase'
import { fetchVerificationStatuses } from './api'
import { toError } from './errors'
import type { JoinStatus, Task } from '../types'

export interface MyTasksBundle {
  hosted: Task[]
  joined: Task[]
  statuses: Record<string, JoinStatus>
  verifiedMap: Record<string, 'unverified' | 'pending' | 'verified'>
  pendingApplicants: Record<string, number>
}

export async function loadMyTasksForUser(profileId: string): Promise<MyTasksBundle> {
  const [hostRes, joinRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('host_id', profileId)
      .order('date_time', { ascending: false }),
    supabase
      .from('join_requests')
      .select('task_id, status')
      .eq('requester_id', profileId)
      .neq('status', 'withdrawn'),
  ])
  if (hostRes.error) throw toError(hostRes.error)
  if (joinRes.error) throw toError(joinRes.error)

  const hosted = (hostRes.data ?? []) as Task[]

  // Verification map — own hosted tasks plus hosts of joined activities.
  const ownHostIds = Array.from(new Set(hosted.map((t) => t.host_id)))
  const hostMap = ownHostIds.length > 0
    ? await fetchVerificationStatuses(ownHostIds)
    : ({} as Record<string, 'unverified' | 'pending' | 'verified'>)

  const hostIds = hosted.map((task) => task.id)
  const pendingApplicants: Record<string, number> = {}
  if (hostIds.length > 0) {
    const { data: applicants, error } = await supabase
      .from('join_requests')
      .select('task_id')
      .in('task_id', hostIds)
      .eq('status', 'pending')
    if (error) throw toError(error)
    for (const applicant of applicants ?? []) {
      pendingApplicants[applicant.task_id] = (pendingApplicants[applicant.task_id] ?? 0) + 1
    }
  }

  const applications = joinRes.data ?? []
  const statuses = Object.fromEntries(
    applications.map((request) => [request.task_id, request.status as JoinStatus]),
  )
  const uniqueIds = [...new Set(applications.map((a) => a.task_id))]

  let joined: Task[] = []
  let verifiedMap = { ...hostMap }
  if (uniqueIds.length > 0) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .in('id', uniqueIds)
      .order('date_time', { ascending: false })
    if (error) throw toError(error)
    joined = (data ?? []) as Task[]
    const joinedHostIds = Array.from(new Set(joined.map((t) => t.host_id)))
    const joinedVerified = joinedHostIds.length > 0
      ? await fetchVerificationStatuses(joinedHostIds)
      : ({} as Record<string, 'unverified' | 'pending' | 'verified'>)
    verifiedMap = { ...hostMap, ...joinedVerified }
  } else {
    verifiedMap = hostMap
  }

  return { hosted, joined, statuses, verifiedMap, pendingApplicants }
}
