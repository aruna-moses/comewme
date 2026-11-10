import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'

function IconDiscover({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconMyTasks({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} />
      <path d="M9 4.5h6M9 10h6M9 14h6M9 18h3" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" />
    </svg>
  )
}

function IconChat({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-4-.99L3 21l1.99-5.5A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 1 1 21 11.5Z" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="16" cy="12" r="1" fill="currentColor" />
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
  const { pendingApplications, unreadMessages, moderation } = useNotifications()
  const location = useLocation()
  const navigate = useNavigate()

  if (
    !session
    || location.pathname === '/login'
    || location.pathname === '/onboarding'
    || location.pathname === '/community-check'
    || location.pathname === '/accept-guidelines'
    || location.pathname === '/violations'
    || location.pathname === '/admin/moderation'
    || /^\/task\/[^/]+\/chat$/.test(location.pathname)
  ) return null

  const profileTo = profile ? `/profile/${profile.id}` : '/login'

  const item = (
    to: string,
    label: string,
    icon: (a: boolean) => JSX.Element,
    badgeCount = 0,
    badgeDescription = 'unread',
  ) => (
    <NavLink
      to={to}
      aria-label={badgeCount > 0 ? `${label}, ${badgeCount} ${badgeDescription}` : label}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold transition ${
          isActive ? 'text-ink' : 'text-muted'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            {icon(isActive)}
            {badgeCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#e53935] px-1 text-[9px] font-bold leading-none text-white shadow-sm"
              >
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )

  return (
    <>
      <nav aria-label="Main navigation" className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 rounded-t-[24px] border-t border-line bg-white/95 shadow-[0_-8px_24px_rgba(59,47,24,0.06)] backdrop-blur">
        <div className="flex items-stretch px-2 pb-[env(safe-area-inset-bottom)] pt-1">
          {item('/', 'Discover', (a) => <IconDiscover active={a} />)}
          {item('/mytasks', 'My Tasks', (a) => <IconMyTasks active={a} />, pendingApplications, 'pending applications')}
          <div className="flex flex-1 justify-center">
            <button
              onClick={() => (session ? navigate('/post') : navigate('/login'))}
              className="-mt-2 flex h-[54px] w-[54px] items-center justify-center rounded-full text-white shadow-lift"
              style={{ backgroundImage: 'linear-gradient(180deg,#f7a233,#ee7b1e)' }}
              aria-label="Post an activity"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {item('/chats', 'Chats', (a) => <IconChat active={a} />, unreadMessages, 'unread messages')}
          {item(
            profileTo,
            'Profile',
            (a) => <IconProfile active={a} />,
            moderation.sos + moderation.reports + moderation.appeals + moderation.ads,
            'items need review',
          )}
        </div>
      </nav>
    </>
  )
}
