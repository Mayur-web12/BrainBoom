'use strict';

/**
 * sounds.js — lightweight sound-effect player for game feedback.
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop three royalty-free MP3 files into frontend/public/sounds/ (see the
 * README.txt in that folder for exact download links — no attribution
 * required) and this module plays them automatically:
 *
 *   /public/sounds/correct.mp3   → played when a player/team answers right
 *   /public/sounds/wrong.mp3     → played when a player/team answers wrong
 *   /public/sounds/winner.mp3    → played once on the final leaderboard screen
 *
 * If a file is missing, playback silently no-ops (caught) so the game never
 * breaks — this is purely a "nice to have" layer on top of existing logic.
 * Mute preference is remembered in localStorage under 'qq_sound_muted'.
 */

const FILES = {
  correct: '/sounds/correct.mp3',
  wrong:   '/sounds/wrong.mp3',
  winner:  '/sounds/winner.mp3',
};

const MUTE_KEY = 'qq_sound_muted';

// Preload + reuse Audio objects instead of creating a new one per play.
const cache = {};
function getAudio(key) {
  if (!cache[key]) {
    const a = new Audio(FILES[key]);
    a.preload = 'auto';
    a.volume = key === 'winner' ? 0.9 : 0.7;
    cache[key] = a;
  }
  return cache[key];
}

export function isMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (_) { return false; }
}

export function setMuted(muted) {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (_) {}
}

function play(key) {
  if (isMuted()) { console.info(`[sounds] Skipped "${key}" — sound is muted (🔊 button in nav).`); return; }
  try {
    const a = getAudio(key);
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(err => {
        console.warn(
          `[sounds] Could not play "${FILES[key]}". Most likely the file is missing — ` +
          `add it at frontend/public${FILES[key]} (see public/sounds/README.txt). ` +
          `If the file DOES exist, this is probably the browser's autoplay policy blocking ` +
          `sound that isn't triggered by a direct click (common for the winner fanfare, which ` +
          `fires after a network round-trip) — clicking anywhere on the page first should fix it. ` +
          `Browser said: ${err?.message || err}`
        );
      });
    }
  } catch (err) {
    console.warn(`[sounds] Unexpected error playing "${key}":`, err);
  }
}

// ── AUTOPLAY UNLOCK ──────────────────────────────────────────────────────────
// Browsers only allow audio.play() unprompted once the page has seen *some*
// user gesture. Answer buttons (Practice/game clicks) already provide that for
// correct/wrong sounds, but the winner fanfare can fire right after a socket
// event with no click in the same tick, so it can get silently blocked even
// when the file is present. This primes (plays+immediately pauses) every sound
// on the very first tap/click/keypress anywhere on the page, so by the time a
// programmatic play() happens later, the browser already considers audio
// "unlocked" for this tab.
let unlocked = false;
function unlockAll() {
  if (unlocked) return;
  unlocked = true;
  Object.keys(FILES).forEach(key => {
    try {
      const a = getAudio(key);
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
      a.pause();
      a.currentTime = 0;
    } catch (_) {}
  });
  ['pointerdown', 'keydown', 'touchstart'].forEach(evt =>
    document.removeEventListener(evt, unlockAll)
  );
}
if (typeof document !== 'undefined') {
  ['pointerdown', 'keydown', 'touchstart'].forEach(evt =>
    document.addEventListener(evt, unlockAll, { once: false, passive: true })
  );
}

export const playCorrect = () => play('correct');
export const playWrong   = () => play('wrong');
export const playWinner  = () => play('winner');
