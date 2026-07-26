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

  return {
    code,
    title,
    mentorId,
    mode: mode || 'team',
    status:          'lobby',   // lobby | topic_pick | playing | round_result | finished
    teams:           teams.map(t => ({ ...t, score: 0, players: [], roundScores: [] })),
    questions,                  // full question array
    usedQuestionIds: [],        // ids already asked — never repeat
    byTopic,                    // { topicName: [questionIds] }
    availableTopics,            // topics still having unused questions
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

  const baseChange  = correct ? POINTS[diff].correct : POINTS[diff].wrong;
  const totalChange = correct ? baseChange + speedBonus : baseChange; // wrong is negative

  // Apply score — floor at 0
  const updatedTeams = session.teams.map(t => {
    if (t.id !== teamId) return t;
    const newScore = Math.max(0, t.score + totalChange);
    return { ...t, score: newScore };
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
    _gameOver:       isDone,  // flag for socket to check
  };

  return {
    session: updated,
    result: {
      correct,
      baseChange,
      speedBonus:   correct ? speedBonus : 0,
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
  const baseChange = POINTS[diff].wrong; // negative

  const updatedTeams = session.teams.map(t => {
    if (t.id !== currentTeam.id) return t;
    return { ...t, score: Math.max(0, t.score + baseChange) };
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
    _gameOver:       isDone,
    _timedOut:       true,
    _timedOutTeam:   currentTeam,
    _lastRoundEntry: roundEntry,
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
    teams:           session.teams.map(t => ({
      id:          t.id,
      name:        t.name,
      color:       t.color,
      emoji:       t.emoji,
      score:       t.score,
      playerCount: (t.players || []).length,
    })),
    currentTeamIdx:  session.currentTeamIdx,
    currentTeamId:   session.teams[session.currentTeamIdx]?.id,
    currentTeamName: session.teams[session.currentTeamIdx]?.name,
    currentTeamColor:session.teams[session.currentTeamIdx]?.color,
    currentTeamEmoji:session.teams[session.currentTeamIdx]?.emoji,

    availableTopics: session.availableTopics,
    chosenTopic:     session.chosenTopic,
    roundNumber:     session.roundNumber,
    maxRounds,
    totalQuestions:  session.questions.length,
    usedCount:       session.usedQuestionIds.length,
    gameOver,        // true when the game has ended or is at its round limit

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
    })),
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
  const DIFF_PTS_MAP = { easy:-50, medium:-75, hard:-100 };
  const penalty = Math.abs(DIFF_PTS_MAP[q.diff] || 50);

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
};
