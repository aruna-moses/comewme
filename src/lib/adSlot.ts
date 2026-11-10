/**
 * Width-to-height ratio of the advertising slot on the Discover feed.
 * The cropper, the form preview and the live feed all read this value so the
 * crop an advertiser picks is exactly what gets shown.
 */
export const AD_SLOT_ASPECT = 420 / 64

/**
 * Today's date in Lagos (UTC+1) as YYYY-MM-DD.
 * Using UTC would hide an ad for the first hour of its first day.
 */
export function lagosTodayISO(): string {
  return new Date(Date.now() + 60 * 60_000).toISOString().slice(0, 10)
}
