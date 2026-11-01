import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Landing() {
  const { session } = useAuth()

  // If already signed in, send them into the app.
  if (session) {
    // Let the router handle this — but as a fallback:
    return null
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur px-6 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <Link to="/" className="font-display text-[24px] font-bold tracking-tight text-ink">
            Come w' me
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-[14px] font-medium text-muted hover:text-ink transition">Log in</Link>
            <Link to="/login" className="btn-primary px-6 py-2.5 text-sm">Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative px-6 py-16 lg:py-24 overflow-hidden">
        <div className="max-w-[1200px] mx-auto">
          <div className="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
            <div className="lg:pr-8 mb-8 lg:mb-0">
              <span className="inline-block px-3 py-1 rounded-full bg-sun/20 text-amber-900 text-sm font-bold mb-4">
                Now in Lagos
              </span>
              <h1 className="font-display text-[56px] lg:text-[72px] font-bold leading-tight text-ink mb-6">
                Post an activity.<br />
                Find company.<br />
                Do the thing.
              </h1>
              <p className="text-lg text-muted leading-relaxed mb-8 max-w-[42rem]">
                Need someone to go to Balogun market with? A ride from Ajah to the mainland?
                A dev to jam with? Post what you want to do, find people nearby who are down,
                meet in public, and leave a review.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/login" className="btn-primary px-8 py-4 text-lg font-bold shadow-lift">
                  Start in Lagos
                </Link>
                <Link
                  to="/login"
                  className="btn-ghost px-8 py-4 text-lg font-bold border border-line"
                >
                  How it works
                </Link>
              </div>
            </div>

            <div className="relative">
              {/* Decorative phone frame showing the app */}
              <div className="relative max-w-[400px] mx-auto">
                <div className="absolute inset-0 bg-ink/5 rounded-[32px] border border-line/30 blur-2xl" />
                <div className="relative z-10 rounded-[30px] border border-line bg-white shadow-lift overflow-hidden">
                  <div className="px-4 py-3 border-b border-line bg-white">
                    <div className="flex items-center justify-between">
                      <div className="font-display text-sm font-bold">Come w' me</div>
                      <button className="btn-primary text-xs px-3 py-1">Post</button>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="card p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="pill bg-sun/25 text-ink text-xs">🛒 Errands</span>
                        <span className="text-xs font-semibold text-ink">Full</span>
                      </div>
                      <h3 className="font-bold text-ink">Need 2 people for a market run</h3>
                      <p className="mt-1 text-sm text-muted">Balogun Market · Tomorrow, 8 AM</p>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-line ring-2 ring-white" />
                        <div className="w-8 h-8 rounded-full bg-line ring-2 ring-white" />
                        <span className="text-xs font-bold text-ink">2 of 2</span>
                      </div>
                    </div>
                    <div className="card p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="pill bg-sun/25 text-ink text-xs">🍽️ Food</span>
                        <span className="text-xs font-semibold text-ink">Open</span>
                      </div>
                      <h3 className="font-bold text-ink">3-for-1 buffet in Ikeja</h3>
                      <p className="mt-1 text-sm text-muted">Ikeja City Mall · Friday, 6 PM</p>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-line ring-2 ring-white" />
                        <span className="text-xs font-bold text-ink">1 of 3</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative gradient blobs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-sun/30 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber/30 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2" />
      </header>

      {/* How it works */}
      <section className="px-6 py-16 bg-white/50">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-[32px] font-bold text-ink">How it works</h2>
            <p className="mt-3 text-lg text-muted">Four steps, that's it.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                n: '1',
                title: 'Post an activity',
                desc: 'Say what you want to do — market run, ride, food, dev meetup. Set the time and a public meeting point.',
              },
              {
                n: '2',
                title: 'Find company',
                desc: 'People nearby see your activity and request to join, or claim a spot instantly.',
              },
              {
                n: '3',
                title: 'Meet in public',
                desc: 'Coordinate in the in-app group chat. First meetups always happen somewhere busy and well known.',
              },
              {
                n: '4',
                title: 'Leave a review',
                desc: 'Rate each other after the task. Reputation builds trust for the next activity.',
              },
            ].map((step) => (
              <div key={step.n} className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sun text-ink font-display text-lg font-bold mb-4">
                  {step.n}
                </div>
                <h3 className="font-bold text-ink mb-2">{step.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="px-6 py-16 bg-canvas">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between mb-10">
            <h2 className="font-display text-[32px] font-bold text-ink">Categories</h2>
            <Link to="/login" className="btn-ghost text-sm">Browse all</Link>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { label: 'Errands', emoji: '🛒', value: 'market_run' },
              { label: 'Rides', emoji: '🚗', value: 'ride' },
              { label: 'Food', emoji: '🍽️', value: 'food' },
              { label: 'Study', emoji: '📚', value: 'study' },
              { label: 'Skill Meetups', emoji: '💻', value: 'dev' },
              { label: 'Events', emoji: '🎉', value: 'event' },
            ].map((c) => (
              <div key={c.value} className="card p-6 text-center hover:shadow-lift transition">
                <div className="text-3xl mb-3">{c.emoji}</div>
                <h3 className="font-bold text-ink">{c.label}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Safety */}
      <section className="px-6 py-16 bg-white/50">
        <div className="max-w-[1200px] mx-auto lg:grid lg:grid-cols-2 lg:gap-16 items-center">
          <div>
            <h2 className="font-display text-[32px] font-bold text-ink mb-6">Safety first, always.</h2>
            <ul className="space-y-5">
              {[
                'Meeting points are public landmarks — never a home address.',
                'All coordination happens in the in-app group chat.',
                'Every user builds a trust score from real reviews.',
                'Reports and complaints go to a human, not an algorithm.',
                'Verification badges show real people.',
              ].map((s) => (
                <li key={s} className="flex items-start gap-3 text-lg text-muted leading-relaxed">
                  <span className="flex shrink-0 mt-1 text-[20px]">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-sun/20 rounded-[24px] blur-[80px]" />
            <div className="relative z-10 rounded-[24px] border border-line bg-white shadow-card overflow-hidden">
              <div className="p-6">
                <h3 className="font-bold text-ink mb-4">Trust &amp; safety</h3>
                <p className="text-sm text-muted mb-6">
                  Come w' me is built for Lagos. We don't share phone numbers or addresses.
                  Meet in public, chat in the app, and review every experience.
                </p>
                <div className="flex gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    <span className="w-2 h-2 rounded-full bg-verified" /> Verified humans
                  </span>
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    <span className="w-2 h-2 rounded-full bg-sun/40" /> Public meetings only
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24">
        <div className="max-w-[1200px] mx-auto text-center">
          <div className="rounded-[32px] p-12 md:p-20 text-center" style={{ backgroundImage: 'linear-gradient(135deg, #FFD93D, #FF9F1C)' }}>
            <h2 className="font-display text-[40px] lg:text-[56px] font-bold text-ink mb-4">
              Ready to stop doing things alone?
            </h2>
            <p className="text-lg text-ink/80 mb-8 max-w-[40rem] mx-auto">
              Join hundreds of Lagosians finding company for market runs, rides, buffets, and more.
            </p>
            <Link to="/login" className="btn-primary px-10 py-4 text-lg font-bold shadow-lift">
              Start in Lagos
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-8">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="font-display text-sm font-bold text-ink">Come w' me</div>
          <div className="flex gap-6 text-sm text-muted">
            <Link to="/feedback" className="hover:text-ink transition">Feedback</Link>
            <Link to="/login" className="hover:text-ink transition">Log in</Link>
            <span className="text-[11px]">Lagos · v1.0</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
