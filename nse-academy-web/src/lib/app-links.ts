/** The Android app on Google Play. */
export const PLAY_STORE_ID = "net.vitaldigitalmedia.nse_academy";
const PLAY_STORE_BASE = `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}`;

/**
 * The store link, tagged with where on the site the visitor came from. Play passes `referrer` through to the install, so
 * installs can be traced back to a placement in Play Console (Statistics > Acquisition > UTM parameters).
 */
export function playStoreUrl(placement: string): string {
  const referrer = `utm_source=nseacademy_web&utm_medium=${placement}&utm_campaign=web_to_app`;
  return `${PLAY_STORE_BASE}&referrer=${encodeURIComponent(referrer)}`;
}
