import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Play, Square } from 'lucide-react'

const WAVEFORM_BAR_COUNT = 32

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '0:00'
  const totalSeconds = Math.max(0, Math.floor(seconds))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

export default function VoiceNotePlayer({
  messageId,
  url,
  duration,
  isPlaying,
  currentTime,
  onToggle,
  onProgress,
  onEnded,
}: {
  messageId: string
  url: string
  duration: number | null
  isPlaying: boolean
  currentTime: number
  onToggle: (messageId: string, audio: HTMLAudioElement) => void
  onProgress: (time: number) => void
  onEnded: () => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [mediaDuration, setMediaDuration] = useState<number | null>(null)
  const totalDuration = mediaDuration ?? duration
  const progress = totalDuration ? Math.min(currentTime / totalDuration, 1) : 0

  return (
    <div className="flex min-w-[220px] max-w-full items-center gap-2 rounded-2xl bg-white px-3 py-2 text-left shadow-sm">
      <audio
        ref={audioRef}
        data-message-id={messageId}
        src={url}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration
          if (Number.isFinite(value)) setMediaDuration(value)
        }}
        onDurationChange={(event) => {
          const value = event.currentTarget.duration
          if (Number.isFinite(value)) setMediaDuration(value)
        }}
        onTimeUpdate={(event) => onProgress(event.currentTarget.currentTime)}
        onEnded={onEnded}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => {
          if (audioRef.current) onToggle(messageId, audioRef.current)
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-ink"
        aria-label={isPlaying ? 'Stop voice note' : 'Play voice note'}
      >
        {isPlaying ? <Square size={14} fill="currentColor" aria-hidden /> : <Play size={16} fill="currentColor" aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-ink">Voice note</p>
        <div className="voice-note-waveform relative mt-1 flex h-6 items-center justify-between gap-[2px]">
          {Array.from({ length: WAVEFORM_BAR_COUNT }, (_, index) => {
            const height = 22 + ((index * 17 + 13) % 70)
            return (
              <span
                key={index}
                aria-hidden
                className={`voice-note-bar ${(index + 1) / WAVEFORM_BAR_COUNT <= progress ? 'voice-note-bar-played' : ''}`}
                style={{ height: `${height}%` }}
              />
            )
          })}
          <input
            type="range"
            min={0}
            max={totalDuration ?? 1}
            step={0.1}
            value={Math.min(currentTime, totalDuration ?? currentTime)}
            disabled={!totalDuration}
            aria-label="Seek voice note"
            aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(totalDuration)}`}
            onChange={(event) => {
              const time = Number(event.currentTarget.value)
              if (audioRef.current) audioRef.current.currentTime = time
              onProgress(time)
            }}
            className="voice-note-scrubber"
            style={{ '--voice-progress': `${progress * 100}%` } as CSSProperties}
          />
        </div>
        <div className="mt-0.5 flex justify-between text-[10px] text-muted">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(totalDuration)}</span>
        </div>
      </div>
    </div>
  )
}
