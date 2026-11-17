import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { prefetchDiscoverFeed, prefetchMyTasks, prefetchChats, prefetchProfile } from '../lib/prefetch'

function IconDiscover({ active }: { active: boolean }) {
  if (active) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 3.1 3.4 9.9v10.5a1.5 1.5 0 0 0 1.5 1.5H8.5v-6.2h7V21.9h3.6a1.5 1.5 0 0 0 1.5-1.5V9.9L12 3.1Z" />
      </svg>
    )
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconMyTasks({ active }: { active: boolean }) {
  if (active) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M9.7 3.1h4.6a1.6 1.6 0 0 1 1.6 1.6V6.5a1 1 0 0 1-1 1H9.1a1 1 0 0 1-1-1V4.7a1.6 1.6 0 0 1 1.6-1.6Z" />
        <path fillRule="evenodd" d="M5.6 6.4h12.8a1.4 1.4 0 0 1 1.4 1.4v12.4a1.4 1.4 0 0 1-1.4 1.4H5.6a1.4 1.4 0 0 1-1.4-1.4V7.8a1.4 1.4 0 0 1 1.4-1.4ZM8 10.5h8v1.5H8Zm0 3.6h8v1.5H8Zm0 3.6h5v1.5H8Z" />
      </svg>
    )
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth={1.9} />
      <path d="M9 4.5h6M9 10h6M9 14h6M9 18h3" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  )
}

function IconChat({ active }: { active: boolean }) {
  if (active) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d="M8.8 3.8h6.4A4.8 4.8 0 0 1 20 8.6v2.4a4.8 4.8 0 0 1-4.8 4.8h-3.4L8.4 19.4v-3.6A4.8 4.8 0 0 1 4 11V8.6A4.8 4.8 0 0 1 8.8 3.8ZM8.5 11.5a1.15 1.15 0 1 0 2.3 0 1.15 1.15 0 0 0-2.3 0Zm2.65 0a1.15 1.15 0 1 0 2.3 0 1.15 1.15 0 0 0-2.3 0Zm2.65 0a1.15 1.15 0 1 0 2.3 0 1.15 1.15 0 0 0-2.3 0Z" />
      </svg>
    )
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-4-.99L3 21l1.99-5.5A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 1 1 21 11.5Z" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="16" cy="12" r="1" fill="currentColor" />
    </svg>
  )
}

function IconProfile({ active }: { active: boolean }) {
  if (active) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 12.7a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Z" />
        <path d="M12 13.6c-4 0-7.4 1.75-8.5 5.1-.22.7.3 1.1 1 1.1h15c.7 0 1.22-.4 1-1.1-1.1-3.35-4.5-5.1-8.5-5.1Z" />
      </svg>
    )
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth={1.9} />
      <path d="M5 19.5c1.6-3 4-4.5 7-4.5s5.4 1.5 7 4.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
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
  const myId = session?.user.id

  const item = (
    to: string,
    label: string,
    icon: (a: boolean) => JSX.Element,
    badgeCount = 0,
    badgeDescription = 'unread',
    prefetcher?: () => void,
  ) => (
    <NavLink
      to={to}
      aria-label={badgeCount > 0 ? `${label}, ${badgeCount} ${badgeDescription}` : label}
      onMouseEnter={prefetcher}
      onPointerDown={prefetcher}
      onFocus={prefetcher}
      className={({ isActive }) =>
        `flex min-w-[64px] flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-full px-3 py-2 transition-all duration-200 ${
          isActive
            ? 'bg-[#F58220]/15 font-semibold text-[#F58220] dark:bg-[#F58220]/20 dark:text-[#F58220]'
            : 'font-medium text-[#6B7280] hover:text-[#3f4756] dark:text-[#9CA3AF] dark:hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Badge anchored to the icon's top-right corner. */}
          <span className="relative flex h-6 w-6 items-center justify-center">
            <span className={isActive ? 'tab-icon-pop' : ''}>{icon(isActive)}</span>
            {badgeCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-2.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#FF3B30] px-1.5 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-[#1C1E22]"
              >
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </span>
          <span className="text-[11px] leading-none tracking-tight whitespace-nowrap">{label}</span>
        </>
      )}
    </NavLink>
  )

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+10px)] z-40">
      <nav
        aria-label="Main navigation"
        className="pointer-events-auto mx-3 flex max-w-[440px] items-center justify-between gap-1 rounded-full border border-black/10 bg-white/85 px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-[#1C1E22]/85 dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)] md:mx-auto"
      >
        {item('/', 'Discover', (a) => <IconDiscover active={a} />, 0, 'unread', () => { void prefetchDiscoverFeed() })}
        {item('/activities', 'Activities', (a) => <IconMyTasks active={a} />, pendingApplications, 'pending applications', () => { if (myId) void prefetchMyTasks(myId) })}
        <div className="flex flex-1 items-center justify-center">
          <button
            onClick={() => (session ? navigate('/post') : navigate('/login'))}
            className="-mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F58220] text-white shadow-[0_8px_20px_rgba(245,130,32,0.42)] transition-transform duration-150 ease-out hover:scale-105 active:scale-95"
            aria-label="Post an activity"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {item('/chats', 'Chats', (a) => <IconChat active={a} />, unreadMessages, 'unread messages', () => { if (myId) void prefetchChats(myId) })}
        {item(
          profileTo,
          'Profile',
          (a) => <IconProfile active={a} />,
          moderation.sos + moderation.reports + moderation.appeals + moderation.ads + moderation.verifications + moderation.feedback,
          'items need review',
          () => { if (myId) void prefetchProfile(myId) },
        )}
      </nav>
    </div>
  )
}
