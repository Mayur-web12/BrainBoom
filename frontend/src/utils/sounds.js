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

// Eagerly create (and start fetching) all three clips as soon as this module
// loads, instead of waiting for the first real playCorrect()/playWrong() call.
// That lazy creation was the main reason the very first correct/wrong sound
// of a session felt like it "took a moment to start" — right after the answer
// was revealed, the browser had to fetch the mp3 from scratch before it could
// play it. Now the fetch starts the moment the game screen's JS loads, well
// before anyone has answered a question, so by the time a sound is actually
// needed the file is already sitting in the browser cache.
if (typeof window !== 'undefined') {
  Object.keys(FILES).forEach(key => getAudio(key));
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
      const wasMuted = a.muted;
      // Priming must be SILENT — its only job is to satisfy the browser's
      // "audio needs a real user gesture" requirement and warm the network
      // buffer. Muting doesn't stop the file from downloading, it just stops
      // it from being heard, so this still does its job without producing an
      // audible "beep" the instant someone taps anywhere on the page (e.g.
      // the landing page mode cards, before any game sound should ever play).
      a.muted = true;
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
      setTimeout(() => {
        try { a.pause(); a.currentTime = 0; a.muted = wasMuted; } catch (_) {}
      }, 150);
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
