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
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden>
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
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden>
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
      className="group flex min-w-0 flex-1 flex-col items-center justify-center py-1 transition-opacity active:opacity-70"
    >
      {({ isActive }) => (
        <>
          {/* Soft translucent selection pill wraps icon + label, like iOS 26. */}
          <span
            className={`flex w-full flex-col items-center gap-[3px] whitespace-nowrap rounded-[18px] px-1 py-1.5 transition-all duration-200 ease-out active:scale-[0.94] ${
              isActive ? 'bg-amber/[0.15]' : 'bg-transparent group-hover:bg-ink/[0.045]'
            }`}
          >
            {/* Badge sits on the icon itself, like an iOS tab item. */}
            <span className="relative flex h-[31px] w-[33px] items-center justify-center">
              <span
                className={`transition-colors duration-150 ${
                  isActive ? 'tab-icon-pop text-amber' : 'text-muted group-hover:text-ink/70'
                }`}
              >
                {icon(isActive)}
              </span>
              {badgeCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-2 top-0 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#FF3B30] px-1 text-[9px] font-bold leading-none tabular-nums text-white ring-2 ring-[rgb(var(--color-surface))]"
                >
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </span>
            <span
              className={`text-[10.5px] leading-none tracking-[0.01em] transition-colors duration-150 ${
                isActive ? 'font-extrabold text-amber' : 'font-semibold text-muted group-hover:text-ink/70'
              }`}
            >
              {label}
            </span>
          </span>
        </>
      )}
    </NavLink>
  )

  return (
    <>
      {/* iOS 26 style: one floating capsule, inset from the screen edges. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto flex w-full max-w-[480px] justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
          <nav
            aria-label="Main navigation"
            className="pointer-events-auto flex w-full items-stretch rounded-[26px] border border-line bg-white/90 px-1.5 shadow-[0_16px_40px_-18px_rgba(11,11,15,0.5)] backdrop-blur-2xl saturate-150"
          >
            <div className="flex min-h-[56px] min-w-0 flex-1 items-stretch">
              {item('/', 'Discover', (a) => <IconDiscover active={a} />, 0, 'unread', () => { void prefetchDiscoverFeed() })}
              {item('/activities', 'Activities', (a) => <IconMyTasks active={a} />, pendingApplications, 'pending applications', () => { if (myId) void prefetchMyTasks(myId) })}
            </div>
            <div className="flex min-w-0 flex-1 justify-center">
              <button
                onClick={() => (session ? navigate('/post') : navigate('/login'))}
                className="-mt-6 flex h-[68px] w-[68px] items-center justify-center rounded-full text-[#0B0B0F] shadow-[0_12px_28px_-10px_rgba(238,123,30,0.7)] transition-transform duration-150 ease-out active:scale-95"
                style={{ backgroundImage: 'linear-gradient(180deg,#f7a233,#ee7b1e)' }}
                aria-label="Post an activity"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex min-h-[56px] min-w-0 flex-1 items-stretch">
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
        </div>
      </div>
    </>
  )
}
