'use strict';
const express  = require('express');
const {
  rateLimit, validateQuestion, validateSession,
  verifyCredentials, createMentorToken, requireMentorToken,
} = require('../middleware/security');
const router   = express.Router();
const store    = require('../data/store');
const db        = require('../data/db');
const { TEAM_PRESETS } = require('../data/questions');
const { createGameSession } = require('../data/gameEngine');

const MENTOR_NAME = process.env.MENTOR_NAME || 'Mentor';

// Non-blocking check: is this request carrying a valid mentor token?
// Used where a route needs different behavior for mentor vs. public callers,
// rather than flatly requiring or flatly rejecting a token.
const { isValidMentorToken } = require('../middleware/security');
function callerIsMentor(req) {
  const token = req.headers['x-mentor-token'];
  return !!token && isValidMentorToken(token);
}

// Wrap async route handlers so a rejected Promise reaches Express's error
// handler instead of crashing the process (Express 4 doesn't do this for you).
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ── AUTH ──────────────────────────────────────────────────────────────────
router.post('/auth/login', rateLimit({ windowMs:60000, max:5, message:'Too many login attempts. Wait 1 minute.' }), (req, res) => {
  const { email, password } = req.body;
  if (verifyCredentials(email, password)) {
    const token = createMentorToken();
    return res.json({ ok: true, token, mentor: { email, name: MENTOR_NAME } });
  }
  res.status(401).json({ ok: false, error: 'Invalid credentials' });
});

// ── QUESTION BANK ─────────────────────────────────────────────────────────
// Reading the bank is public (students use it for Practice mode, mentor for the builder).
// SECURITY: the answer key (`ans`) and explanation (`exp`, which often restates the
// answer) must NEVER go to an unauthenticated caller — otherwise anyone can open
// devtools, call this endpoint directly, and see every correct answer in the game
// ahead of time. Only requests carrying a valid mentor token (the admin builder,
// and Shared Screen mode which runs on the mentor's own authenticated device) get
// the full data. Practice Mode gets answers back per-question, only after an
// actual attempt, via POST /practice/check-answer below.
router.get('/questions', ah(async (req, res) => {
  const { topic, diff } = req.query;
  let q = await db.getQuestions();
  if (topic) q = q.filter(x => x.topic === topic);
  if (diff && diff !== 'all') q = q.filter(x => x.diff === diff);
  if (!callerIsMentor(req)) {
    q = q.map(({ ans, exp, ...safe }) => safe);
  }
  res.json({ ok: true, questions: q, total: q.length });
}));

// Practice Mode answer check — the ONLY way an unauthenticated client learns a
// correct answer is by actually submitting an attempt for that ONE question,
// same as the real live-game reveal-after-answer pattern. Never leaks the bank.
router.post('/practice/check-answer', rateLimit({ windowMs:60000, max:120 }), ah(async (req, res) => {
  const { questionId, answerIdx } = req.body || {};
  if (!questionId || typeof answerIdx !== 'number') {
    return res.status(400).json({ ok:false, error:'questionId and answerIdx required' });
  }
  const q = await db.findQuestion(questionId);
  if (!q) return res.status(404).json({ ok:false, error:'Question not found' });
  const correct = q.ans.includes(answerIdx);
  res.json({ ok:true, correct, correctIdx: q.ans[0], explanation: q.exp || '' });
}));

// 50/50 lifeline for unauthenticated/local-play clients (Shared Screen, Team, Solo
// modes that grade themselves in the browser). The client never receives `ans` for
// these callers (see GET /questions above) so it cannot compute which two options
// are safe to hide — it asks the server to do it instead. The response only ever
// contains WRONG option indices to remove; it never reveals which option(s) are
// correct, so it leaks no more information than the lifeline is supposed to give.
router.post('/questions/:id/fifty-fifty', rateLimit({ windowMs:60000, max:120 }), ah(async (req, res) => {
  const q = await db.findQuestion(req.params.id);
  if (!q) return res.status(404).json({ ok:false, error:'Question not found' });
  const wrongIndices = q.opts.map((_, i) => i).filter(i => !q.ans.includes(i));
  if (wrongIndices.length < 2) return res.status(400).json({ ok:false, error:'Not enough wrong options for 50/50' });
  const shuffled = [...wrongIndices].sort(() => Math.random() - 0.5);
  const removed  = shuffled.slice(0, shuffled.length - 1); // leave exactly one wrong option standing
  res.json({ ok:true, removed });
}));

// Mutating the bank requires a valid mentor token.
// Add a new question to the bank
router.post('/questions', requireMentorToken, rateLimit({ windowMs:60000, max:30 }), validateQuestion, ah(async (req, res) => {
  const { id, topic, diff, q, opts, ans, exp, pts } = req.body;
  if (!q || !topic || !diff || !opts || !ans) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }
  const newQ = { id: id || 'custom-' + Date.now(), topic, diff, q, opts, ans, exp: exp || '', pts: pts || (diff==='easy'?100:diff==='medium'?150:200), mediaUrl: req.body.mediaUrl || null, mediaType: req.body.mediaType || null };
  await db.addQuestion(newQ);
  const total = (await db.getQuestions()).length;
  res.json({ ok: true, question: newQ, total });
}));

// Update (edit) an existing question
router.put('/questions/:id', requireMentorToken, rateLimit({ windowMs:60000, max:30 }), ah(async (req, res) => {
  const { id } = req.params;
  const existing = await db.findQuestion(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'Question not found' });
  const { topic, diff, q, opts, ans, exp, pts } = req.body;
  if (!q || !topic || !diff || !opts || !ans) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }
  const updated = await db.updateQuestion(id, {
    topic, diff, q, opts, ans,
    exp: exp || '',
    pts: pts || (diff==='easy'?100:diff==='medium'?150:200),
    mediaUrl: req.body.mediaUrl || existing.mediaUrl || null,
    mediaType: req.body.mediaType || existing.mediaType || null,
  });
  res.json({ ok: true, question: updated });
}));

// Delete a question from the bank
router.delete('/questions/:id', requireMentorToken, ah(async (req, res) => {
  const { id } = req.params;
  const ok = await db.deleteQuestion(id);
  if (!ok) return res.status(404).json({ ok: false, error: 'Question not found' });
  const total = (await db.getQuestions()).length;
  res.json({ ok: true, deleted: id, total });
}));

// ── TOPICS ──────────────────────────────────────────────────────────────────
router.get('/topics', ah(async (req, res) => {
  res.json({ ok: true, topics: await db.getTopics() });
}));

// Add a custom topic (mentor only) — e.g. "Sabha"
router.post('/topics', requireMentorToken, rateLimit({ windowMs:60000, max:20 }), ah(async (req, res) => {
  const { name, emoji, color } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 40) {
    return res.status(400).json({ ok: false, error: 'Topic name must be 2–40 characters' });
  }
  const topic = await db.addTopic({ name, emoji, color });
  res.json({ ok: true, topic, topics: await db.getTopics() });
}));

router.get('/team-presets', (req, res) => {
  res.json({ ok: true, presets: TEAM_PRESETS });
});

// ── SESSIONS ─────────────────────────────────────────────────────────────
// Lists every session across the whole app, including live game codes and
// player names/scores — this is exactly the kind of thing that should only
// go to an authenticated mentor, not anyone who happens to hit this URL.
// It was missing requireMentorToken while every other mentor-only route
// (create/delete session, add/edit questions, etc.) already had it — meaning
// any anonymous visitor could previously enumerate every currently-running
// game's join code, without ever logging in.
router.get('/sessions', requireMentorToken, (req, res) => {
  res.json({ ok: true, sessions: store.getAllSessions().map(s => ({
    code:          s.code,
    title:         s.title,
    status:        s.status,
    teamCount:     s.teams.length,
    questionCount: s.questions.length,
    timerSeconds:  s.timerSeconds,
    createdAt:     s.createdAt,
    diffFilter:    s.diffFilter,
    mode:          s.mode || 'team',
    teams:         s.teams.map(t => ({
      id:          t.id,
      name:        t.name,
      color:       t.color,
      emoji:       t.emoji,
      score:       t.score,
      playerCount: t.players.length,
      // Include individual player names/scores for Results tab
      players:     t.players.map(p => ({ name:p.name, avatar:p.avatar, score:p.score||0 })),
    })),
    // For individual/solo mode — expose the real per-player scores
    individualPlayers: s.mode === 'individual'
      ? [...(s.individualPlayers || [])].sort((a,b) => (b.score||0) - (a.score||0))
          .map(p => ({ name:p.name, avatar:p.avatar, score:p.score||0 }))
      : undefined,
    // Round history for detailed results
    roundHistory: s.status === 'finished' ? (s.roundHistory||[]) : [],
    finishedAt:   s.finishedAt || null,
    maxPlayers:   s.maxPlayers || null,
  }))});
});

router.post('/sessions', requireMentorToken, rateLimit({ windowMs:60000, max:10 }), validateSession, ah(async (req, res) => {
  try {
    const { title, teams, timerSeconds = 30, topicFilter = [], diffFilter = 'all', questionIds, questionsPerTeam = 10, mode = 'team', maxPlayers = 25 } = req.body;

    if (!title || !title.trim())           return res.status(400).json({ ok:false, error:'Title is required' });
    if (!['team','individual'].includes(mode)) return res.status(400).json({ ok:false, error:'Invalid session mode' });
    // Individual mode uses a single dummy team; team mode needs 2+
    if (mode === 'team') {
      if (!teams || teams.length < 2)      return res.status(400).json({ ok:false, error:'At least 2 teams required' });
      if (teams.length > 6)                return res.status(400).json({ ok:false, error:'Max 6 teams' });
    }
    if (timerSeconds < 5 || timerSeconds > 120) return res.status(400).json({ ok:false, error:'Timer must be 5–120 seconds' });

    // Build question pool from the persisted bank
    const bank = await db.getQuestions();
    let pool = [...bank];
    if (questionIds?.length) {
      // Explicit selection overrides filters
      pool = bank.filter(q => questionIds.includes(q.id));
    } else {
      if (topicFilter.length > 0) pool = pool.filter(q => topicFilter.includes(q.topic));
      if (diffFilter !== 'all')   pool = pool.filter(q => q.diff === diffFilter);
    }
    if (pool.length === 0)      return res.status(400).json({ ok:false, error:'No questions match filters' });

    // Shuffle all matching questions
    pool = pool.sort(() => Math.random() - 0.5);

    // NOTE: For individual (solo) mode, do NOT slice the pool here.
    // All questions are kept so every topic remains accessible.
    // The questionsPerTeam limit is enforced at runtime via roundNumber in the engine.

    // Generate unique code
    let code;
    do { code = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6).padEnd(6,'X'); }
    while (store.getSession(code));

    // For individual mode, create a single virtual team to satisfy engine requirements
    const teamsForSession = mode === 'individual'
      ? [{ id:'IND', name:'Solo Players', color:'#4CAF50', emoji:'🏅' }]
      : (teams || []).map((t, i) => ({
          id:    t.id    || String.fromCharCode(65 + i),
          name:  t.name  || `Team ${String.fromCharCode(65 + i)}`,
          color: t.color || TEAM_PRESETS[i % TEAM_PRESETS.length].color,
          emoji: t.emoji || TEAM_PRESETS[i % TEAM_PRESETS.length].emoji,
        }));

    const session = createGameSession({
      code, title: title.trim(), mentorId: null,
      teams: teamsForSession,
      questions: pool,
      timerSeconds:     Number(timerSeconds),
      questionsPerTeam: Number(questionsPerTeam),
      topicFilter,
      diffFilter,
      mode,
    });

    session.createdAt = new Date().toISOString();
    session.mode = mode;
    // Was individual-mode-only before — Team mode sessions can have plenty
    // of real-world players spread across a handful of teams, and a mentor
    // may want a hard cap there too (e.g. "only 25 people total can join
    // this game"), same as Solo mode already allowed.
    session.maxPlayers = maxPlayers != null ? Number(maxPlayers) : null;
    session.individualPlayers = [];
    store.createSession(code, session);

    res.json({ ok: true, session: { code, title: session.title, teams: session.teams, questionCount: session.questions.length, timerSeconds: session.timerSeconds, questionsPerTeam: session.questionsPerTeam, mode, maxPlayers: session.maxPlayers } });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}));

router.get('/sessions/:code', (req, res) => {
  const s = store.getSession(req.params.code.toUpperCase());
  if (!s) return res.status(404).json({ ok: false, error: 'Session not found' });
  res.json({ ok: true, session: {
    code:        s.code,
    title:       s.title,
    status:      s.status,
    mode:        s.mode || 'team',
    maxPlayers:  s.maxPlayers || null,
    currentPlayers: (s.individualPlayers || []).length,
    teams:       s.teams.map(t => ({ id:t.id, name:t.name, color:t.color, emoji:t.emoji, playerCount:t.players.length })),
    timerSeconds:s.timerSeconds,
    questionCount:s.questions.length,
    diffFilter:  s.diffFilter,
    topicFilter: s.topicFilter,
  }});
});

router.delete('/sessions/:code', requireMentorToken, (req, res) => {
  const code = req.params.code.toUpperCase();
  if (!store.getSession(code)) return res.status(404).json({ ok: false, error: 'Session not found' });
  store.deleteSession(code);
  res.json({ ok: true });
});

router.patch('/sessions/:code/timer', requireMentorToken, (req, res) => {
  const code = req.params.code.toUpperCase();
  const { timerSeconds } = req.body;
  if (!timerSeconds || timerSeconds < 5 || timerSeconds > 120) {
    return res.status(400).json({ ok: false, error: 'Timer must be 5–120' });
  }
  const updated = store.updateSession(code, s => ({ ...s, timerSeconds: Number(timerSeconds) }));
  if (!updated) return res.status(404).json({ ok: false, error: 'Session not found' });
  res.json({ ok: true, timerSeconds: updated.timerSeconds });
});

// ── SAVED RESULTS (durable history of finished games) ───────────────────────
// Player names and scores from past games — same sensitivity as the live
// sessions list above, and same fix: this wasn't gated to mentors either
// (it just happens nothing in the current UI calls it yet).
router.get('/results', requireMentorToken, ah(async (req, res) => {
  res.json({ ok: true, results: await db.getResults() });
}));

// ── HEALTH ─────────────────────────────────────────────────────────────────
router.get('/health', ah(async (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), sessions: store.getAllSessions().length, questions: (await db.getQuestions()).length, dbBackend: db.backend });
}));

module.exports = router;
