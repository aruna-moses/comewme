import { useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './context/AuthContext'
import BottomNav from './components/BottomNav'
import Discover from './pages/Discover'
import TaskDetail from './pages/TaskDetail'
import ChatRoom from './pages/ChatRoom'
import MyTasks from './pages/MyTasks'
import ChatList from './pages/ChatList'
import ProfilePage from './pages/ProfilePage'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import PostTask from './pages/PostTask'
import Settings from './pages/Settings'
import Feedback from './pages/Feedback'
import CommunityCheck from './pages/CommunityCheck'
import Violations from './pages/Violations'
import AdminModeration from './pages/AdminModeration'
import Spinner from './components/Spinner'
import GuidelinesModal from './components/GuidelinesModal'
import WarningModal, { activeRestriction, unacknowledgedWarning } from './components/WarningModal'

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner full />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

function RequireCommunityCheck({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const location = useLocation()
  if (profile && !profile.community_check_passed_at) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/community-check?returnTo=${returnTo}`} replace />
  }
  return <>{children}</>
}

function AcceptGuidelinesRoute() {
  const { guidelineAccepted, acceptGuidelines } = useAuth()
  if (guidelineAccepted) return <Navigate to="/" replace />
  return <GuidelinesModal onAccept={acceptGuidelines} />
}

export default function App() {
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const {
    session,
    loading,
    needsOnboarding,
    guidelineAccepted,
    violations,
    complianceError,
    refreshCompliance,
    acknowledgeWarning,
    signOut,
  } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner full />

  if (session && complianceError) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-canvas p-6 text-center">
        <h1 className="font-display text-xl font-bold">We couldn&apos;t verify your account</h1>
        <p role="alert" className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted">{complianceError}</p>
        <button className="btn-primary mt-5" onClick={() => void refreshCompliance()}>Try again</button>
        <button
          className="btn-ghost mt-2"
          onClick={() => {
            setSignOutError(null)
            void signOut().catch((error: unknown) => {
              setSignOutError(error instanceof Error ? error.message : 'Could not sign out.')
            })
          }}
        >
          Sign out
        </button>
        {signOutError && <p role="alert" className="mt-2 text-[12px] text-alert">{signOutError}</p>}
      </div>
    )
  }

  if (session && !guidelineAccepted && location.pathname !== '/accept-guidelines') {
    return <Navigate to="/accept-guidelines" replace />
  }

  if (session && guidelineAccepted && location.pathname === '/accept-guidelines') {
    return <Navigate to="/" replace />
  }

  const restriction = activeRestriction(violations)
  const warning = restriction ? null : unacknowledgedWarning(violations)

  if (session && guidelineAccepted && (restriction || warning) && location.pathname !== '/violations') {
    return <Navigate to="/violations" replace />
  }

  if (needsOnboarding && location.pathname !== '/onboarding') {
    const returnTo = `${location.pathname}${location.search}`
    return <Navigate to={`/onboarding?returnTo=${encodeURIComponent(returnTo)}`} replace />
  }

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Discover />} />
        <Route path="/task/:id/chat" element={<RequireAuth><ChatRoom /></RequireAuth>} />
        <Route path="/task/:id" element={<TaskDetail />} />
        <Route path="/mytasks" element={<RequireAuth><MyTasks /></RequireAuth>} />
        <Route path="/chats" element={<RequireAuth><ChatList /></RequireAuth>} />
        <Route path="/profile/:id" element={<ProfilePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/accept-guidelines" element={<RequireAuth><AcceptGuidelinesRoute /></RequireAuth>} />
        <Route path="/violations" element={<RequireAuth><Violations /></RequireAuth>} />
        <Route path="/admin/moderation" element={<RequireAuth><AdminModeration /></RequireAuth>} />
        <Route
          path="/post"
          element={
            <RequireAuth>
              <RequireCommunityCheck>
                <PostTask />
              </RequireCommunityCheck>
            </RequireAuth>
          }
        />
        <Route
          path="/community-check"
          element={
            <RequireAuth>
              <CommunityCheck />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
        <Route
          path="/feedback"
          element={<Feedback />}
        />
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <Onboarding />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
      {session && restriction && <WarningModal violation={restriction} onAcknowledge={async () => undefined} />}
      {session && !restriction && warning && <WarningModal violation={warning} onAcknowledge={() => acknowledgeWarning(warning.id)} />}
    </div>
  )
}
