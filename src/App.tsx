import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './context/AuthContext'
import BottomNav from './components/BottomNav'
import Discover from './pages/Discover'
import TaskDetail from './pages/TaskDetail'
import PostTask from './pages/PostTask'
import ProfilePage from './pages/ProfilePage'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Settings from './pages/Settings'
import Spinner from './components/Spinner'

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner full />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

export default function App() {
  const { loading, needsOnboarding } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner full />

  // Signed in but no profile row yet — finish onboarding first.
  if (needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Discover />} />
        <Route path="/task/:id" element={<TaskDetail />} />
        <Route path="/profile/:id" element={<ProfilePage />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/post"
          element={
            <RequireAuth>
              <PostTask />
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
    </div>
  )
}
