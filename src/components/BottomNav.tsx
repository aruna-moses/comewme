import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function IconDiscover({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} />
      <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
    </svg>
  )
}

function IconMyTasks({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} />
      <path d="M3 9h18M7 13h10" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
    </svg>
  )
}

function IconChat({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconProfile({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} />
      <path d="M5 19.5c1.6-3 4-4.5 7-4.5s5.4 1.5 7 4.5" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
    </svg>
  )
}

export default function BottomNav() {
  const { profile, session } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (location.pathname === '/login' || location.pathname === '/onboarding') return null

  const profileTo = profile ? `/profile/${profile.id}` : '/login'

  const item = (to: string, label: string, icon: (a: boolean) => JSX.Element) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold transition ${
          isActive ? 'text-ink' : 'text-muted'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {icon(isActive)}
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )

  return (
    <>
      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-line bg-white/95 backdrop-blur">
        <div className="flex items-stretch px-2 pb-[env(safe-area-inset-bottom)] pt-1">
          {item('/', 'Discover', (a) => <IconDiscover active={a} />)}
          {item('/mytasks', 'My Tasks', (a) => <IconMyTasks active={a} />)}
          {item('/chats', 'Chat', (a) => <IconChat active={a} />)}
          {item(profileTo, 'Profile', (a) => <IconProfile active={a} />)}
        </div>
      </nav>

      {/* Floating Post button */}
      <button
        onClick={() => (session ? navigate('/post') : (window.location.href = '/login'))}
        className="fixed bottom-[88px] left-1/2 -translate-x-1/2 z-50 w-14 h-14 rounded-full shadow-lift"
        style={{ backgroundImage: 'linear-gradient(135deg,#FFD93D,#FF9F1C)' }}
        aria-label="Post an activity"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 5v14M5 12h14" stroke="#0B0B0F" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </>
  )
}
