/**
 * Client-side image handling helpers.
 *
 * Why: Supabase doesn't resize/compress for us client side yet, and phone
 * photos routinely come in at 4–12MB. Keeping the raw file bloats both
 * bandwidth and storage for a 72px thumbnail used in chat.
 */

/** Load an Image from a File object. Rejects on non-image / corrupt files. */
function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('That is not an image file.'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }
    img.src = url
  })
}

export interface CompressionResult {
  blob: Blob
  width: number
  height: number
  bytesBefore: number
  bytesAfter: number
}

/**
 * Resize to a max-width box and JPEG-compress. JPEG keeps sizes tiny vs PNG
 * and is safe in chat media since we don't persist artwork files.
 */
export async function compressImage(file: File, options?: { maxPx?: number; quality?: number }): Promise<CompressionResult> {
  const maxPx = options?.maxPx ?? 1600
  const quality = options?.quality ?? 0.82

  const img = await loadImageFromFile(file)
  const ratio = Math.min(1, maxPx / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * ratio))
  const height = Math.max(1, Math.round(img.height * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser can’t process this image.')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('Could not compress this image.')

  return {
    blob,
    width,
    height,
    bytesBefore: file.size,
    bytesAfter: blob.size,
  }
}

/** Return the file extension for a MIME type, safe from anything weird. */
export function extensionFor(mime: string): string {
  const subtype = mime.split('/')[1] ?? 'jpeg'
  const cleaned = subtype.replace(/[^a-z0-9]/g, '')
  return cleaned || 'jpeg'
}
