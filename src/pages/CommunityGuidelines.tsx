import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Search, AlertCircle, Send, Loader2, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { VIOLATION_CATEGORIES } from '../types'
import { submitReport } from '../lib/api'

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

function tokenise(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
}

export default function CommunityGuidelines() {
  const { profile } = useAuth()
  const [question, setQuestion] = useState('')
  const [askText, setAskText] = useState('')
  const [askBusy, setAskBusy] = useState(false)
  const [askDone, setAskDone] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)

  const scoredSections = useMemo(() => {
    const tokens = tokenise(question)
    if (tokens.length === 0) return SECTIONS.map((s) => ({ section: s, score: 1 }))

    return SECTIONS
      .map((section) => {
        const haystack = [
          section.title,
          ...(Array.isArray(section.body) ? section.body : [section.body]),
        ]
          .join(' ')
          .toLowerCase()
        const score = tokens.reduce((sum, token) => {
          if (haystack.includes(token)) return sum + (token.length > 5 ? 2 : 1)
          return sum
        }, 0)
        return { section, score }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
  }, [question])

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

        {/* Instant answer box — matches against the same document a moderator reads. */}
        <div className="mt-4 rounded-2xl border border-line bg-canvas p-4">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink" htmlFor="guideline-search">
            <Search size={16} className="text-amber" aria-hidden />
            Ask something
          </label>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Type your question — we match instantly against these guidelines. Not legal advice and not a reviewer Decision, but it'll point to the right rule.
          </p>
          <input
            id="guideline-search"
            type="text"
            className="field mt-2"
            placeholder="e.g. Can I post a task to meet a girlfriend?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          {question.trim().length > 0 && (
            <ul className="mt-2 space-y-2">
              {scoredSections.slice(0, 4).map(({ section }) => (
                <li key={section.title} className="rounded-xl bg-white p-2.5 text-[12px] leading-relaxed text-ink ring-1 ring-line">
                  <p className="font-semibold text-ink">{section.title}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-muted">
                    {(Array.isArray(section.body) ? (section.body as string[]).slice(0, 3) : [section.body as string]).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </li>
              ))}
              {scoredSections.length === 0 && (
                <li className="rounded-xl bg-white p-3 text-[12px] text-muted ring-1 ring-line">
                  <p className="flex items-start gap-1.5">
                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber" aria-hidden />
                    <span>Not in here. You can ask a moderator instead — they read every question.</span>
                  </p>
                  <form
                    className="mt-2 space-y-2"
                    onSubmit={async (event) => {
                      event.preventDefault()
                      setAskError(null)
                      setAskDone(false)
                      const text = (askText || question).trim()
                      if (text.length < 4) {
                        setAskError('Use at least a few words — a real question is easier to answer than “help”.')
                        return
                      }
                      if (!profile) {
                        setAskError('Sign in first so we know who to send the answer to.')
                        return
                      }
                      setAskBusy(true)
                      try {
                        await submitReport({
                          reporter_id: profile.id,
                          category: 'feedback',
                          details: `[Community Guidelines question] ${text}`,
                        })
                        setAskDone(true)
                        setAskText('')
                      } catch (err) {
                        setAskError(err instanceof Error ? err.message : 'Could not send your question.')
                      } finally {
                        setAskBusy(false)
                      }
                    }}
                  >
                    <label htmlFor="ask-text" className="sr-only">What do you want to ask?</label>
                    <textarea
                      id="ask-text"
                      className="field min-h-[72px] text-[13px]"
                      placeholder="Write your question — keep it short and specific…"
                      value={askText || question}
                      onChange={(event) => setAskText(event.target.value)}
                      required
                    />
                    {askError && <p role="alert" className="text-[11px] font-medium text-alert">{askError}</p>}
                    {askDone && (
                      <p role="status" className="flex items-center gap-1.5 rounded-lg bg-verified/10 p-2 text-[11px] font-medium text-verified">
                        <Check size={13} aria-hidden /> Sent — a moderator will read it and reply in-app.
                      </p>
                    )}
                    <button type="submit" className="btn-primary btn-sm w-full" disabled={askBusy || !profile}>
                      {askBusy ? (
                        <><Loader2 size={14} className="animate-spin" aria-hidden /> Sending…</>
                      ) : (
                        <><Send size={14} aria-hidden /> Ask the moderator</>
                      )}
                    </button>
                  </form>
                </li>
              )}
            </ul>
          )}
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
