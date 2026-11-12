import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { clearAllDrafts } from '../lib/drafts'
import {
  acceptGuidelines as saveGuidelinesAcceptance,
  acknowledgeViolationWarning,
  fetchProfile,
  getMyViolations,
  hasAcceptedGuidelines,
} from '../lib/api'
import type { Profile, Violation } from '../types'
import { toError } from '../lib/errors'

const GOOGLE_GUIDELINES_CONSENT_KEY = 'comewme:google-guidelines-consent'
const GOOGLE_GUIDELINES_CONSENT_MAX_AGE = 10 * 60 * 1000

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  guidelineAccepted: boolean
  violations: Violation[]
  complianceError: string | null
  needsOnboarding: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, returnTo?: string) => Promise<{ needsConfirmation: boolean }>
  signInWithGoogle: (returnTo?: string) => Promise<void>
  signInWithPhone: (phone: string) => Promise<void>
  verifyPhoneOtp: (phone: string, token: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshCompliance: () => Promise<void>
  acceptGuidelines: () => Promise<void>
  acknowledgeWarning: (violationId: string) => Promise<void>
  completeOnboarding: (profile: Profile) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [guidelineAccepted, setGuidelineAccepted] = useState(false)
  const [violations, setViolations] = useState<Violation[]>([])
  const [complianceError, setComplianceError] = useState<string | null>(null)

  async function loadUserState(userId: string) {
    try {
      setComplianceError(null)
      const consentTimestamp = Number(sessionStorage.getItem(GOOGLE_GUIDELINES_CONSENT_KEY))
      const hasRecentGoogleConsent =
        Number.isFinite(consentTimestamp)
        && consentTimestamp > 0
        && Date.now() - consentTimestamp < GOOGLE_GUIDELINES_CONSENT_MAX_AGE
      if (hasRecentGoogleConsent) {
        await saveGuidelinesAcceptance('1.0')
        sessionStorage.removeItem(GOOGLE_GUIDELINES_CONSENT_KEY)
      } else if (consentTimestamp) {
        sessionStorage.removeItem(GOOGLE_GUIDELINES_CONSENT_KEY)
      }

      const [p, accepted, userViolations] = await Promise.all([
        fetchProfile(userId),
        hasAcceptedGuidelines(userId),
        getMyViolations(),
      ])
      setProfile(p)
      setGuidelineAccepted(accepted)
      setViolations(userViolations)
    } catch {
      setComplianceError('We could not verify your account status. Please try again before continuing.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshCompliance() {
    if (session?.user.id) {
      setLoading(true)
      await loadUserState(session.user.id)
    }
  }

  async function refreshAuthenticatedUserState() {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw toError(error)
    if (!data.user) throw new Error('Your sign-in could not be verified. Please try again.')
    setLoading(true)
    await loadUserState(data.user.id)
  }

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      if (data.session?.user.id) {
        void loadUserState(data.session.user.id).finally(() => !cancelled && setLoading(false))
      } else {
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setComplianceError('We could not verify your sign-in. Please refresh and try again.')
        setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next?.user.id) {
        setLoading(true)
        void loadUserState(next.user.id)
      } else {
        setProfile(null)
        setGuidelineAccepted(false)
        setViolations([])
        setComplianceError(null)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      guidelineAccepted,
      violations,
      complianceError,
      needsOnboarding: Boolean(session) && !loading && !profile,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw toError(error)
        await saveGuidelinesAcceptance('1.0')
        await refreshAuthenticatedUserState()
      },
      async signUp(email, password, returnTo = '/') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding?returnTo=${encodeURIComponent(returnTo)}`,
            data: {
              guidelines_accepted_version: '1.0',
              guidelines_user_agent: navigator.userAgent,
            },
          },
        })
        if (error) throw toError(error)
        if (data.session) {
          await saveGuidelinesAcceptance('1.0')
          await refreshAuthenticatedUserState()
        }
        // When email confirmation is on, no session is returned yet.
        return { needsConfirmation: !data.session }
      },
      async signInWithGoogle(returnTo = '/') {
        sessionStorage.setItem(GOOGLE_GUIDELINES_CONSENT_KEY, String(Date.now()))
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/onboarding?returnTo=${encodeURIComponent(returnTo)}`,
            // Show the user's list of Google accounts instead of forcing them down the "create account" path.
            queryParams: { prompt: 'select_account' },
          },
        })
        if (error) {
          sessionStorage.removeItem(GOOGLE_GUIDELINES_CONSENT_KEY)
          throw toError(error)
        }
      },
      async signInWithPhone(phone) {
        const { error } = await supabase.auth.signInWithOtp({
          phone,
          options: {
            shouldCreateUser: true,
            data: {
              guidelines_accepted_version: '1.0',
              guidelines_user_agent: navigator.userAgent,
            },
          },
        })
        if (error) throw toError(error)
      },
      async verifyPhoneOtp(phone, token) {
        const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
        if (error) throw toError(error)
        await saveGuidelinesAcceptance('1.0')
        await refreshAuthenticatedUserState()
      },
      async signOut() {
        const { error } = await supabase.auth.signOut()
        if (error) throw toError(error)
        // Never leave half-typed drafts for the next person on a shared phone.
        clearAllDrafts()
        setProfile(null)
      },
      async refreshProfile() {
        if (session?.user.id) {
          const p = await fetchProfile(session.user.id)
          setProfile(p)
        }
      },
      async refreshCompliance() {
        await refreshCompliance()
      },
      async acceptGuidelines() {
        const { data, error } = await supabase.auth.getUser()
        if (error) throw toError(error)
        if (!data.user) throw new Error('Sign in before accepting the Community Guidelines.')
        await saveGuidelinesAcceptance('1.0')
        setLoading(true)
        await loadUserState(data.user.id)
      },
      async acknowledgeWarning(violationId) {
        await acknowledgeViolationWarning(violationId)
        await refreshCompliance()
      },
      completeOnboarding(p) {
        setProfile(p)
      },
    }),
    [session, profile, loading, guidelineAccepted, violations, complianceError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
