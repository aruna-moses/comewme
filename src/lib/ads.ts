import { supabase } from './supabase'

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
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('advertisements')
    .select(FIELDS)
    .eq('status', 'approved')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('created_at', { ascending: false })
    .limit(12)
  if (error) throw error
  return (data ?? []) as Ad[]
}

/** Every ad a given advertiser has submitted, newest first. */
export async function fetchMyAds(userId: string): Promise<Ad[]> {
  const { data, error } = await supabase
    .from('advertisements')
    .select(FIELDS)
    .eq('advertiser_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Ad[]
}

/** Moderator queue — RLS returns all rows for moderators. */
export async function fetchAdsForReview(): Promise<Ad[]> {
  const { data, error } = await supabase
    .from('advertisements')
    .select(FIELDS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Ad[]
}

async function uploadAdImage(userId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')
  const path = `${userId}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from('ad-media').upload(path, file)
  if (error) throw error
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
  if (error) throw error
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
  if (error) throw error
}
