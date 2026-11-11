import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, ShieldCheck, Download, Trash2, Eye, UserCog } from 'lucide-react'

const SECTIONS = [
  {
    title: 'What we collect and why',
    icon: UserCog,
    items: [
      'Account details (name, email or phone number, password hash) — to identify you and to let you sign in.',
      'Profile information you choose to add (bio, area, interests, photo) — to show other members who you are before you meet.',
      'Activity posts and chat messages — to run the core product: matching people for real-world events.',
      'Application and attendance history — to power join request flows and trust signals.',
      'Verification selfie — only if you ask for the verified badge. We store it privately; only the moderation team can see it.',
      'Location you share during an SOS — used exactly once to alert the admin, never shared publicly or sold.',
      'Device and usage data (approximate IP, session times, page paths) — to keep the app reliable and to investigate abuse.',
    ],
  },
  {
    title: 'How we use your data',
    icon: Eye,
    items: [
      'Showing you activities relevant to your stated interests and area.',
      'Matching, confirming, and notifying attendees about activities.',
      'Keeping the community safe — reviewing reports, verifying members, acting on SOS alerts.',
      'Improving the app — aggregate stats, not individual profiling or advertising.',
      'Compliance with Nigerian data laws and legitimate legal requests.',
    ],
  },
  {
    title: 'Sharing',
    icon: ShieldCheck,
    items: [
      'We do not sell your data. We do not rent it. We do not broker it.',
      'Activity details are visible to other signed-in members — title, description, area, time, your public profile.',
      'Moderators see reports, SOS payloads, and verification selfies only to act on them, not for marketing.',
      'Infrastructure partners (Vercel, Supabase) host and process your data strictly to run the app for you.',
    ],
  },
  {
    title: 'Your rights under the Nigeria Data Protection Act',
    icon: Download,
    items: [
      'Right to know what we hold — you can email comewme.app@gmail.com and we will tell you.',
      'Right to correct your information — edit your profile, photo, and bio anytime in Settings.',
      'Right to delete your account and data — email us with your account email and we will honour it within 30 days, subject to records we must keep by law.',
      'Right to object or restrict processing — tell us and we will pause anything non-essential.',
      'Right to withdraw consent — leaving the app is the cleanest form of this right.',
    ],
  },
  {
    title: 'Retention',
    icon: Trash2,
    items: [
      'Your active account and its activity data stay while your account exists.',
      'Verification selfies are deleted once the review decision is made, or 90 days after, whichever is sooner.',
      'SOS payloads are kept as long as needed to investigate, then purged.',
      'Deleted accounts and content stay purged within 30 days — backups may take an extra 90.',
    ],
  },
  {
    title: 'Security',
    icon: ShieldCheck,
    items: [
      'Passwords are stored as salted hashes — nobody sees them, not even us.',
      'Transit is TLS — data between your device and our servers is encrypted.',
      'Access to production data is limited to the founder/admin, logged, and auditable.',
      'We cannot promise absolute security. If there is ever a breach that affects you we will tell you what we know, what we did, and what you can do.',
    ],
  },
]

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <Link to="/settings" className="text-[13px] font-semibold text-amber" aria-label="Back">
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <h1 className="font-display text-[18px] font-bold">Privacy Policy</h1>
      </header>

      <main className="mx-auto max-w-[640px] space-y-4 px-4 py-5">
        <div className="rounded-2xl bg-white p-5 shadow-lift">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Come w&apos; me</p>
          <h2 className="font-display text-[22px] font-bold leading-tight">Privacy Policy</h2>
          <p className="mt-1 text-[10px] text-muted">Last updated {new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink/80">
            This page explains what we collect, why we have it, who else sees it (hardly anyone), and what you can do about it. Come w&apos; me is a social app for meeting people — that trust starts with being honest about how we treat your data.
          </p>
        </div>

        {SECTIONS.map((section) => {
          const Icon = section.icon
          return (
            <section key={section.title} className="rounded-2xl bg-white p-4 shadow-lift">
              <h3 className="flex items-center gap-2 font-display text-[15px] font-bold text-ink">
                <Icon size={16} className="shrink-0 text-amber" aria-hidden />
                {section.title}
              </h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-6 text-[13px] leading-relaxed text-ink/80">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )
        })}

        <div className="rounded-2xl border border-line bg-canvas p-4 text-[12px] leading-relaxed text-ink/80">
          <p className="font-bold text-ink">The honest stuff</p>
          <p className="mt-1">
            This is a starting point written by people who built the app, not reviewed by lawyers. If you are writing a larger policy later, get a real lawyer in Nigeria to check it — especially anything about retention periods or children.
          </p>
          <p className="mt-2">
            Questions or requests:{' '}
            <a href="mailto:comewme.app@gmail.com" className="inline-flex items-center gap-1 font-semibold text-amber underline underline-offset-2">
              <Mail size={12} aria-hidden /> comewme.app@gmail.com
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
