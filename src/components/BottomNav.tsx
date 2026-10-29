import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

function IconDiscover({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} />
      <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
    </svg>
  )
}

function IconPost({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="6" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} />
      <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" />
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

  // Hide on the auth screens so the tab bar doesn't fight the keyboard.
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
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-line bg-white/95 backdrop-blur">
      <div className="flex items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
        {item('/', 'Discover', (a) => <IconDiscover active={a} />)}
        {item('/post', 'Post', (a) => <IconPost active={a} />)}
        {item(profileTo, 'Profile', (a) => <IconProfile active={a} />)}
      </div>
      {!session && (
        <button
          onClick={() => (window.location.href = '/login')}
          className="sr-only"
          aria-hidden
          tabIndex={-1}
        />
      )}
    </nav>
  )
}
