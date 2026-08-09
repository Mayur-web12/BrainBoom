'use strict';
/**
 * Security middleware — protects against XSS, injection, rate limiting, etc.
 */
const crypto = require('crypto');

// ── MENTOR CREDENTIALS (hashed, constant-time compare) ────────────────────────
// The plaintext password is never stored — only a salted scrypt hash kept in
// memory for the life of the process.  Set MENTOR_EMAIL / MENTOR_PASSWORD in .env.
const MENTOR_EMAIL_LC = (process.env.MENTOR_EMAIL || 'mentor@quiz.com').trim().toLowerCase();
const PW_SALT = crypto.randomBytes(16);
const PW_HASH = crypto.scryptSync(process.env.MENTOR_PASSWORD || 'quiz123', PW_SALT, 64);

function safeEqualStr(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function verifyCredentials(email, password) {
  const emailOk = safeEqualStr(String(email || '').trim().toLowerCase(), MENTOR_EMAIL_LC);
  let passOk = false;
  try {
    const attempt = crypto.scryptSync(String(password || ''), PW_SALT, 64);
    passOk = crypto.timingSafeEqual(attempt, PW_HASH);
  } catch (_) { passOk = false; }
  return emailOk && passOk;
}

// ── RATE LIMITER (in-memory) ──────────────────────────────────────────────────
const store = new Map();

function rateLimit({ windowMs = 60000, max = 60, message = 'Too many requests' } = {}) {
  return (req, res, next) => {
    const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    let entry = store.get(key);
    if (!entry || now > entry.resetAt) { entry = { count:0, resetAt: now + windowMs }; store.set(key, entry); }
    entry.count++;
    if (store.size > 5000) { for (const [k,v] of store) { if (now > v.resetAt) store.delete(k); } }
    if (entry.count > max) return res.status(429).json({ ok:false, error:message, retryAfter: Math.ceil((entry.resetAt-now)/1000) });
    next();
  };
}

// ── INPUT SANITIZER (blocks XSS in strings) ───────────────────────────────────
function sanitizeStr(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/javascript:/gi,'').replace(/on\w+\s*=/gi,'').trim();
}
function sanitizeObj(obj) {
  if (!obj) return obj;
  if (typeof obj === 'string') return sanitizeStr(obj);
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObj);
  const out = {};
  for (const [k,v] of Object.entries(obj)) {
    if (['__proto__','constructor','prototype'].includes(k)) continue; // block prototype pollution
    out[sanitizeStr(k)] = sanitizeObj(v);
  }
  return out;
}
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeObj(req.body);
  next();
}

// ── INJECTION BLOCKER ─────────────────────────────────────────────────────────
const INJECTION = [
  /(\$where|\$gt|\$lt|\$ne|\$in|\$nin|\$or|\$and)/i,
  /(union\s+select|drop\s+table|insert\s+into|delete\s+from|exec\s*\()/i,
  /\.\.\//,
];
function blockInjection(req, res, next) {
  const s = JSON.stringify({body:req.body, query:req.query, params:req.params});
  for (const p of INJECTION) {
    if (p.test(s)) {
      console.warn(`[SECURITY] Injection blocked from ${req.ip}: ${p}`);
      return res.status(400).json({ ok:false, error:'Invalid input' });
    }
  }
  next();
}

// ── SECURITY HEADERS ──────────────────────────────────────────────────────────
function securityHeaders(req, res, next) {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options',  'nosniff');
  res.setHeader('X-Frame-Options',         'DENY');
  res.setHeader('X-XSS-Protection',        '1; mode=block');
  res.setHeader('Referrer-Policy',         'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "connect-src 'self' ws: wss:",
    // allow question images (incl. base64 data URIs and remote https thumbnails)
    "img-src 'self' data: https:",
    // allow uploaded/remote video + base64/blob media used by question media
    "media-src 'self' data: blob: https:",
    // allow embedded YouTube question videos
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  ].join('; '));
  next();
}

// ── INPUT VALIDATORS ──────────────────────────────────────────────────────────
function validateQuestion(req, res, next) {
  const { q, topic, diff, opts, ans } = req.body;
  if (!q || typeof q !== 'string' || q.length < 5 || q.length > 500) return res.status(400).json({ ok:false, error:'Question must be 5-500 chars' });
  if (!topic || typeof topic !== 'string' || topic.length > 50)       return res.status(400).json({ ok:false, error:'Topic required (max 50 chars)' });
  if (!['easy','medium','hard'].includes(diff))                        return res.status(400).json({ ok:false, error:'Difficulty must be easy/medium/hard' });
  if (!Array.isArray(opts) || opts.length < 2 || opts.length > 6)     return res.status(400).json({ ok:false, error:'Need 2-6 options' });
  if (opts.some(o => typeof o !== 'string' || o.length > 200))        return res.status(400).json({ ok:false, error:'Each option max 200 chars' });
  if (!Array.isArray(ans) || ans.length === 0)                        return res.status(400).json({ ok:false, error:'Mark at least one correct answer' });
  if (ans.some(a => typeof a !== 'number' || a < 0 || a >= opts.length)) return res.status(400).json({ ok:false, error:'Answer index out of range' });
  next();
}

function validateSession(req, res, next) {
  const { title, teams, timerSeconds, mode = 'team', maxPlayers } = req.body;
  if (!title || typeof title !== 'string' || title.length < 2 || title.length > 100)
    return res.status(400).json({ ok:false, error:'Title must be 2-100 chars' });
  // Team mode requires 2-6 teams; individual mode has no team requirement
  if (mode === 'team') {
    if (!Array.isArray(teams) || teams.length < 2 || teams.length > 6)
      return res.status(400).json({ ok:false, error:'Need 2-6 teams' });
  }
  if (timerSeconds && (typeof timerSeconds !== 'number' || timerSeconds < 5 || timerSeconds > 120))
    return res.status(400).json({ ok:false, error:'Timer: 5-120 seconds' });
  if (maxPlayers !== undefined && (typeof maxPlayers !== 'number' || maxPlayers < 2 || maxPlayers > 200))
    return res.status(400).json({ ok:false, error:'Max players must be 2-200' });
  next();
}

// ── MENTOR TOKEN SYSTEM ───────────────────────────────────────────────────────
const mentorTokens = new Set();

function createMentorToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const token = Array.from({length:48}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  mentorTokens.add(token);
  setTimeout(() => mentorTokens.delete(token), 8*60*60*1000); // 8 hour expiry
  return token;
}

function isValidMentorToken(token) {
  return !!token && mentorTokens.has(token);
}

function requireMentorToken(req, res, next) {
  const token = req.headers['x-mentor-token'];
  if (!isValidMentorToken(token)) return res.status(401).json({ ok:false, error:'Unauthorized — mentor token required' });
  next();
}

module.exports = { rateLimit, sanitizeBody, blockInjection, securityHeaders, validateQuestion, validateSession, createMentorToken, requireMentorToken, isValidMentorToken, verifyCredentials };
