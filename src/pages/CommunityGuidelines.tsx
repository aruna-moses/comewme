import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { VIOLATION_CATEGORIES } from '../types'

const SECTIONS: Array<{ title: string; body: string | string[] }> = [
  {
    title: '1. What Come w\u2019 me is',
    body: 'Come w\u2019 me helps people in Lagos find company for real-world activities — market runs, shared rides, food outings, study sessions, and events. These guidelines exist to keep every meetup safe, respectful, and trustworthy.',
  },
  {
    title: '2. Who must follow these rules',
    body: 'Everyone with an account: every host, every joiner, every chatter, every viewer. Guests are expected to respect the spirit, but enforcement applies to members.',
  },
  {
    title: '3. Core rules',
    body: [
      'Meet in public. Never at home, never in a private office — the first meet is always a busy, public place.',
      'No money up front. Nobody should pay to join, transfer money, or "book a slot" before meeting.',
      'Be honest. Real name, real photo, real age, real location. No fake listings.',
      'Respect everyone. No hate speech, harassment, sexism, threats, or prejudice of any kind.',
      'No scams or illegal activity. No illegal goods or services, pyramid schemes, or fake giveaways.',
      'One person, one account. No alts to dodge bans or pad numbers.',
      'Show up. If you accept a spot, attend or tell the group as early as you can.',
    ],
  },
  {
    title: '4. What kind of activities are allowed?',
    body: [
      'Errands: market runs, grocery pickup, delivery assistance.',
      'Food: brunch, lunch, dinner, suya nights, restaurant recommendations.',
      'Learning: study groups, coding jams, book clubs, language exchange.',
      'Sports & walks: basketball, football pickup games, gym meetups.',
      'Culture & nights out: galleries, open-mics, comedy, music events, food fairs.',
      'Shared rides (same destination, public transport moving together).',
      'Moving help / small domestic tasks in public settings.',
    ],
  },
  {
    title: '5. What is never allowed',
    body: [
      'Sexual / romantic / companionship-for-pay listings. No dates-for-money, "private fun," escort bookings, or anything hinting at sex.',
      'Substance-fuelled meetups. Nothing organized around alcohol, drugs, or "let\u2019s go get wasted."',
      'Illegal or violent activity. Weapons, fraud, gambling dens, theft, or anything criminal.',
      'Under-18 meetups. Users must be 18+. Even general-interest posts can\u2019t be framed as "for teens."',
      'Hate groups, cults, or coordination of harm.',
      'Stalking, harassment of private individuals, doxxing.',
      'SPAM, clickbait, engagement bait, or commercial pitches disguised as activities.',
    ],
  },
  {
    title: '6. Content standards',
    body: [
      'Profile photos must be a clear photo of you.',
      'Activity titles: clear, specific, relevant. No shouting, clickbait, or unrelated tags.',
      'Chats: on-topic for the activity. No hate, threats, or sexual content — even as a joke.',
      'Descriptions: what, where, when, who, what to bring.',
    ],
  },
  {
    title: '7. If something seems off',
    body: [
      'Tap Report on any activity, profile, or message.',
      'The report goes to a human reviewer — never an algorithm.',
      'You can report even after an activity is over.',
      'Reports are private. The person reported is not told who flagged them.',
    ],
  },
  {
    title: '8. Enforcement',
    body: [
      'Warning — a sit-down notice. You have to acknowledge it before using the app again.',
      'Temporary suspension — 24 hours, 7 days, or 30 days.',
      'Permanent ban — access blocked. The only path back is a successful appeal to a moderator.',
      'Sexual / illegal content results in an immediate permanent ban — no prior warning.',
    ],
  },
  {
    title: '9. Appeals',
    body: 'If a decision was wrong, go to Settings → Your reports & decisions and tap Appeal, or email comewme.app@gmail.com with the incident date and why the decision was wrong. Appeals are reviewed by a moderator.',
  },
  {
    title: '10. Changes to these guidelines',
    body: 'We update them as the community grows and new risks appear. When we do, we\u2019ll ask you to accept the updated version before continuing.',
  },
  {
    title: '11. Contact',
    body: 'comewme.app@gmail.com — or emergencies via local police. Come w\u2019 me is not a law-enforcement service.',
  },
]

export default function CommunityGuidelines() {
  const { profile } = useAuth()

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <Link to="/" className="text-[13px] font-semibold text-amber" aria-label="Back">
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <h1 className="font-display text-[18px] font-bold">Community Guidelines</h1>
      </header>

      <main className="mx-auto max-w-[640px] px-4 py-5">
        <div className="rounded-2xl bg-white p-5 shadow-lift">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Come w&apos; me</p>
              <h2 className="font-display text-[22px] font-bold leading-tight">Community Guidelines</h2>
            </div>
            <span className="rounded-full bg-verified/15 px-3 py-1 text-[10px] font-bold uppercase text-verified">
              v1.1
            </span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-ink/80">
            Plain rules for plain people. Follow them and Come w&apos; me stays the easiest way to find real-life company in Lagos without the internet horror stories.
          </p>
          {profile && (
            <p className="mt-2 text-[11px] text-muted">
              Signed in as <strong className="text-ink">{profile.display_name}</strong> — these rules apply to you.
            </p>
          )}
        </div>

        {/* Quick answer to the most common question */}
        <div className="mt-4 rounded-2xl border border-alert/30 bg-alert/5 p-4 text-[13px]">
          <p className="font-bold text-alert">Most common question</p>
          <p className="mt-1 leading-relaxed text-ink/80">
            "Can I post a sexual task?" → <strong>No.</strong> Sexual, romantic, or companionship-for-pay tasks are a permanent ban on first post, no appeal. This one isn&apos;t flexible.
          </p>
        </div>

        {/* Category list */}
        <div className="mt-6">
          <h3 className="px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Violation Categories</h3>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {VIOLATION_CATEGORIES.map((category) => (
              <span
                key={category.value}
                className="rounded-lg bg-white px-2 py-1.5 text-[12px] font-medium text-ink ring-1 ring-line"
              >
                {category.label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {SECTIONS.map((section) => (
            <section key={section.title} className="rounded-2xl bg-white p-4 shadow-lift">
              <h3 className="font-display text-[15px] font-bold text-ink">{section.title}</h3>
              {Array.isArray(section.body) ? (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink/80">
                  {(section.body as string[]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[13px] leading-relaxed text-ink/80">{section.body}</p>
              )}
            </section>
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted">
          Come w&apos; me is a community platform. These guidelines exist so everyone can feel safe showing up.
          <br />
          © {new Date().getFullYear()} Come w&apos; me ·{' '}
          <Link to="/feedback" className="font-semibold text-amber">Report a concern</Link>
          <ChevronRight size={11} className="inline" aria-hidden />
        </p>
      </main>
    </div>
  )
}
