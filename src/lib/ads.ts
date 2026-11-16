import { supabase } from './supabase'
import { lagosTodayISO } from './adSlot'
import { toError } from './errors'

export type AdStatus = 'pending' | 'approved' | 'rejected' | 'paused'

export interface Ad {
  id: string
  advertiser_id: string | null
  brand_name: string
  headline: string
  cta_text: string
  destination_url: string
  image_url: string | null
  brand_color: string
  start_date: string
  end_date: string
  status: AdStatus
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
}

export interface NewAd {
  brandName: string
  headline: string
  ctaText: string
  destinationUrl: string
  brandColor: string
  startDate: string
  endDate: string
}

const FIELDS =
  'id, advertiser_id, brand_name, headline, cta_text, destination_url, image_url, brand_color, start_date, end_date, status, admin_note, created_at, reviewed_at'

/** Ads that are approved and inside their run window — used by the Discover carousel. */
export async function fetchActiveAds(): Promise<Ad[]> {
  const today = lagosTodayISO()
  const { data, error } = await supabase
    .from('advertisements')
    .select(FIELDS)
    .eq('status', 'approved')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('created_at', { ascending: false })
    .limit(12)
  if (error) throw toError(error)
  return (data ?? []) as Ad[]
}

/** Every ad a given advertiser has submitted, newest first. */
export async function fetchMyAds(userId: string): Promise<Ad[]> {
  const { data, error } = await supabase
    .from('advertisements')
    .select(FIELDS)
    .eq('advertiser_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw toError(error)
  return (data ?? []) as Ad[]
}

/** Moderator queue — RLS returns all rows for moderators. */
export async function fetchAdsForReview(): Promise<Ad[]> {
  const { data, error } = await supabase
    .from('advertisements')
    .select(FIELDS)
    .order('created_at', { ascending: false })
  if (error) throw toError(error)
  return (data ?? []) as Ad[]
}

async function uploadAdImage(userId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')
  const path = `${userId}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from('ad-media').upload(path, file)
  if (error) throw toError(error)
  const { data } = supabase.storage.from('ad-media').getPublicUrl(path)
  return data.publicUrl
}

/** Upload the creative (if any) then insert the pending ad. */
export async function submitAd(
  userId: string,
  input: NewAd,
  imageFile: File | null,
): Promise<Ad> {
  const imageUrl = imageFile ? await uploadAdImage(userId, imageFile) : null

  const { data, error } = await supabase
    .from('advertisements')
    .insert({
      advertiser_id: userId,
      brand_name: input.brandName.trim(),
      headline: input.headline.trim(),
      cta_text: input.ctaText,
      destination_url: input.destinationUrl.trim(),
      image_url: imageUrl,
      brand_color: input.brandColor,
      start_date: input.startDate,
      end_date: input.endDate,
      status: 'pending',
    })
    .select(FIELDS)
    .single()
  if (error) throw toError(error)
  return data as Ad
}

export async function reviewAd(
  adId: string,
  status: 'approved' | 'rejected' | 'paused',
  note: string | null,
) {
  const { error } = await supabase
    .from('advertisements')
    .update({
      status,
      admin_note: note,
      reviewed_at: new Date().toISOString(),
      reviewed_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    .eq('id', adId)
  if (error) throw toError(error)
}

/** Advertisers can pull back a submission that has not been reviewed yet. */
export async function withdrawAd(ad: Ad) {
  const { error } = await supabase.from('advertisements').delete().eq('id', ad.id)
  if (error) throw toError(error)
  // Drop the creative too - the row is the only thing pointing at it.
  const marker = '/object/public/ad-media/'
  const index = ad.image_url?.indexOf(marker) ?? -1
  if (index >= 0 && ad.image_url) {
    const path = ad.image_url.slice(index + marker.length)
    try {
      await supabase.storage.from('ad-media').remove([path])
    } catch {
      // A leftover file is harmless; the submission is already gone.
    }
  }
}

/**
 * Where an ad is in its life, in the words an advertiser understands.
 * Approved ads still need their dates checked - approval does not mean live.
 */
export type AdRunState = 'pending' | 'scheduled' | 'live' | 'ended' | 'paused' | 'rejected'

export function adRunState(ad: Ad, today = lagosTodayISO()): AdRunState {
  if (ad.status === 'pending') return 'pending'
  if (ad.status === 'rejected') return 'rejected'
  if (ad.status === 'paused') return 'paused'
  if (today < ad.start_date) return 'scheduled'
  if (today > ad.end_date) return 'ended'
  return 'live'
}

export const AD_RUN_LABEL: Record<AdRunState, string> = {
  pending: 'In review',
  scheduled: 'Scheduled',
  live: 'Live now',
  ended: 'Finished',
  paused: 'Paused',
  rejected: 'Changes needed',
}

export function daysBetween(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`)
  const b = Date.parse(`${end}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86_400_000) + 1
}

/**
 * Turn whatever someone typed into a link we can actually open.
 * "tasteoflagos.com" and "wa.me/234..." both become https URLs; anything that
 * cannot be a website returns null so the form can explain itself.
 */
export function normalizeDestinationUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  // Accept a bare domain, a full URL, or a WhatsApp short link.
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}
