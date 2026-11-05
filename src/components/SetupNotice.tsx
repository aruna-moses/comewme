const STEPS = [
  {
    n: '1',
    title: 'Create a Supabase project',
    body: 'supabase.com → New project. Pick the EU/Frankfurt region, it is the closest free region to Lagos.',
  },
  {
    n: '2',
    title: 'Run the schema',
    body: 'SQL Editor → New query → paste all of supabase/schema.sql → Run. It should finish green.',
  },
  {
    n: '3',
    title: 'Paste your keys',
    body: 'Settings → API. Copy .env.example to .env and fill in the URL and the anon key.',
  },
  {
    n: '4',
    title: 'Restart',
    body: 'Stop this server and run npm run dev again. Vite reads .env only at startup.',
  },
]

export default function SetupNotice() {
  return (
    <div className="min-h-screen px-5 py-12">
      <div className="mx-auto w-full max-w-[440px]">
        <div
          className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundImage: 'linear-gradient(180deg,#F7A233,#EE7B1E)' }}
        >
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden>
            <circle cx="9" cy="12" r="4.6" stroke="#1F2430" strokeWidth="2.6" />
            <circle cx="23" cy="12" r="4.6" stroke="#1F2430" strokeWidth="2.6" />
            <path d="M10 25c2-3.4 4-5 6-5s4 1.6 6 5" stroke="#1F2430" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="font-display text-[26px] font-bold leading-tight">
          Almost there
        </h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
          The app is built and running. It just has no database to talk to yet.
        </p>

        <div className="mt-6 space-y-2">
          {STEPS.map((s) => (
            <div key={s.n} className="card flex gap-3 p-4">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-bold"
                style={{ backgroundImage: 'linear-gradient(180deg,#F7A233,#EE7B1E)' }}
              >
                {s.n}
              </span>
              <div>
                <p className="text-[14px] font-bold">{s.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="card mt-4 border-alert/20 bg-alert/5 p-4">
          <p className="text-[13px] font-semibold text-alert">One warning</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink/75">
            Use the <span className="font-semibold">anon</span> key here, never the service role
            key. The service role key ignores every security rule in the database.
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted">
          Details in README.md · schema in supabase/schema.sql
        </p>
      </div>
    </div>
  )
}
