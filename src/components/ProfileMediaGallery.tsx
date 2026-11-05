import { useEffect, useRef, useState } from 'react'
import { ImagePlus, LoaderCircle, LockKeyhole, Play, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const BUCKET = 'profile-media'
const MAX_MEDIA = 6
const MAX_IMAGE_SIZE = 8 * 1024 * 1024
const MAX_VIDEO_SIZE = 30 * 1024 * 1024

type ProfileMedia = {
  id: string
  profile_id: string
  storage_path: string
  media_type: 'image' | 'video'
  created_at: string
  url: string
}

const ALLOWED_MEDIA_TYPES: Record<string, ProfileMedia['media_type']> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
}

function mediaError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  if (/profile_media|profile-media|schema cache|does not exist/i.test(message)) {
    return 'Public profile media is not set up yet. Run the new profile media migration in Supabase, then refresh.'
  }
  if (/bucket|not found/i.test(message)) {
    return 'Profile media storage is not set up yet. Run the new profile media migration in Supabase, then refresh.'
  }
  return message
}

export default function ProfileMediaGallery({
  profileId,
  isOwner,
}: {
  profileId: string
  isOwner: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [media, setMedia] = useState<ProfileMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<ProfileMedia | null>(null)

  async function loadMedia() {
    setLoading(true)
    setError('')
    try {
      const { data, error: queryError } = await supabase
        .from('profile_media')
        .select('id, profile_id, storage_path, media_type, created_at')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
      if (queryError) throw queryError
      setMedia(
        (data ?? []).map((item) => ({
          ...(item as Omit<ProfileMedia, 'url'>),
          url: supabase.storage.from(BUCKET).getPublicUrl(item.storage_path as string).data.publicUrl,
        })),
      )
    } catch (loadError) {
      setError(mediaError(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMedia()
  }, [profileId])

  async function addMedia(file?: File) {
    if (!file) return
    const mediaType = ALLOWED_MEDIA_TYPES[file.type]
    if (!mediaType) {
      setError('Choose a JPG, PNG, or WebP photo, or an MP4, WebM, or MOV video.')
      return
    }
    const sizeLimit = mediaType === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE
    if (file.size > sizeLimit) {
      setError(mediaType === 'image' ? 'Photos must be 8 MB or smaller.' : 'Videos must be 30 MB or smaller.')
      return
    }
    if (media.length >= MAX_MEDIA) {
      setError(`You can share up to ${MAX_MEDIA} photos or videos.`)
      return
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'media'
    const path = `${profileId}/${crypto.randomUUID()}.${extension}`
    setUploading(true)
    setError('')
    let uploadedPath: string | null = null
    try {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      })
      if (uploadError) throw uploadError
      uploadedPath = path

      const { data, error: insertError } = await supabase
        .from('profile_media')
        .insert({ profile_id: profileId, storage_path: path, media_type: mediaType })
        .select('id, profile_id, storage_path, media_type, created_at')
        .single()
      if (insertError) throw insertError

      setMedia((current) => [
        {
          ...(data as Omit<ProfileMedia, 'url'>),
          url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
        },
        ...current,
      ])
    } catch (uploadFailure) {
      let message = mediaError(uploadFailure)
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([uploadedPath])
        if (cleanupError) {
          message = `${message} The uploaded file could not be cleaned up; please contact support.`
        }
      }
      setError(message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function removeMedia(item: ProfileMedia) {
    setDeletingId(item.id)
    setError('')
    try {
      const { error: rowError } = await supabase.from('profile_media').delete().eq('id', item.id)
      if (rowError) throw rowError

      setMedia((current) => current.filter((entry) => entry.id !== item.id))
      if (selected?.id === item.id) setSelected(null)
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([item.storage_path])
      if (storageError) {
        setError('The media was removed from your profile, but its stored file could not be cleaned up.')
      }
    } catch (deleteError) {
      setError(mediaError(deleteError))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="mt-7" aria-labelledby="public-media-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 id="public-media-heading" className="font-display text-base font-bold">Public moments</h2>
          <p className="mt-0.5 text-[11px] text-muted">Photos and videos you choose to share</p>
        </div>
        {isOwner && (
          <button
            type="button"
            className="btn-primary btn-sm shrink-0"
            disabled={uploading || media.length >= MAX_MEDIA}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <LoaderCircle size={16} className="animate-spin" aria-hidden /> : <ImagePlus size={16} aria-hidden />}
            {uploading ? 'Uploading…' : 'Add media'}
          </button>
        )}
        {isOwner && (
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
            className="hidden"
            aria-label="Choose a photo or video to share publicly"
            onChange={(event) => void addMedia(event.target.files?.[0])}
          />
        )}
      </div>

      <p className="mb-3 flex items-center gap-1.5 text-[10px] text-muted">
        <LockKeyhole size={12} aria-hidden />
        Only media you add here is public. Up to {MAX_MEDIA} items.
      </p>

      {error && (
        <div className="mb-3 rounded-xl border border-alert/20 bg-alert/10 p-3 text-[12px] text-alert">
          <p role="alert">{error}</p>
          {/migration|not set up/i.test(error) && (
            <p className="mt-1 text-[11px]">Apply <code>008_public_profile_media.sql</code> in Supabase SQL Editor.</p>
          )}
          {!/migration|not set up/i.test(error) && (
            <button type="button" className="mt-1 font-semibold underline" onClick={() => void loadMedia()}>
              Try again
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="card flex min-h-28 items-center justify-center" role="status" aria-label="Loading public media">
          <LoaderCircle size={20} className="animate-spin text-muted" aria-hidden />
        </div>
      ) : media.length === 0 ? (
        <div className="card flex min-h-28 flex-col items-center justify-center p-4 text-center">
          <ImagePlus size={22} className="text-muted" aria-hidden />
          <p className="mt-2 text-[12px] text-muted">
            {isOwner ? 'Share a few moments so people can get to know you.' : 'No public photos or videos yet.'}
          </p>
          {isOwner && (
            <p className="mt-1 text-[10px] text-muted">
              JPG, PNG, WebP · MP4, WebM, MOV · 8 MB photos / 30 MB videos
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {media.map((item) => (
            <div key={item.id} className="group relative aspect-square overflow-hidden rounded-[16px] bg-canvas">
              <button
                type="button"
                className="absolute inset-0 z-0 h-full w-full"
                onClick={() => setSelected(item)}
                aria-label={`View public ${item.media_type}`}
              >
                {item.media_type === 'image' ? (
                  <img src={item.url} alt="Public profile moment" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                ) : (
                  <video src={item.url} preload="metadata" className="h-full w-full object-cover" aria-label="Public profile video" />
                )}
              </button>
              {item.media_type === 'video' && (
                <span className="pointer-events-none absolute left-2 top-2 z-[1] flex h-7 w-7 items-center justify-center rounded-full bg-ink/60 text-white">
                  <Play size={14} fill="currentColor" aria-hidden />
                </span>
              )}
              {isOwner && (
                <button
                  type="button"
                  className="absolute right-2 top-2 z-[2] flex h-8 w-8 items-center justify-center rounded-full bg-ink/65 text-white transition hover:bg-alert disabled:opacity-60"
                  aria-label="Remove public media"
                  disabled={deletingId === item.id}
                  onClick={() => void removeMedia(item)}
                >
                  {deletingId === item.id ? <LoaderCircle size={15} className="animate-spin" aria-hidden /> : <Trash2 size={15} aria-hidden />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isOwner && media.length > 0 && media.length < MAX_MEDIA && (
        <p className="mt-2 text-[10px] text-muted">{MAX_MEDIA - media.length} more {MAX_MEDIA - media.length === 1 ? 'spot' : 'spots'} available</p>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Public ${selected.media_type}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelected(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setSelected(null)
          }}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
            onClick={() => setSelected(null)}
            aria-label="Close media viewer"
          >
            <X size={20} aria-hidden />
          </button>
          {selected.media_type === 'image' ? (
            <img src={selected.url} alt="Public profile moment, expanded" className="max-h-[85vh] max-w-full rounded-xl object-contain" />
          ) : (
            <video src={selected.url} controls autoPlay playsInline className="max-h-[85vh] max-w-full rounded-xl" />
          )}
        </div>
      )}
    </section>
  )
}
