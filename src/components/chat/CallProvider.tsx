import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { startRinging, stopRinging } from '../../lib/callRing'
import {
  createCallRoom,
  fetchCallSession,
  insertCallSession,
  notifyMembersOfCall,
  updateCallSession,
  type CallSession,
  type CallType,
} from '../../lib/calls'
import CallOverlay from './CallOverlay'

type CallsContext = { startCall: (chatId: string, callType: CallType) => Promise<void> }
const Context = createContext<CallsContext | null>(null)

export function useCalls(): CallsContext {
  const value = useContext(Context)
  if (!value) throw new Error('useCalls must be used inside CallProvider')
  return value
}

type WakeLockLike = { release: () => Promise<void> }
const wakeLockOf = () =>
  (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockLike> } }).wakeLock

const RING_SECONDS = 60
const INCOMING_KEY = 'comewme:incoming-call'
const persistIncoming = (session: CallSession | null) => {
  try {
    if (session) sessionStorage.setItem(INCOMING_KEY, JSON.stringify({ id: session.id, at: Date.now() }))
    else sessionStorage.removeItem(INCOMING_KEY)
  } catch { /* storage blocked — banner still works while mounted */ }
}

export default function CallProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [incoming, setIncoming] = useState<CallSession | null>(null)
  const [active, setActive] = useState<CallSession | null>(null)
  const [callerName, setCallerName] = useState('Someone')
  const [ringSeconds, setRingSeconds] = useState(RING_SECONDS)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wakeRef = useRef<WakeLockLike | null>(null)
  const activeRef = useRef<CallSession | null>(null)
  const finishingRef = useRef(false)
  activeRef.current = active

  const clearJoinParam = useCallback(() => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has('joinCall')) {
        url.searchParams.delete('joinCall')
        window.history.replaceState({}, '', url.toString())
      }
    } catch { /* ignore */ }
  }, [])

  const showIncoming = useCallback((session: CallSession) => {
    void import('./LiveCall') // warm the call chunk so Accept feels instant
    setIncoming(session)
    persistIncoming(session)
    void supabase
      .from('profiles')
      .select('display_name')
      .eq('id', session.caller_id)
      .maybeSingle()
      .then(({ data }) => setCallerName(data?.display_name ?? 'Someone'))
  }, [])

  // A call keeps ringing until answered/declined or the 60s timeout expires.
  useEffect(() => {
    if (!incoming) {
      stopRinging()
      return
    }
    startRinging()
    const started = Date.now()
    setRingSeconds(RING_SECONDS)
    const tick = window.setInterval(() => {
      setRingSeconds(Math.max(0, RING_SECONDS - Math.floor((Date.now() - started) / 1000)))
    }, 1000)
    const timeout = window.setTimeout(() => {
      updateCallSession(incoming.id, 'missed').catch(() => undefined)
      setIncoming(null)
      persistIncoming(null)
    }, RING_SECONDS * 1000)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(timeout)
      stopRinging()
    }
  }, [incoming?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Error banners auto-dismiss so nothing sits over the app indefinitely.
  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(null), 8000)
    return () => window.clearTimeout(timer)
  }, [error])

  const finishCall = useCallback(async (sessionId?: string) => {
    if (finishingRef.current) return
    finishingRef.current = true
    try { await wakeRef.current?.release() } catch { /* released by system */ }
    wakeRef.current = null
    const id = sessionId ?? activeRef.current?.id
    if (id) updateCallSession(id, 'ended').catch(() => undefined)
    setActive(null)
    setIncoming(null)
    persistIncoming(null)
    clearJoinParam()
    finishingRef.current = false
  }, [clearJoinParam])

  // Mounting the iframe is instantaneous — no server call, no room key, no payment method.
  const joinSession = useCallback(async (session: CallSession) => {
    try {
      wakeRef.current = await wakeLockOf()?.request('screen') ?? null
    } catch { /* wake lock is best effort */ }
    updateCallSession(session.id, 'active').catch(() => undefined)
    setActive(session)
  }, [])

  const startCall = useCallback(async (chatId: string, callType: CallType) => {
    if (!profile) return
    if (active || incoming) {
      setError('You already have a call in progress.')
      return
    }
    setError(null)
    // iOS PWA: ask for mic/camera right inside the tap, before any network await.
    let primed: MediaStream | null = null
    try {
      primed = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' })
    } catch {
      setError('Allow microphone access in your browser settings to start a call.')
      return
    }
    setJoining(true)
    try {
      const room = createCallRoom()
      const session = await insertCallSession({
        chatId, callerId: profile.id, callType, url: room.roomName, token: '',
      })
      await notifyMembersOfCall({
        chatId,
        callerId: profile.id,
        callerName: profile.display_name ?? 'Someone',
        sessionId: session.id,
        callType,
      })
      await joinSession(session)
      primed?.getTracks().forEach((track) => track.stop())
    } catch (e) {
      primed?.getTracks().forEach((track) => track.stop())
      setError(`Could not start the call: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`)
    } finally {
      setJoining(false)
    }
  }, [profile, active, incoming, joinSession])

  // Incoming signaling — RLS ensures only activity members receive these rows.
  useEffect(() => {
    if (!profile?.id) return
    let alive = true
    const channel = supabase
      .channel(`calls:${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_sessions' }, (payload) => {
        const session = payload.new as CallSession
        if (!alive || session.caller_id === profile.id) return
        if (activeRef.current || incoming) {
          updateCallSession(session.id, 'missed').catch(() => undefined)
          return
        }
        showIncoming(session)
      })
      .subscribe()

    // restore a ring that was live before a reload / push-tap remount
    try {
      const saved = JSON.parse(sessionStorage.getItem(INCOMING_KEY) ?? 'null') as { id?: string; at?: number } | null
      if (saved?.id && saved.at && Date.now() - saved.at < RING_SECONDS * 1000) {
        void fetchCallSession(saved.id).then((session) => {
          if (alive && session && session.caller_id !== profile.id && ['ringing', 'active'].includes(session.status)) {
            showIncoming(session)
          } else if (alive) persistIncoming(null)
        })
      }
    } catch { /* ignore malformed storage */ }

    const sessionId = new URL(window.location.href).searchParams.get('joinCall')
    if (sessionId) {
      void fetchCallSession(sessionId).then((session) => {
        if (alive && session && session.caller_id !== profile.id && ['ringing', 'active'].includes(session.status)) {
          showIncoming(session)
        }
      })
    }

    return () => {
      alive = false
      void supabase.removeChannel(channel)
    }
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const accept = useCallback(() => {
    if (!incoming) return
    const session = incoming
    setIncoming(null)
    persistIncoming(null)
    void joinSession(session).catch((e) => setError(`Could not join the call: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`))
  }, [incoming, joinSession])

  const decline = useCallback(() => {
    if (!incoming) return
    updateCallSession(incoming.id, 'missed').catch(() => undefined)
    setIncoming(null)
    persistIncoming(null)
    clearJoinParam()
  }, [incoming, clearJoinParam])

  useEffect(() => () => {
    wakeRef.current?.release().catch(() => undefined)
  }, [])

  return (
    <Context.Provider value={{ startCall }}>
      {children}
      <CallOverlay
        incoming={incoming}
        callerName={callerName}
        ringSeconds={ringSeconds}
        active={active}
        error={error}
        joining={joining}
        onAccept={accept}
        onDecline={decline}
        onLeave={() => { void finishCall() }}
        onDismissError={() => setError(null)}
      />
    </Context.Provider>
  )
}
