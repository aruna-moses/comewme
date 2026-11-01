import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './context/AuthContext'
import BottomNav from './components/BottomNav'
import Discover from './pages/Discover'
import TaskDetail from './pages/TaskDetail'
import MyTasks from './pages/MyTasks'
import ChatList from './pages/ChatList'
import PostTask from './pages/PostTask'
import ProfilePage from './pages/ProfilePage'
import Feedback from './pages/Feedback'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Settings from './pages/Settings'
import Landing from './pages/Landing'
import Spinner from './components/Spinner'

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner full />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

export default function App() {
  const { loading, needsOnboarding, session } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner full />

  // Already signed in? Go straight to the app.
  if (location.pathname === '/' && session) {
    return <Navigate to="/app" replace />
  }

  if (needsOnboarding && location.pathname !== '/app/onboarding') {
    return <Navigate to="/app/onboarding" replace />
  }

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Discover />} />
        <Route path="/app/task/:id" element={<TaskDetail />} />
        <Route path="/app/mytasks" element={<MyTasks />} />
        <Route path="/app/chats" element={<ChatList />} />
        <Route path="/app/profile/:id" element={<ProfilePage />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/app/post"
          element={
            <RequireAuth>
              <PostTask />
            </RequireAuth>
          }
        />
        <Route
          path="/app/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
        <Route
          path="/app/feedback"
          element={<Feedback />}
        />
        <Route
          path="/app/onboarding"
          element={
            <RequireAuth>
              <Onboarding />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* Bottom nav only inside the app, not on the landing page */}
      <Route path="/app/*" element={<BottomNav />} />
    </div>
  )
}
