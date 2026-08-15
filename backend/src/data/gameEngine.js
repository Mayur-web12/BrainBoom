'use strict';
/**
 * QuizQuest Game Engine — Jeopardy-Style Topic Pick Mode
 * ───────────────────────────────────────────────────────
 * Each round:
 *   1. Current team picks a topic from available topics
 *   2. Server picks a random unused question from that topic
 *   3. Team answers within timer
 *   4. Correct  → +points (based on difficulty + speed bonus)
 *   5. Wrong    → -points (based on difficulty, no speed penalty)
 *   6. Next team picks a topic
 *   7. Repeat until all questions exhausted or all topics done
 *
 * Points table:
 *   easy   correct +100  | wrong  -50
 *   medium correct +150  | wrong  -75
 *   hard   correct +200  | wrong  -100
 *
 * A team's score cannot go below 0.
 */

const POINTS = {
  easy:   { correct: 100, wrong: -50  },
  medium: { correct: 150, wrong: -75  },
  hard:   { correct: 200, wrong: -100 },
};

// 50/50 lifeline — shared team/player budget PER GAME, resets on every new session.
const FIFTY_FIFTY_MAX_USES = 3;

// ─────────────────────────────────────────────────────────────────
// Comeback Catch-Up Bonus — a flat point bonus for whoever is in LAST
// place, but only during the final stretch of the game. Deliberately:
//   - flat, not a multiplier (predictable, doesn't snowball)
//   - only applies on a CORRECT answer (still a real quiz, not a handout)
//   - only in the final rounds (a genuine "final stretch" comeback,
//     not a crutch that removes the point of playing well all game)
//   - ties for last place all qualify (no arbitrary tie-break)
// ─────────────────────────────────────────────────────────────────
const COMEBACK_BONUS_POINTS       = 125;
const COMEBACK_BONUS_FINAL_ROUNDS = 3; // applies during the last N rounds of the game

function isFinalStretch(session) {
  const isIndividual = session.mode === 'individual';
  const maxRounds = isIndividual
    ? session.questionsPerTeam
    : session.questionsPerTeam * session.teams.length;
  // session.roundNumber is bumped at PICK time (teamPicksTopic), so once a
  // question is active it already IS the round in progress. Before a pick,
  // it still reflects the last COMPLETED round, so the round about to be
  // played is roundNumber+1.
  const roundInProgress = session.currentQuestion ? session.roundNumber : session.roundNumber + 1;
  return roundInProgress > maxRounds - COMEBACK_BONUS_FINAL_ROUNDS;
}

// Team mode: which team id(s) currently qualify (ties for lowest score all qualify).
function comebackEligibleTeamIds(session) {
  if (!isFinalStretch(session)) return [];
  const scores = session.teams.map(t => t.score);
  const lowest = Math.min(...scores);
  return session.teams.filter(t => t.score === lowest).map(t => t.id);
}

// Individual mode: which socketId(s) currently qualify.
function comebackEligiblePlayerIds(session) {
  if (!isFinalStretch(session)) return [];
  const players = session.individualPlayers || [];
  if (players.length === 0) return [];
  const lowest = Math.min(...players.map(p => p.score || 0));
  return players.filter(p => (p.score || 0) === lowest).map(p => p.socketId);
}

// ─────────────────────────────────────────────────────────────────
// createGameSession
// ─────────────────────────────────────────────────────────────────
function createGameSession({ code, title, mentorId, teams, questions, timerSeconds, topicFilter, diffFilter, questionsPerTeam, mode }) {
  // Group questions by topic for easy lookup
  const byTopic = {};
  questions.forEach(q => {
    if (!byTopic[q.topic]) byTopic[q.topic] = [];
    byTopic[q.topic].push(q.id);
  });

  // Build available topics list
  // Individual (solo) mode: any topic with ≥1 question is available (flexible pick)
  // Team mode: require ≥3 questions per topic (original behaviour)
  const minQPerTopic = mode === 'individual' ? 1 : 3;
  const availableTopics = Object.keys(byTopic).filter(t => byTopic[t].length >= minQPerTopic);

  // Topics that will NEVER be pickable this game because the chosen
  // difficulty filter left them with too few questions — as opposed to a
  // topic that starts out available and later gets used up during play.
  // The UI needs this distinction: showing both as "All done ✓" reads as
  // "you've finished this topic" when the real reason is "this topic never
  // had enough Hard questions to begin with" — confusing, especially when a
  // narrow difficulty filter (e.g. Hard-only) is applied and several topics
  // fall below the threshold before the game even starts.
  const ineligibleTopics = Object.keys(byTopic).filter(t => byTopic[t].length < minQPerTopic);

  return {
    code,
    title,
    mentorId,
    mode: mode || 'team',
    status:          'lobby',   // lobby | topic_pick | playing | round_result | finished
    teams:           teams.map(t => ({ ...t, score: 0, players: [], roundScores: [], streak: 0, lifelines: { fiftyFiftyUses: 0 } })),
    questions,                  // full question array
    usedQuestionIds: [],        // ids already asked — never repeat
    byTopic,                    // { topicName: [questionIds] }
    availableTopics,            // topics still having unused questions
    ineligibleTopics,           // topics that never had enough questions for this session's filters — distinct from "used up during play"
    timerSeconds,
    topicFilter,
    diffFilter,
    questionsPerTeam: questionsPerTeam || 10,  // max questions each team can pick

    // runtime per-round
    currentTeamIdx:     0,      // whose turn to pick topic
    currentQuestion:    null,   // full question object currently active
    chosenTopic:        null,   // topic the current team picked
    timerRunning:       false,
    timerRemaining:     0,
    roundHistory:       [],     // { teamId, topic, diff, correct, pts, totalScore }
    roundNumber:        0,
    startedAt:          null,
    finishedAt:         null,

    // ── Quick-win features ──────────────────────────────────────────
    doublePoints:        false, // mentor-armed — applies to the NEXT question picked
    doublePointsActive:  false, // snapshot taken when a question is actually picked
  };
}

// ─────────────────────────────────────────────────────────────────
// teamPicksTopic — team selects a topic, server picks a question
// Returns { session, question } or { error }
// ─────────────────────────────────────────────────────────────────
function teamPicksTopic(session, teamId, topic) {
  // Validate it's this team's turn
  const currentTeam = session.teams[session.currentTeamIdx];
  if (currentTeam.id !== teamId) {
    return { error: `It is ${currentTeam.name}'s turn to pick, not yours` };
  }
  if (session.status !== 'topic_pick') {
    return { error: 'Not in topic selection phase' };
  }

  // Enforce questionsPerTeam limit for individual mode — block if already at max
  if (session.mode === 'individual' && session.roundNumber >= session.questionsPerTeam) {
    return { error: 'Maximum questions reached for this session' };
  }

  if (!session.availableTopics.includes(topic)) {
    return { error: `Topic "${topic}" has no more questions` };
  }

  // Find unused questions in this topic
  const topicQIds  = session.byTopic[topic] || [];
  const unusedIds  = topicQIds.filter(id => !session.usedQuestionIds.includes(id));
  if (unusedIds.length === 0) {
    return { error: `No more unused questions in ${topic}` };
  }

  // Pick a random unused question from this topic
  const pickedId = unusedIds[Math.floor(Math.random() * unusedIds.length)];
  const question = session.questions.find(q => q.id === pickedId);

  const updated = {
    ...session,
    status:         'playing',
    chosenTopic:    topic,
    currentQuestion: question,
    usedQuestionIds: [...session.usedQuestionIds, pickedId],
    timerRunning:   true,
    timerRemaining: session.timerSeconds,
    roundNumber:    session.roundNumber + 1,
    doublePointsActive: !!session.doublePoints, // snapshot for THIS question only
    doublePoints:       false,                  // consume the mentor's one-shot toggle
  };

  // Remove topic from available if all its questions are now used
  const remaining = unusedIds.filter(id => id !== pickedId);
  if (remaining.length === 0) {
    updated.availableTopics = session.availableTopics.filter(t => t !== topic);
  }

  return { session: updated, question };
}

// ─────────────────────────────────────────────────────────────────
// processAnswer — team submits their answer
// Returns { session, result }
// ─────────────────────────────────────────────────────────────────
function processAnswer(session, teamId, answerIdx) {
  const currentTeam = session.teams[session.currentTeamIdx];
  if (!currentTeam || currentTeam.id !== teamId) {
    return { session, result: { error: 'Not your turn to answer' } };
  }
  if (session.status !== 'playing') {
    return { session, result: { error: 'Not in playing phase' } };
  }

  const q       = session.currentQuestion;
  if (!q) return { session, result: { error: 'No active question' } };

  const correct = q.ans.includes(answerIdx);
  const diff    = q.diff;

  // Speed bonus: up to 50 extra pts if correct and fast
  const speedBonus = correct
    ? Math.floor((session.timerRemaining / session.timerSeconds) * (POINTS[diff].correct * 0.5))
    : 0;

  const baseChange = correct ? POINTS[diff].correct : POINTS[diff].wrong;
  let totalChange  = correct ? baseChange + speedBonus : baseChange; // wrong is negative

  // ── Streak multiplier — 3 in a row = 1.2x, 5 in a row = 1.5x (correct answers only) ──
  const prevStreak     = currentTeam.streak || 0;
  const newStreak      = correct ? prevStreak + 1 : 0;
  const streakMultiplier = correct ? (newStreak >= 5 ? 1.5 : newStreak >= 3 ? 1.2 : 1) : 1;
  if (correct && streakMultiplier > 1) totalChange = Math.round(totalChange * streakMultiplier);

  // ── Double points — mentor-armed, applies to both correct and wrong on this question ──
  const doublePoints = !!session.doublePointsActive;
  if (doublePoints) totalChange *= 2;

  // ── Comeback Catch-Up Bonus — flat bonus for whoever's in last place, final rounds only ──
  const comebackEligible = correct && comebackEligibleTeamIds(session).includes(teamId);
  if (comebackEligible) totalChange += COMEBACK_BONUS_POINTS;

  // Apply score — floor at 0
  const updatedTeams = session.teams.map(t => {
    if (t.id !== teamId) return t;
    const newScore = Math.max(0, t.score + totalChange);
    return { ...t, score: newScore, streak: newStreak };
  });

  const roundEntry = {
    roundNumber:  session.roundNumber,
    teamId,
    teamName:     currentTeam.name,
    topic:        q.topic,
    diff:         q.diff,
    question:     q.q,
    correctAns:   q.opts[q.ans[0]],
    answerIdx,
    correct,
    baseChange,
    speedBonus:   correct ? speedBonus : 0,
    streak:          newStreak,
    streakMultiplier: correct ? streakMultiplier : 1,
    doublePoints,
    comebackBonus: comebackEligible,
    totalChange,
    totalScore:   updatedTeams.find(t => t.id === teamId).score,
  };

  // Advance to next team
  const nextTeamIdx = (session.currentTeamIdx + 1) % session.teams.length;

  // Check if game should end:
  // - Individual mode: end when roundNumber reaches questionsPerTeam (1 team, N rounds)
  // - Team mode: end when all teams have played questionsPerTeam rounds each
  const isIndividual = session.mode === 'individual';
  const maxRounds = isIndividual
    ? session.questionsPerTeam
    : session.questionsPerTeam * session.teams.length;
  const isDone = session.availableTopics.length === 0 || session.roundNumber >= maxRounds;

  const updated = {
    ...session,
    teams:           updatedTeams,
    roundHistory:    [...session.roundHistory, roundEntry],
    timerRunning:    false,
    status:          'round_result',
    currentTeamIdx:  nextTeamIdx,
    currentQuestion: null,
    chosenTopic:     null,
    doublePointsActive: false, // consumed
    _gameOver:       isDone,  // flag for socket to check
  };

  return {
    session: updated,
    result: {
      correct,
      baseChange,
      speedBonus:   correct ? speedBonus : 0,
      streak:          newStreak,
      streakMultiplier: correct ? streakMultiplier : 1,
      doublePoints,
      comebackBonus: comebackEligible,
      totalChange,
      teamId,
      teamName:     currentTeam.name,
      newScore:     updatedTeams.find(t => t.id === teamId).score,
      correctAnswer: q.opts[q.ans[0]],
      explanation:  q.exp,
      gameOver:     isDone,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// handleTimerExpiry — team ran out of time = treat as wrong answer
// ─────────────────────────────────────────────────────────────────
function handleTimerExpiry(session) {
  const currentTeam = session.teams[session.currentTeamIdx];
  const q           = session.currentQuestion;
  if (!q || !currentTeam) return { ...session, status: 'round_result', timerRunning: false };

  const diff       = q.diff;
  let baseChange   = POINTS[diff].wrong; // negative
  const doublePoints = !!session.doublePointsActive;
  if (doublePoints) baseChange *= 2;

  const updatedTeams = session.teams.map(t => {
    if (t.id !== currentTeam.id) return t;
    return { ...t, score: Math.max(0, t.score + baseChange), streak: 0 };
  });

  const roundEntry = {
    roundNumber: session.roundNumber,
    teamId:      currentTeam.id,
    teamName:    currentTeam.name,
    topic:       q.topic,
    diff:        q.diff,
    question:    q.q,
    correctAns:  q.opts[q.ans[0]],
    answerIdx:   -1,
    correct:     false,
    timedOut:    true,
    baseChange,
    speedBonus:  0,
    streak:          0,
    streakMultiplier: 1,
    doublePoints,
    totalChange: baseChange,
    totalScore:  updatedTeams.find(t => t.id === currentTeam.id).score,
  };

  const nextTeamIdx = (session.currentTeamIdx + 1) % session.teams.length;
  const _isIndividual = session.mode === 'individual';
  const maxRounds = _isIndividual
    ? session.questionsPerTeam
    : session.questionsPerTeam * session.teams.length;
  const isDone      = session.availableTopics.length === 0 || session.roundNumber >= maxRounds;

  return {
    ...session,
    teams:           updatedTeams,
    roundHistory:    [...session.roundHistory, roundEntry],
    timerRunning:    false,
    status:          'round_result',
    currentTeamIdx:  nextTeamIdx,
    currentQuestion: null,
    chosenTopic:     null,
    doublePointsActive: false, // consumed
    _gameOver:       isDone,
    _timedOut:       true,
    _timedOutTeam:   currentTeam,
    _lastRoundEntry: roundEntry,
  };
}

// ─────────────────────────────────────────────────────────────────
// toggleDoublePoints — mentor arms/disarms a 2x-points question.
// Takes effect the next time a team picks a topic (see teamPicksTopic).
// ─────────────────────────────────────────────────────────────────
function toggleDoublePoints(session, on) {
  return { ...session, doublePoints: !!on };
}

// ─────────────────────────────────────────────────────────────────
// useFiftyFifty — removes two wrong options, leaving one correct +
// one wrong. Up to FIFTY_FIFTY_MAX_USES per team (team mode) or per
// player (individual mode) PER GAME — resets automatically because
// it's stored on the session, and every new session starts fresh.
// Returns { session, removedIndices, usesLeft } or { error }.
// ─────────────────────────────────────────────────────────────────
function useFiftyFifty(session, teamId) {
  const currentTeam = session.teams[session.currentTeamIdx];
  if (!currentTeam || currentTeam.id !== teamId) {
    return { error: 'Not your turn' };
  }
  if (session.status !== 'playing' || !session.currentQuestion) {
    return { error: 'No active question' };
  }
  const usesSoFar = currentTeam.lifelines?.fiftyFiftyUses || 0;
  if (usesSoFar >= FIFTY_FIFTY_MAX_USES) {
    return { error: `50/50 already used ${FIFTY_FIFTY_MAX_USES}/${FIFTY_FIFTY_MAX_USES} times this game` };
  }
  const q = session.currentQuestion;
  const wrongIndices = q.opts.map((_, i) => i).filter(i => !q.ans.includes(i));
  if (wrongIndices.length < 2) {
    return { error: 'Not enough wrong options to remove' };
  }
  // Shuffle and remove all but one wrong option
  const shuffled = [...wrongIndices].sort(() => Math.random() - 0.5);
  const removedIndices = shuffled.slice(0, shuffled.length - 1);

  const newUses = usesSoFar + 1;
  const updatedTeams = session.teams.map(t =>
    t.id === teamId ? { ...t, lifelines: { ...t.lifelines, fiftyFiftyUses: newUses } } : t
  );

  return {
    session: { ...session, teams: updatedTeams },
    removedIndices,
    usesLeft: FIFTY_FIFTY_MAX_USES - newUses,
  };
}

// ─────────────────────────────────────────────────────────────────
// useFiftyFiftyIndividual — same lifeline, individual/solo mode. Each
// player has their own FIFTY_FIFTY_MAX_USES budget per game, tracked
// on session.individualPlayers (keyed by socketId).
// ─────────────────────────────────────────────────────────────────
function useFiftyFiftyIndividual(session, socketId) {
  if (session.status !== 'playing' || !session.currentQuestion) {
    return { error: 'No active question' };
  }
  const players = session.individualPlayers || [];
  const player = players.find(p => p.socketId === socketId);
  if (!player) return { error: 'Player not found' };

  const usesSoFar = player.fiftyFiftyUses || 0;
  if (usesSoFar >= FIFTY_FIFTY_MAX_USES) {
    return { error: `50/50 already used ${FIFTY_FIFTY_MAX_USES}/${FIFTY_FIFTY_MAX_USES} times this game` };
  }
  const q = session.currentQuestion;
  const wrongIndices = q.opts.map((_, i) => i).filter(i => !q.ans.includes(i));
  if (wrongIndices.length < 2) {
    return { error: 'Not enough wrong options to remove' };
  }
  const shuffled = [...wrongIndices].sort(() => Math.random() - 0.5);
  const removedIndices = shuffled.slice(0, shuffled.length - 1);

  const newUses = usesSoFar + 1;
  const updatedPlayers = players.map(p =>
    p.socketId === socketId ? { ...p, fiftyFiftyUses: newUses } : p
  );

  return {
    session: { ...session, individualPlayers: updatedPlayers },
    removedIndices,
    usesLeft: FIFTY_FIFTY_MAX_USES - newUses,
  };
}

// ─────────────────────────────────────────────────────────────────
// advanceToTopicPick — move from round_result to topic_pick
// ─────────────────────────────────────────────────────────────────
function advanceToTopicPick(session) {
  // Check both the _gameOver flag and explicit round limits
  const isIndividual = session.mode === 'individual';
  const maxRounds = isIndividual
    ? session.questionsPerTeam
    : session.questionsPerTeam * session.teams.length;
  const reachedLimit = session.roundNumber >= maxRounds;
  const noTopicsLeft = session.availableTopics.length === 0;

  if (session._gameOver || noTopicsLeft || reachedLimit) {
    return { ...session, status: 'finished', finishedAt: Date.now() };
  }
  return {
    ...session,
    status:      'topic_pick',
    _gameOver:   false,
    _timedOut:   false,
    _timedOutTeam:    null,
    _lastRoundEntry:  null,
  };
}

// ─────────────────────────────────────────────────────────────────
// publicView — what to send to clients (hides answer during playing)
// ─────────────────────────────────────────────────────────────────
function publicView(session, revealAnswer = false) {
  const q = session.currentQuestion;

  // Compute whether the game has reached its round limit (works for both team & solo)
  const isIndividual = session.mode === 'individual';
  const maxRounds = isIndividual
    ? session.questionsPerTeam
    : session.questionsPerTeam * session.teams.length;
  const reachedRoundLimit = session.roundNumber >= maxRounds;
  const gameOver = session._gameOver || reachedRoundLimit || session.availableTopics.length === 0 || session.status === 'finished';

  return {
    code:            session.code,
    title:           session.title,
    status:          session.status,
    diffFilter:      session.diffFilter || 'all', // lets the UI show only the difficulty tier(s) this session can actually draw from
    teams:           session.teams.map(t => ({
      id:          t.id,
      name:        t.name,
      color:       t.color,
      emoji:       t.emoji,
      score:       t.score,
      streak:      t.streak || 0,
      lifelines:   { fiftyFiftyUses: t.lifelines?.fiftyFiftyUses || 0, fiftyFiftyLeft: FIFTY_FIFTY_MAX_USES - (t.lifelines?.fiftyFiftyUses || 0) },
      playerCount: (t.players || []).length,
    })),
    currentTeamIdx:  session.currentTeamIdx,
    currentTeamId:   session.teams[session.currentTeamIdx]?.id,
    currentTeamName: session.teams[session.currentTeamIdx]?.name,
    currentTeamColor:session.teams[session.currentTeamIdx]?.color,
    currentTeamEmoji:session.teams[session.currentTeamIdx]?.emoji,

    availableTopics: session.availableTopics,
    ineligibleTopics: session.ineligibleTopics || [],
    chosenTopic:     session.chosenTopic,
    roundNumber:     session.roundNumber,
    maxRounds,
    totalQuestions:  session.questions.length,
    usedCount:       session.usedQuestionIds.length,
    gameOver,        // true when the game has ended or is at its round limit
    doublePoints:       !!session.doublePoints,       // armed for the next question
    doublePointsActive: !!session.doublePointsActive, // active on the CURRENT question

    // Comeback Catch-Up Bonus — true only when the team ABOUT TO ANSWER is
    // currently in last place during the game's final rounds. Lets the
    // frontend show a "🎯 Comeback Bonus available!" banner before they answer.
    comebackBonusEligibleTeamIds: comebackEligibleTeamIds(session),
    comebackBonusForCurrentTeam:  comebackEligibleTeamIds(session).includes(session.teams[session.currentTeamIdx]?.id),
    comebackBonusPoints: COMEBACK_BONUS_POINTS,

    timerRunning:    session.timerRunning,
    timerRemaining:  session.timerRemaining,
    timerSeconds:    session.timerSeconds,
    questionsPerTeam: session.questionsPerTeam,

    question: q ? {
      id:    q.id,
      text:  q.q,
      opts:  q.opts,
      topic: q.topic,
      diff:  q.diff,
      pts:   q.pts,
      mediaUrl:  q.mediaUrl  || null,
      mediaType: q.mediaType || null,
      ans:   revealAnswer ? q.ans   : undefined,
      exp:   revealAnswer ? q.exp   : undefined,
    } : null,

    roundHistory:  session.roundHistory,
    lastRound:     session.roundHistory[session.roundHistory.length - 1] || null,
    mode:          session.mode || 'team',
    individualPlayers: (session.individualPlayers || []).map(p => ({
      socketId: p.socketId,
      name:     p.name,
      avatar:   p.avatar,
      score:    p.score || 0,
      fiftyFiftyUses: p.fiftyFiftyUses || 0,
      fiftyFiftyLeft: FIFTY_FIFTY_MAX_USES - (p.fiftyFiftyUses || 0),
    })),
    comebackBonusEligiblePlayerIds: comebackEligiblePlayerIds(session),
  };
}

// ─────────────────────────────────────────────────────────────────
// finalLeaderboard
// ─────────────────────────────────────────────────────────────────
function finalLeaderboard(session) {
  return [...session.teams]
    .sort((a, b) => b.score - a.score)
    .map((t, i) => {
      const rounds     = session.roundHistory.filter(r => r.teamId === t.id);
      const correct    = rounds.filter(r => r.correct).length;
      const wrong      = rounds.filter(r => !r.correct).length;
      const totalEarned= rounds.filter(r => r.correct).reduce((s,r) => s + r.totalChange, 0);
      const totalLost  = rounds.filter(r => !r.correct).reduce((s,r) => s + Math.abs(r.totalChange), 0);
      return {
        rank:        i + 1,
        id:          t.id,
        name:        t.name,
        color:       t.color,
        emoji:       t.emoji,
        score:       t.score,
        players:     t.players || [],
        correct,
        wrong,
        totalEarned,
        totalLost,
        roundsPlayed: rounds.length,
      };
    });
}

// ─────────────────────────────────────────────────────────────────
// roundSummary — for round_result screen
// ─────────────────────────────────────────────────────────────────
function roundSummary(session) {
  const last = session.roundHistory[session.roundHistory.length - 1];
  if (!last) return null;
  return {
    roundNumber:  last.roundNumber,
    teamId:       last.teamId,
    teamName:     last.teamName,
    topic:        last.topic,
    diff:         last.diff,
    question:     last.question,
    correctAns:   last.correctAns,
    correct:      last.correct,
    timedOut:     last.timedOut || false,
    baseChange:   last.baseChange,
    speedBonus:   last.speedBonus,
    streak:          last.streak || 0,
    streakMultiplier: last.streakMultiplier || 1,
    doublePoints:    !!last.doublePoints,
    comebackBonus:   !!last.comebackBonus,
    comebackBonusPoints: COMEBACK_BONUS_POINTS,
    totalChange:  last.totalChange,
    totalScore:   last.totalScore,
    teams:        session.teams.map(t => ({ id:t.id, name:t.name, color:t.color, emoji:t.emoji, score:t.score })),
  };
}

// ─────────────────────────────────────────────────────────────────
// Points reference (exported for client display)
// ─────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────
// handleIndividualTimerExpiry — lock answers when timer hits 0
// ─────────────────────────────────────────────────────────────────
function handleIndividualTimerExpiry(session) {
  const q = session.currentQuestion;
  if (!q) return { ...session, status: 'round_result', timerRunning: false };

  // Any player who hasn't answered gets the wrong penalty
  const answers = session.currentRoundAnswers || {};
  // Use the same POINTS table Team mode uses (was a separate hardcoded map
  // before, which quietly drifted from the real per-difficulty values) and
  // apply Double Points here too — timing out was completely exempt from it
  // before, which also doesn't match how Team mode's timeout penalty works.
  const doublePointsActive = !!session.doublePointsActive;
  let penalty = Math.abs(POINTS[q.diff]?.wrong ?? 50);
  if (doublePointsActive) penalty *= 2;

  const updatedIndividualPlayers = (session.individualPlayers || []).map(p => {
    if (answers[p.socketId] !== undefined) return p; // already answered
    return { ...p, score: Math.max(0, (p.score||0) - penalty) };
  });

  return {
    ...session,
    status: 'round_result',
    timerRunning: false,
    _timedOut: true,
    individualPlayers: updatedIndividualPlayers,
    roundNumber: session.roundNumber,
  };
}

// ─────────────────────────────────────────────────────────────────
// individualRoundSummary
// ─────────────────────────────────────────────────────────────────
function individualRoundSummary(session) {
  const q = session.currentQuestion;
  const answers = session.currentRoundAnswers || {};
  const players = session.individualPlayers || [];

  const playerResults = players.map(p => {
    const ans = answers[p.socketId];
    return {
      name:    p.name,
      avatar:  p.avatar,
      socketId:p.socketId,
      answered: ans !== undefined,
      correct:  ans?.correct || false,
      totalChange: ans?.totalChange || 0,
      comebackBonus: ans?.comebackBonus || false,
      newScore: p.score || 0,
    };
  }).sort((a,b) => b.newScore - a.newScore);

  return {
    question:    q?.q || '',
    correctAns:  q?.opts?.[q?.ans?.[0]] || '',
    explanation: q?.exp || '',
    topic:       q?.topic || '',
    diff:        q?.diff || '',
    timedOut:    session._timedOut || false,
    playerResults,
    leaderboard: [...players].sort((a,b)=>b.score-a.score),
  };
}

// ─────────────────────────────────────────────────────────────────
// individualFinalLeaderboard
// ─────────────────────────────────────────────────────────────────
function individualFinalLeaderboard(session) {
  return [...(session.individualPlayers || [])]
    .sort((a,b) => b.score - a.score)
    .map((p, i) => ({
      rank:   i + 1,
      name:   p.name,
      avatar: p.avatar,
      score:  p.score || 0,
      socketId: p.socketId,
    }));
}

module.exports = {
  POINTS,
  FIFTY_FIFTY_MAX_USES,
  COMEBACK_BONUS_POINTS,
  COMEBACK_BONUS_FINAL_ROUNDS,
  comebackEligibleTeamIds,
  comebackEligiblePlayerIds,
  createGameSession,
  teamPicksTopic,
  processAnswer,
  handleTimerExpiry,
  advanceToTopicPick,
  publicView,
  finalLeaderboard,
  roundSummary,
  handleIndividualTimerExpiry,
  individualRoundSummary,
  individualFinalLeaderboard,
  toggleDoublePoints,
  useFiftyFifty,
  useFiftyFiftyIndividual,
};
