import { useState } from 'react'

export default function GuidelinesModal({
  onAccept,
}: {
  onAccept: () => Promise<void>
}) {
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      await onAccept()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your acceptance. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-ink/60 px-4 py-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="guidelines-title"
        className="mx-auto my-auto max-h-[calc(100dvh-4rem)] w-full max-w-[520px] overflow-y-auto rounded-[24px] bg-white p-5 shadow-lift sm:p-7"
      >
        <p className="text-[11px] font-bold uppercase tracking-[.14em] text-amber">Community guidelines · Version 1.0</p>
        <h1 id="guidelines-title" className="mt-2 font-display text-[25px] font-bold">Make room for good company</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Come w&apos; me works best when everyone can meet, share plans and feel safe. Please keep these in mind:
        </p>
        <div className="mt-5 space-y-4 text-[13px] leading-relaxed">
          <section>
            <h2 className="font-semibold">Treat people with respect</h2>
            <p className="mt-1 text-muted">No harassment, hate, threats, unwanted contact or discrimination. Respect boundaries and accept a no.</p>
          </section>
          <section>
            <h2 className="font-semibold">Be genuine and reliable</h2>
            <p className="mt-1 text-muted">Use an honest profile, share accurate activity details, and let your group know if plans change. Don&apos;t scam, spam or impersonate anyone.</p>
          </section>
          <section>
            <h2 className="font-semibold">Keep activities appropriate and safe</h2>
            <p className="mt-1 text-muted">Meet in public places, protect private information, and never pressure anyone to send money. Illegal content and anything that endangers minors are not allowed.</p>
          </section>
          <section>
            <h2 className="font-semibold">Help us keep the community healthy</h2>
            <p className="mt-1 text-muted">Report concerning behaviour in the app. Reports are private and reviewed by the moderation team. Serious or repeated violations may lead to a warning, temporary suspension or permanent ban. You can appeal a moderation decision.</p>
          </section>
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-4 text-[13px] leading-relaxed">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[#ff9f1c]"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
          />
          <span>I have read and agree to the Community Guidelines.</span>
        </label>
        {error && <p role="alert" className="mt-3 rounded-xl bg-alert/10 p-3 text-[13px] text-alert">{error}</p>}
        <button type="button" className="btn-primary mt-4 w-full" disabled={!checked || busy} onClick={() => void accept()}>
          {busy ? 'Saving…' : 'I Agree'}
        </button>
      </section>
    </div>
  )
}
