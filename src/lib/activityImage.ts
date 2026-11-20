import { supabase } from './supabase'

const MAX_SIDE = 1080
const JPEG_QUALITY = 0.82

/**
 * Crop to a square and compress to a bounded JPEG before upload.
 * A 1080x1080 flier stays well under 1 MB on a phone and uploads in seconds.
 */
export async function prepareActivityImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(MAX_SIDE, Math.min(bitmap.width, bitmap.height))
  const sx = Math.floor((bitmap.width - side) / 2)
  const sy = Math.floor((bitmap.height - side) / 2)
  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare the photo')
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, side, side)
  bitmap.close?.()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob) throw new Error('Could not save the photo')
  return blob
}

/** Upload the flier to the public activity bucket and return its permanent URL. */
export async function uploadActivityImage(file: File): Promise<string> {
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData.user?.id
  if (!uid) throw new Error('Sign in to add a photo')
  const blob = await prepareActivityImage(file)
  const path = `${uid}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from('activity-media')
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false })
  if (error) throw error
  return supabase.storage.from('activity-media').getPublicUrl(path).data.publicUrl
}
