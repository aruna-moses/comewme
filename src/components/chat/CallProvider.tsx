import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { startRinging, stopRinging } from '../../lib/callRing'
import {
  createDailyRoom,
  fetchCallSession,
  insertCallSession,
  notifyMembersOfCall,
  updateCallSession,
  type CallSession,
  type CallType,
} from '../../lib/calls'
import CallOverlay from './CallOverlay'

let dailyModule: Promise<typeof import('@daily-co/daily-js')> | null = null
const getDaily = () => (dailyModule ??= import('@daily-co/daily-js'))

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
  const frameContainerRef: RefObject<HTMLDivElement> = useRef<HTMLDivElement>(null)
  const frameRef = useRef<import('@daily-co/daily-js').DailyCall | null>(null)
  const wakeRef = useRef<WakeLockLike | null>(null)
  const activeRef = useRef<CallSession | null>(null)
  const finishingRef = useRef(false)
  activeRef.current = active

  useEffect(() => {
    void getDaily() // preload the code-split Daily SDK so Accept feels instant
  }, [])

  const clearJoinParam = useCallback(() => {
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has('joinCall')) {
        url.searchParams.delete('joinCall')
        window.history.replaceState({}, '', url.toString())
      }
    } catch {
      // ignore
    }
  }, [])

  const showIncoming = useCallback((session: CallSession) => {
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

  const finishCall = useCallback(async (sessionId?: string) => {
    if (finishingRef.current) return
    finishingRef.current = true
    try { await frameRef.current?.leave() } catch { /* already left */ }
    try { await frameRef.current?.destroy() } catch { /* already destroyed */ }
    frameRef.current = null
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

  const joinSession = useCallback(async (session: CallSession) => {
    const container = frameContainerRef.current
    if (!container) throw new Error('Call surface not ready')
    const Daily = await getDaily()
    if (frameRef.current) {
      try { await frameRef.current.destroy() } catch { /* ignore */ }
    }
    const frame = Daily.default.createFrame(container, {
      iframeStyle: {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        border: 'none',
        zIndex: '9998',
      } as Partial<CSSStyleDeclaration>,
    })
    frameRef.current = frame
    frame.on('left-meeting', () => { void finishCall(session.id) })
    await frame.join({ url: session.room_url, token: session.room_token })
    try {
      wakeRef.current = await wakeLockOf()?.request('screen') ?? null
    } catch {
      // wake lock is best effort (not supported on every browser)
    }
    updateCallSession(session.id, 'active').catch(() => undefined)
  }, [finishCall])

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
      primed = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      })
    } catch {
      setError('Allow microphone access in your browser settings to start a call.')
      return
    }
    setJoining(true)
    try {
      const room = await createDailyRoom(chatId, callType)
      const session = await insertCallSession({
        chatId,
        callerId: profile.id,
        callType,
        url: room.url,
        token: room.token,
      })
      await notifyMembersOfCall({
        chatId,
        callerId: profile.id,
        callerName: profile.display_name ?? 'Someone',
        sessionId: session.id,
        callType,
      })
      await joinSession(session)
      setActive(session)
      primed?.getTracks().forEach((track) => track.stop())
    } catch (e) {
      primed?.getTracks().forEach((track) => track.stop())
      setError(friendlyError(e, 'Could not start the call. Please try again.'))
    } finally {
      setJoining(false)
    }
  }, [profile, active, incoming, joinSession])

  // incoming signaling — RLS ensures only activity members receive these rows
  useEffect(() => {
    if (!profile?.id) return
    let alive = true
    const channel = supabase
      .channel(`calls:${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_sessions' },
        (payload) => {
          const session = payload.new as CallSession
          if (!alive || session.caller_id === profile.id) return
          if (activeRef.current || incoming) {
            updateCallSession(session.id, 'missed').catch(() => undefined)
            return
          }
          showIncoming(session)
        },
      )
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
    } catch {
      // ignore malformed storage
    }

    // opened from a call push notification
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
    // join starts in the Accept tap — iOS keeps the media permission gesture.
    void joinSession(session)
      .then(() => { setActive(session); clearJoinParam() })
      .catch((e) => setError(friendlyError(e, 'Could not join the call.')))
  }, [incoming, joinSession, clearJoinParam])

  const decline = useCallback(() => {
    if (!incoming) return
    updateCallSession(incoming.id, 'missed').catch(() => undefined)
    setIncoming(null)
    persistIncoming(null)
    clearJoinParam()
  }, [incoming, clearJoinParam])

  useEffect(() => () => {
    frameRef.current?.destroy().catch(() => undefined)
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
        frameContainerRef={frameContainerRef}
        onAccept={accept}
        onDecline={decline}
        onLeave={() => { void finishCall() }}
      />
    </Context.Provider>
  )
}
