import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { prefetchDiscoverFeed, prefetchMyTasks, prefetchChats, prefetchProfile } from '../lib/prefetch'

function IconDiscover({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth={active ? 2.2 : 1.9} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconMyTasks({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="4" width="14" height="17" rx="2" stroke="currentColor" strokeWidth={active ? 2.2 : 1.9} />
      <path d="M9 4.5h6M9 10h6M9 14h6M9 18h3" stroke="currentColor" strokeWidth={active ? 2.1 : 1.7} strokeLinecap="round" />
    </svg>
  )
}

function IconChat({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-4-.99L3 21l1.99-5.5A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 1 1 21 11.5Z" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="16" cy="12" r="1" fill="currentColor" />
    </svg>
  )
}

function IconProfile({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth={active ? 2.4 : 2} />
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
      className="group flex flex-1 flex-col items-center justify-center gap-[5px] pt-2 transition-opacity active:opacity-60"
    >
      {({ isActive }) => (
        <>
          {/* Badge sits on the icon itself, like an iOS tab item. */}
          <span className="relative flex h-[22px] w-[26px] items-center justify-center">
            <span
              className={`transition-colors duration-150 ${
                isActive ? 'text-amber' : 'text-muted group-hover:text-ink/70'
              }`}
            >
              {icon(isActive)}
            </span>
            {badgeCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-2 -top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#FF3B30] px-1 text-[9px] font-bold leading-none tabular-nums text-white ring-2 ring-[rgb(var(--color-surface))]"
              >
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </span>
          <span
            className={`text-[10.5px] leading-none tracking-[0.005em] transition-colors duration-150 ${
              isActive ? 'font-bold text-ink' : 'font-semibold text-muted group-hover:text-ink/70'
            }`}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  )

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-line/80 bg-white/95 backdrop-blur-xl"
      >
        <div className="flex items-stretch px-1.5 pb-[max(env(safe-area-inset-bottom),6px)] pt-1">
          {item('/', 'Discover', (a) => <IconDiscover active={a} />, 0, 'unread', () => { void prefetchDiscoverFeed() })}
          {item('/activities', 'Activities', (a) => <IconMyTasks active={a} />, pendingApplications, 'pending applications', () => { if (myId) void prefetchMyTasks(myId) })}
          <div className="flex flex-1 justify-center">
            <button
              onClick={() => (session ? navigate('/post') : navigate('/login'))}
              className="-mt-4 flex h-[60px] w-[60px] items-center justify-center rounded-full text-[#0B0B0F] shadow-[0_10px_24px_-8px_rgba(238,123,30,0.65)] transition-transform duration-150 ease-out active:scale-95"
              style={{ backgroundImage: 'linear-gradient(180deg,#f7a233,#ee7b1e)' }}
              aria-label="Post an activity"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
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
        </div>
      </nav>
    </>
  )
}
