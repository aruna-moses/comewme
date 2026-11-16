/**
 * Width-to-height ratio of the advertising slot on the Discover feed.
 * The cropper, the form preview and the live feed all read this value so the
 * crop an advertiser picks is exactly what gets shown.
 *
 * The strip is full-bleed (edge to edge), so the height scales with the phone:
 * ~73px on a 390px screen, ~90px on a 480px column.
 */
export const AD_SLOT_ASPECT = 420 / 78

/**
 * Today's date in Lagos (UTC+1) as YYYY-MM-DD.
 * Using UTC would hide an ad for the first hour of its first day.
 */
export function lagosTodayISO(): string {
  return new Date(Date.now() + 60 * 60_000).toISOString().slice(0, 10)
}
