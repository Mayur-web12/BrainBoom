'use strict';
const crypto = require('crypto');
const store  = require('../data/store');
const engine = require('../data/gameEngine');
const db     = require('../data/db');
const { verifyCredentials } = require('../middleware/security');

// True only for a socket that has authenticated as the mentor.
function isMentorSocket(socket) {
  return !!store.getMentor(socket.id);
}

// ── RECONNECT GRACE PERIOD ───────────────────────────────────────────────
// A page refresh (or a brief network drop) closes the old WebSocket and opens
// a brand new one with a different socket.id — Socket.IO can't preserve
// identity across that by itself. Without this, 'disconnect' immediately
// deleted the player from the session (wiping their score/spot), and there
// was no way to reclaim it — so any refresh looked and behaved exactly like
// leaving the game. Instead: on disconnect, wait GRACE_PERIOD_MS before
// actually removing the player. If they rejoin (via 'rejoin-session',
// matched by the persistent playerId issued at join time — NOT socket.id,
// which is exactly the thing that changes on refresh) within that window,
// their score and progress carry over as if nothing happened.
const GRACE_PERIOD_MS = 45_000;
const pendingRemovals  = new Map(); // playerId -> Timeout

function removePlayerFromSession(io, socketId, sessionCode) {
  const session = store.getSession(sessionCode);
  if (!session) return;
  const updated = store.updateSession(sessionCode, s => ({
    ...s,
    teams: s.teams.map(t => t.id
      ? { ...t, players: t.players.filter(p => p.socketId !== socketId) }
      : t),
    individualPlayers: (s.individualPlayers || []).filter(p => p.socketId !== socketId),
  }));
  io.to(sessionCode).emit('lobby-update', {
    state: engine.publicView(updated),
    individualPlayers: updated.individualPlayers || [],
  });
}

// Persist a finished game's leaderboard so results survive a restart.
function persistResult(session, leaderboard) {
  db.saveResult({
    code:  session.code,
    title: session.title,
    mode:  session.mode || 'team',
    finishedAt: new Date().toISOString(),
    leaderboard,
    roundHistory: session.roundHistory || [],
  }).catch(err => console.error('[socket] Failed to persist result:', err.message));
}

// code → setInterval handle
const timers = new Map();

function clearTimer(code) {
  if (timers.has(code)) { clearInterval(timers.get(code)); timers.delete(code); }
}

function startTimer(io, code) {
  clearTimer(code);
  const interval = setInterval(() => {
    const session = store.getSession(code);
    if (!session || !session.timerRunning || session.status !== 'playing') {
      clearTimer(code); return;
    }
    const newRemaining = session.timerRemaining - 1;
    if (newRemaining <= 0) {
      clearTimer(code);
      const updated = engine.handleTimerExpiry(session);
      store.updateSession(code, () => updated);
      const summary = engine.roundSummary(updated);
      io.to(code).emit('round-result', {
        state:   engine.publicView(updated, true),
        summary,
        timedOut: true,
      });
    } else {
      store.updateSession(code, s => ({ ...s, timerRemaining: newRemaining }));
      io.to(code).emit('timer-tick', { remaining: newRemaining });
    }
  }, 1000);
  timers.set(code, interval);
}

// ── INDIVIDUAL MODE TIMER ─────────────────────────────────────────────────────
// For individual mode, all players answer simultaneously; timer just cuts off answering
function startIndividualTimer(io, code) {
  clearTimer(code);
  const interval = setInterval(() => {
    const session = store.getSession(code);
    if (!session || !session.timerRunning || session.status !== 'playing') {
      clearTimer(code); return;
    }
    const newRemaining = session.timerRemaining - 1;
    if (newRemaining <= 0) {
      clearTimer(code);
      // Lock answers - anyone who hasn't answered gets 0
      const updated = engine.handleIndividualTimerExpiry(session);
      store.updateSession(code, () => updated);
      io.to(code).emit('individual-round-result', {
        state:   engine.publicView(updated, true),
        summary: engine.individualRoundSummary(updated),
        timedOut: true,
      });
    } else {
      store.updateSession(code, s => ({ ...s, timerRemaining: newRemaining }));
      io.to(code).emit('timer-tick', { remaining: newRemaining });
    }
  }, 1000);
  timers.set(code, interval);
}

module.exports = function initSocket(io) {
  io.on('connection', socket => {
    console.log(`[socket] connect  ${socket.id}`);

    // ── MENTOR AUTH ──────────────────────────────────────────────────────
    socket.on('mentor-auth', ({ email, password } = {}, cb) => {
      if (typeof cb !== 'function') return;
      if (verifyCredentials(email, password)) {
        store.setMentor(socket.id, { email, name: 'Mentor', sessionCode: null });
        cb({ ok: true, name: 'Mentor' });
      } else {
        cb({ ok: false, error: 'Invalid credentials' });
      }
    });

    // ── MENTOR JOINS SESSION ROOM ────────────────────────────────────────
    socket.on('mentor-join-session', ({ code } = {}, cb) => {
      if (typeof cb !== 'function') return;
      const upperCode = code?.toUpperCase();
      const session   = store.getSession(upperCode);
      if (!session) return cb({ ok: false, error: 'Session not found' });
      const mentor = store.getMentor(socket.id);
      if (!mentor) return cb({ ok: false, error: 'Not authenticated' });
      store.setMentor(socket.id, { ...mentor, sessionCode: upperCode });
      socket.join(upperCode);
      store.updateSession(upperCode, s => ({ ...s, mentorId: socket.id }));
      cb({ ok: true, state: engine.publicView(session) });
    });

    // ── STUDENT JOINS SESSION ────────────────────────────────────────────
    socket.on('student-join', ({ code, name, teamId, avatar, mode, playerId } = {}, cb) => {
      if (typeof cb !== 'function') return;
      const upperCode = code?.toUpperCase();
      const session   = store.getSession(upperCode);
      if (!session)                      return cb({ ok: false, error: 'Invalid game code' });
      if (!name?.trim())                 return cb({ ok: false, error: 'Name is required' });
      if (session.status === 'finished') return cb({ ok: false, error: 'Game already ended' });
      if (session.status === 'playing')  return cb({ ok: false, error: 'Game already started — ask mentor to wait' });

      // Always use server-side mode — never trust client-sent mode
      const isIndividual = session.mode === 'individual';

      // Enforce player limit for individual mode
      if (isIndividual && session.maxPlayers) {
        const currentCount = (session.individualPlayers || []).length;
        if (currentCount >= session.maxPlayers) {
          return cb({ ok: false, error: `Maximum player limit reached (${session.maxPlayers}). You cannot join this game.` });
        }
      }

      // Prevent duplicate name in individual mode
      if (isIndividual) {
        const duplicate = (session.individualPlayers || []).find(p => p.name.toLowerCase() === name.trim().toLowerCase());
        if (duplicate) return cb({ ok: false, error: 'A player with this name already joined. Please use a different name.' });
      }

      // For individual mode, the single IND team is used internally
      // For team mode, validate teamId strictly against session teams
      let team;
      if (isIndividual) {
        team = session.teams[0]; // IND team
      } else {
        team = session.teams.find(t => t.id === teamId);
        if (!team) return cb({ ok: false, error: 'Invalid team — this team does not exist in this session' });
      }

      // A persistent ID that survives a page refresh (unlike socket.id, which
      // is different on every new connection) — see rejoin-session below.
      // The client generates and stores this once and sends it back on every
      // join/rejoin attempt from the same browser tab.
      const pid = playerId || crypto.randomUUID();

      const player = {
        socketId: socket.id,
        playerId: pid,
        name: name.trim(),
        teamId: isIndividual ? 'IND' : team.id,
        avatar: avatar || '🦁',
        sessionCode: upperCode,
        score: 0,
        mode: isIndividual ? 'individual' : 'team',
        answered: false,
      };

      store.addPlayer(socket.id, player);

      // For individual mode, add to a special individual players list
      const updated = store.updateSession(upperCode, s => {
        if (isIndividual) {
          const indPlayers = s.individualPlayers || [];
          return {
            ...s,
            individualPlayers: [...indPlayers, { socketId: socket.id, playerId: pid, name: player.name, avatar: player.avatar, score: 0, fiftyFiftyUses: 0 }],
            // Also add to first team for lobby display
            teams: s.teams.map((t, i) => i === 0
              ? { ...t, players: [...t.players, { socketId: socket.id, playerId: pid, name: player.name, avatar: player.avatar }] }
              : t),
          };
        }
        return {
          ...s,
          teams: s.teams.map(t => t.id === teamId
            ? { ...t, players: [...t.players, { socketId: socket.id, playerId: pid, name: player.name, avatar: player.avatar }] }
            : t),
        };
      });

      socket.join(upperCode);
      io.to(upperCode).emit('lobby-update', { state: engine.publicView(updated), individualPlayers: updated.individualPlayers || [] });
      cb({ ok: true, player: { ...player, socketId: socket.id, playerId: pid }, state: engine.publicView(updated), individualPlayers: updated.individualPlayers || [] });
    });

    // ── RECONNECT AFTER A REFRESH / BRIEF DROP ────────────────────────────
    // Matched by playerId (persisted client-side), never by socket.id — the
    // whole point is that socket.id is NOT the same as it was before.
    socket.on('rejoin-session', ({ code, playerId } = {}, cb) => {
      if (typeof cb !== 'function') return;
      if (!playerId) return cb({ ok: false, error: 'No playerId to rejoin with' });
      const upperCode = code?.toUpperCase();
      const session   = store.getSession(upperCode);
      if (!session) return cb({ ok: false, error: 'Session no longer exists' });

      const isIndividual = session.mode === 'individual';
      const inTeams = session.teams.flatMap(t => (t.players || []).map(p => ({ ...p, teamId: t.id })));
      const found   = isIndividual
        ? (session.individualPlayers || []).find(p => p.playerId === playerId)
        : inTeams.find(p => p.playerId === playerId);

      if (!found) return cb({ ok: false, error: 'Could not find your spot in this game — please join again' });

      // Cancel the pending "actually remove them now" timer, if one was running.
      const pending = pendingRemovals.get(playerId);
      if (pending) { clearTimeout(pending); pendingRemovals.delete(playerId); }

      const oldSocketId = found.socketId;
      const teamId       = isIndividual ? 'IND' : found.teamId;

      // Re-key everything under the NEW socket.id so future answer/lifeline
      // events (which are keyed by socket.id) land on the right player.
      const playerRecord = store.getPlayer(oldSocketId) || {
        name: found.name, avatar: found.avatar, sessionCode: upperCode,
        score: found.score || 0, mode: isIndividual ? 'individual' : 'team', teamId,
      };
      store.removePlayer(oldSocketId);
      store.addPlayer(socket.id, { ...playerRecord, socketId: socket.id, playerId, sessionCode: upperCode, teamId });

      const updated = store.updateSession(upperCode, s => ({
        ...s,
        teams: s.teams.map(t => ({
          ...t,
          players: (t.players || []).map(p => p.playerId === playerId ? { ...p, socketId: socket.id } : p),
        })),
        individualPlayers: (s.individualPlayers || []).map(p =>
          p.playerId === playerId ? { ...p, socketId: socket.id } : p
        ),
      }));

      socket.join(upperCode);
      io.to(upperCode).emit('lobby-update', { state: engine.publicView(updated), individualPlayers: updated.individualPlayers || [] });

      cb({
        ok: true,
        player: { name: found.name, avatar: found.avatar, teamId, sessionCode: upperCode, score: found.score || 0, socketId: socket.id, playerId },
        state: engine.publicView(updated, updated.status === 'round_result'),
        individualPlayers: updated.individualPlayers || [],
        mode: session.mode || 'team',
      });
    });

    // ── START GAME ───────────────────────────────────────────────────────
    socket.on('start-game', ({ code } = {}, cb) => {
      if (typeof cb !== 'function') return;
      if (!isMentorSocket(socket))    return cb({ ok: false, error: 'Unauthorized' });
      const upperCode = code?.toUpperCase();
      const session   = store.getSession(upperCode);
      if (!session)                   return cb({ ok: false, error: 'Session not found' });
      if (session.status !== 'lobby') return cb({ ok: false, error: 'Game already started' });
      const players = store.getPlayersInSession(upperCode);
      if (players.length === 0) return cb({ ok: false, error: 'No students have joined yet' });

      const updated = store.updateSession(upperCode, s => ({ ...s, status: 'topic_pick', startedAt: Date.now() }));
      io.to(upperCode).emit('game-started', { state: engine.publicView(updated) });
      cb({ ok: true });
    });

    // ── TEAM PICKS A TOPIC ───────────────────────────────────────────────
    socket.on('pick-topic', ({ code, teamId, topic } = {}, cb) => {
      if (typeof cb !== 'function') return;
      const upperCode = code?.toUpperCase();
      const session   = store.getSession(upperCode);
      if (!session) return cb({ ok: false, error: 'Session not found' });

      const { session: updated, question, error } = engine.teamPicksTopic(session, teamId, topic);
      if (error) return cb({ ok: false, error });

      store.updateSession(upperCode, () => updated);
      io.to(upperCode).emit('question-started', {
        state: engine.publicView(updated, false),
        topic,
        teamId,
        teamName: session.teams.find(t=>t.id===teamId)?.name,
      });

      // Use appropriate timer based on session mode
      if (session.mode === 'individual') {
        // Reset all player answered flags
        store.updateSession(upperCode, s => ({
          ...s,
          currentRoundAnswers: {},
        }));
        startIndividualTimer(io, upperCode);
      } else {
        startTimer(io, upperCode);
      }
      cb({ ok: true });
    });

    // ── 50/50 LIFELINE — team removes two wrong options (up to FIFTY_FIFTY_MAX_USES/game) ──
    socket.on('use-lifeline', ({ code, teamId, type } = {}, cb) => {
      if (typeof cb !== 'function') return;
      const upperCode = code?.toUpperCase();
      const session   = store.getSession(upperCode);
      if (!session) return cb({ ok: false, error: 'Session not found' });
      if (type !== 'fiftyFifty') return cb({ ok: false, error: 'Unknown lifeline' });

      const isIndividual = session.mode === 'individual';
      const { session: updated, removedIndices, usesLeft, error } = isIndividual
        ? engine.useFiftyFiftyIndividual(session, socket.id)
        : engine.useFiftyFifty(session, teamId);
      if (error) return cb({ ok: false, error });

      store.updateSession(upperCode, () => updated);
      cb({ ok: true, removedIndices, usesLeft });
      io.to(upperCode).emit('lifeline-used', {
        teamId: isIndividual ? socket.id : teamId, type, removedIndices, usesLeft,
        state: engine.publicView(updated, false),
      });
    });

    // ── MENTOR ARMS/DISARMS DOUBLE POINTS FOR THE NEXT QUESTION ──────────
    socket.on('toggle-double-points', ({ code, on } = {}, cb) => {
      if (typeof cb !== 'function') return;
      if (!isMentorSocket(socket)) return cb({ ok: false, error: 'Unauthorized' });
      const upperCode = code?.toUpperCase();
      const session   = store.getSession(upperCode);
      if (!session) return cb({ ok: false, error: 'Session not found' });

      const updated = store.updateSession(upperCode, s => engine.toggleDoublePoints(s, on));
      cb({ ok: true });
      io.to(upperCode).emit('double-points-toggled', { on: !!on, state: engine.publicView(updated) });
    });

    // ── STUDENT SUBMITS ANSWER (TEAM MODE) ───────────────────────────────
    socket.on('submit-answer', ({ code, teamId, answerIdx } = {}, cb) => {
      if (typeof cb !== 'function') return;
      const upperCode = code?.toUpperCase();
      const session   = store.getSession(upperCode);
      if (!session)                        return cb({ ok: false, error: 'Session not found' });
      if (session.status !== 'playing')    return cb({ ok: false, error: 'Not accepting answers' });
      const currentTeam = session.teams[session.currentTeamIdx];
      if (currentTeam.id !== teamId)       return cb({ ok: false, error: `It is ${currentTeam.name}'s turn` });

      clearTimer(upperCode);
      const { session: updated, result } = engine.processAnswer(session, teamId, answerIdx);
      store.updateSession(upperCode, () => updated);

      cb({ ok: true, result: { correct: result.correct, totalChange: result.totalChange, newScore: result.newScore } });

      io.to(upperCode).emit('round-result', {
        state:   engine.publicView(updated, true),
        summary: engine.roundSummary(updated),
        result,
        timedOut: false,
      });
    });

    // ── INDIVIDUAL PLAYER SUBMITS ANSWER ─────────────────────────────────
    socket.on('submit-individual-answer', ({ code, answerIdx } = {}, cb) => {
      if (typeof cb !== 'function') return;
      const upperCode = code?.toUpperCase();
      const session   = store.getSession(upperCode);
      if (!session)                     return cb({ ok: false, error: 'Session not found' });
      if (session.status !== 'playing') return cb({ ok: false, error: 'Not accepting answers' });

      const player = store.getPlayer(socket.id);
      if (!player) return cb({ ok: false, error: 'Player not found' });

      // Check if already answered this round
      const currentAnswers = session.currentRoundAnswers || {};
      if (currentAnswers[socket.id] !== undefined) {
        return cb({ ok: false, error: 'Already answered this question' });
      }

      const q       = session.currentQuestion;
      if (!q) return cb({ ok: false, error: 'No active question' });

      const correct = q.ans.includes(answerIdx);
      const diff    = q.diff;
      const POINTS  = engine.POINTS;

      const speedBonus = correct
        ? Math.floor((session.timerRemaining / session.timerSeconds) * (POINTS[diff].correct * 0.5))
        : 0;
      const baseChange  = correct ? POINTS[diff].correct : POINTS[diff].wrong;
      let totalChange   = correct ? baseChange + speedBonus : baseChange;

      // ── Double Points — this whole handler is a separate scoring path from
      // Team mode's processAnswer() in gameEngine.js, which already applies
      // this multiplier. This path never checked it at all, so arming Double
      // Points from Live Control had zero effect on Solo mode scores even
      // though the toggle itself worked fine. ──
      const doublePointsActive = !!session.doublePointsActive;
      if (doublePointsActive) totalChange *= 2;

      // ── Comeback Catch-Up Bonus — flat bonus for whoever's in last place, final rounds only ──
      const comebackEligible = correct && engine.comebackEligiblePlayerIds(session).includes(socket.id);
      if (comebackEligible) totalChange += engine.COMEBACK_BONUS_POINTS;

      // Update this player's score
      const newScore = Math.max(0, (player.score || 0) + totalChange);
      store.updatePlayer(socket.id, { ...player, score: newScore, answered: true });

      // Record this player's answer in the session
      const updatedSession = store.updateSession(upperCode, s => ({
        ...s,
        currentRoundAnswers: {
          ...(s.currentRoundAnswers || {}),
          [socket.id]: { answerIdx, correct, totalChange, newScore, comebackBonus: comebackEligible, doublePoints: doublePointsActive, name: player.name, avatar: player.avatar },
        },
        individualPlayers: (s.individualPlayers || []).map(p =>
          p.socketId === socket.id ? { ...p, score: newScore } : p
        ),
      }));

      // Send only a receipt back — NOT the result. Revealing correct/wrong/points
      // here would leak the answer before everyone has answered or time is up.
      // The actual reveal happens via the 'individual-round-result' broadcast below
      // (either when the last player answers, or when the timer expires).
      cb({ ok: true, received: true });

      // Emit answer update to mentor so they see live who answered
      const answers = updatedSession.currentRoundAnswers || {};
      const totalPlayers = (updatedSession.individualPlayers || []).length;
      const answeredCount = Object.keys(answers).length;

      io.to(upperCode).emit('individual-answer-update', {
        socketId: socket.id,
        playerName: player.name,
        avatar: player.avatar,
        correct,
        totalChange,
        comebackBonus: comebackEligible,
        doublePoints: doublePointsActive,
        newScore,
        answeredCount,
        totalPlayers,
        leaderboard: [...(updatedSession.individualPlayers || [])].sort((a,b)=>b.score-a.score),
      });

      // If all players have answered, stop timer and show results
      if (answeredCount >= totalPlayers && totalPlayers > 0) {
        clearTimer(upperCode);
        const finalSession = store.updateSession(upperCode, s => ({
          ...s,
          status: 'round_result',
          timerRunning: false,
        }));
        io.to(upperCode).emit('individual-round-result', {
          state:   engine.publicView(finalSession, true),
          summary: engine.individualRoundSummary(finalSession),
          timedOut: false,
        });
      }
    });

    // ── MENTOR: ADVANCE AFTER ROUND RESULT ──────────────────────────────
    socket.on('next-round', ({ code } = {}, cb) => {
      if (typeof cb !== 'function') return;
      if (!isMentorSocket(socket)) return cb({ ok: false, error: 'Unauthorized' });
      const upperCode = code?.toUpperCase();
      const session   = store.getSession(upperCode);
      if (!session) return cb({ ok: false, error: 'Session not found' });
      if (session.status !== 'round_result') return cb({ ok: false, error: 'Not in round_result phase' });

      clearTimer(upperCode);
      const updated = engine.advanceToTopicPick(session);
      store.updateSession(upperCode, () => updated);

      if (updated.status === 'finished') {
        const lb = session.mode === 'individual'
          ? engine.individualFinalLeaderboard(updated)
          : engine.finalLeaderboard(updated);
        persistResult(updated, lb);
        io.to(upperCode).emit('game-over', { leaderboard: lb, mode: session.mode || 'team' });
        cb({ ok: true, finished: true });
      } else {
        io.to(upperCode).emit('topic-pick-phase', { state: engine.publicView(updated) });
        cb({ ok: true, finished: false });
      }
    });

    // ── MENTOR: PAUSE / RESUME TIMER ────────────────────────────────────
    socket.on('pause-timer', ({ code } = {}, cb) => {
      if (typeof cb !== 'function') return;
      if (!isMentorSocket(socket)) return cb({ ok: false, error: 'Unauthorized' });
      clearTimer(code?.toUpperCase());
      const updated = store.updateSession(code?.toUpperCase(), s => ({ ...s, timerRunning: false }));
      if (!updated) return cb({ ok: false, error: 'Not found' });
      io.to(code.toUpperCase()).emit('timer-paused', { remaining: updated.timerRemaining });
      cb({ ok: true });
    });

    socket.on('resume-timer', ({ code } = {}, cb) => {
      if (typeof cb !== 'function') return;
      if (!isMentorSocket(socket)) return cb({ ok: false, error: 'Unauthorized' });
      const upperCode = code?.toUpperCase();
      const session   = store.getSession(upperCode);
      if (!session) return cb({ ok: false, error: 'Not found' });
      store.updateSession(upperCode, s => ({ ...s, timerRunning: true }));
      startTimer(io, upperCode);
      io.to(upperCode).emit('timer-resumed', { remaining: session.timerRemaining });
      cb({ ok: true });
    });

    // ── MENTOR: SET TIMER ────────────────────────────────────────────────
    socket.on('set-timer', ({ code, seconds } = {}, cb) => {
      if (typeof cb !== 'function') return;
      if (!isMentorSocket(socket)) return cb({ ok: false, error: 'Unauthorized' });
      const upperCode = code?.toUpperCase();
      if (!seconds || seconds < 5 || seconds > 120) return cb({ ok: false, error: 'Timer must be 5–120s' });
      const updated = store.updateSession(upperCode, s => ({ ...s, timerSeconds: Number(seconds) }));
      if (!updated) return cb({ ok: false, error: 'Not found' });
      io.to(upperCode).emit('timer-settings-updated', { timerSeconds: updated.timerSeconds });
      cb({ ok: true, timerSeconds: updated.timerSeconds });
    });

    // ── MENTOR: SKIP CURRENT QUESTION ───────────────────────────────────
    socket.on('skip-question', ({ code } = {}, cb) => {
      if (typeof cb !== 'function') return;
      if (!isMentorSocket(socket)) return cb({ ok: false, error: 'Unauthorized' });
      const upperCode = code?.toUpperCase();
      clearTimer(upperCode);
      const session = store.getSession(upperCode);
      if (!session) return cb({ ok: false, error: 'Not found' });
      const withSkip = store.updateSession(upperCode, s => ({
        ...s, status: 'round_result', timerRunning: false,
        roundHistory: [...s.roundHistory, { roundNumber: s.roundNumber, teamId: session.teams[session.currentTeamIdx]?.id, skipped: true, totalChange: 0, correct: false }],
        currentTeamIdx: (session.currentTeamIdx + 1) % session.teams.length,
        currentQuestion: null,
      }));
      const next = engine.advanceToTopicPick(withSkip);
      store.updateSession(upperCode, () => next);
      if (next.status === 'finished') {
        const lb = engine.finalLeaderboard(next);
        persistResult(next, lb);
        io.to(upperCode).emit('game-over', { leaderboard: lb });
      } else {
        io.to(upperCode).emit('topic-pick-phase', { state: engine.publicView(next) });
      }
      cb({ ok: true });
    });

    // ── DISCONNECT ───────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[socket] disconnect ${socket.id}`);
      const player = store.getPlayer(socket.id);
      if (player && player.playerId) {
        // Don't remove them immediately — a page refresh looks EXACTLY like
        // a disconnect from the server's point of view, and immediately
        // wiping them out is what turned "I refreshed the page" into
        // "I lost my spot and score and got kicked to the home screen".
        // Give them a window to reconnect (see rejoin-session) before
        // actually removing them from the session.
        const timer = setTimeout(() => {
          pendingRemovals.delete(player.playerId);
          // Only remove if nobody reconnected under a new socket.id in the
          // meantime — rejoin-session already re-keys the player record, so
          // if store.getPlayer(socket.id) is gone, a rejoin happened.
          if (!store.getPlayer(socket.id)) return;
          store.removePlayer(socket.id);
          removePlayerFromSession(io, socket.id, player.sessionCode);
        }, GRACE_PERIOD_MS);
        pendingRemovals.set(player.playerId, timer);
      } else if (player) {
        // No playerId (shouldn't normally happen) — fall back to the old,
        // immediate-removal behavior rather than leaving a ghost player.
        store.removePlayer(socket.id);
        removePlayerFromSession(io, socket.id, player.sessionCode);
      }
      store.removeMentor(socket.id);
    });
  });
};
