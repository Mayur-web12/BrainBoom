// Lets a student's browser tab reconnect to the game it was in after a page
// refresh, instead of landing back on the home screen. sessionStorage (not
// localStorage) is used deliberately — it's cleared when the tab actually
// closes, so this only ever resumes "the game I was just in", never an old
// game from days ago in a browser someone forgot about.
const KEY = 'quizquest_rejoin';

function makePlayerId() {
  // Not a security token — just needs to be unique per browser tab so the
  // server can tell "the same player refreshing" apart from "a new player
  // joining". crypto.randomUUID() where available, a fallback otherwise.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export function getOrCreatePlayerId() {
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed?.playerId) return parsed.playerId;
    }
  } catch (_) {}
  return makePlayerId();
}

export function saveRejoinInfo({ code, playerId, mode }) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ code, playerId, mode, savedAt: Date.now() }));
  } catch (_) {}
}

export function loadRejoinInfo() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.code || !parsed?.playerId) return null;
    // Don't try to rejoin something from many hours ago — the grace period
    // server-side is much shorter than this; this is just a sanity ceiling.
    if (Date.now() - (parsed.savedAt || 0) > 6 * 60 * 60 * 1000) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

export function clearRejoinInfo() {
  try { sessionStorage.removeItem(KEY); } catch (_) {}
}
