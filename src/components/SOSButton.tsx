import { useState } from 'react'
import SOSConfirmationSheet from './SOSConfirmationSheet'

interface Props {
  taskId: string
}

export default function SOSButton({ taskId }: Props) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-full bg-alert text-white px-3 py-1.5 text-[11px] font-bold shadow-card hover:bg-alert/90 transition active:scale-[0.95]"
        onClick={() => setOpen(true)}
        aria-label="Send emergency SOS"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>SOS</span>
      </button>

      {open && (
        <SOSConfirmationSheet
          taskId={taskId}
          onClose={() => setOpen(false)}
          onSent={() => {
            setOpen(false)
            setSent(true)
          }}
        />
      )}

      {sent && (
        <div className="mt-2 rounded-xl border border-verified/25 bg-verified/10 p-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="w-6 h-6 shrink-0 rounded-full bg-verified flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span className="text-[12px] font-semibold text-verified">SOS alert sent</span>
          </div>
          <p className="mt-1 text-[11px] text-verified/80">
            Our safety team has been notified. Please also call emergency services (112 or 199) if you are in danger.
          </p>
        </div>
      )}
    </div>
  )
}
