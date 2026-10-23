/**
 * Sending a newcomer from the map to their first level, before anything paints.
 *
 * The map used to do this in an effect, which meant a first visit downloaded
 * the map, hydrated it, drew it, and only then left: a half-drawn map flashed
 * for about 400ms before the level replaced it. An inline script in the head
 * runs before the stylesheet, the bundle or the body, so the map is never
 * fetched or drawn for someone who is not going to see it.
 *
 * It is a string because it runs before any module has loaded, the same way
 * the theme script in `__root.tsx` does. Everything it knows is spliced in from
 * the real constants, so the keys, the breakpoint and the level order cannot
 * drift from what the app reads. The map's effect still runs as a fallback.
 */

import { DESKTOP_QUERY } from '../components/DesktopOnly';
import { LEVELS } from './levels';
import { LEGACY_INTRO_SEEN_KEY, ONBOARDED_KEY, PROGRESS_KEY, VERSION } from './storage';

/**
 * User agents that never get redirected.
 *
 * A crawler has empty storage, so it looks exactly like a newcomer, and level
 * pages are `noindex`. Following the redirect would tell it the front page
 * sends you somewhere that asks not to be indexed. Crawlers and audit tools see
 * the map, which is what a returning player sees too.
 */
const AUTOMATED_UA = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;

export function isAutomated(): boolean {
  return navigator.webdriver || AUTOMATED_UA.test(navigator.userAgent);
}

const config = {
  query: DESKTOP_QUERY,
  version: VERSION,
  onboarded: [ONBOARDED_KEY, LEGACY_INTRO_SEEN_KEY],
  progress: PROGRESS_KEY,
  levels: LEVELS.map((l) => l.id),
};

/**
 * Mirrors `isOnboarded` and `readStored`: a record that is missing, corrupt or
 * from another version reads as absent. Storage that throws on read (blocked in
 * a private window, say) leaves the visitor on the map, since the tour could
 * never be marked done and the redirect would repeat on every visit.
 */
export const NEWCOMER_REDIRECT_SCRIPT = `(function(c){try{
if(location.pathname!=='/')return;
if(navigator.webdriver||${AUTOMATED_UA}.test(navigator.userAgent))return;
if(!matchMedia(c.query).matches)return;
function read(k){var r=localStorage.getItem(k);if(r===null)return null;try{var p=JSON.parse(r);return p&&p.version===c.version?p.data:null}catch(e){return null}}
for(var i=0;i<c.onboarded.length;i++)if(read(c.onboarded[i]))return;
var done=read(c.progress);if(!done||typeof done!=='object')done={};
var to=c.levels[0];
for(var j=0;j<c.levels.length;j++)if(!(c.levels[j] in done)){to=c.levels[j];break}
location.replace('/'+to+location.search+location.hash);
}catch(e){}})(${JSON.stringify(config)});`;
