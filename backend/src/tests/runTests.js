'use strict';
/**
 * Unit tests for Jeopardy-style gameEngine.js
 * Run: node src/tests/runTests.js
 */
const {
  POINTS,
  createGameSession,
  teamPicksTopic,
  processAnswer,
  handleTimerExpiry,
  advanceToTopicPick,
  publicView,
  finalLeaderboard,
  roundSummary,
} = require('../data/gameEngine');

let pass = 0, fail = 0;
function assert(label, cond, extra = '') {
  if (cond) { console.log(`  ✅  ${label}`); pass++; }
  else       { console.error(`  ❌  ${label}${extra ? ' | ' + extra : ''}`); fail++; }
}

// ── SEED DATA ──────────────────────────────────────────────────────────────
const TEAMS = [
  { id:'A', name:'Team Alpha',   color:'#4F8CFF', emoji:'🔵' },
  { id:'B', name:'Team Bravo',   color:'#FF5252', emoji:'🔴' },
  { id:'C', name:'Team Charlie', color:'#4CAF50', emoji:'🟢' },
];

const QS = [
  // Math: 3 questions (meets min requirement)
  { id:'q1', topic:'Math', diff:'easy',   q:'2+2?',   opts:['3','4','5','6'],   ans:[1], exp:'4',   pts:100 },
  { id:'q2', topic:'Math', diff:'medium', q:'3×3?',   opts:['6','9','12','15'], ans:[1], exp:'9',   pts:150 },
  { id:'q3', topic:'Math', diff:'hard',   q:'5×5?',   opts:['20','25','30','35'],ans:[1], exp:'25', pts:200 },
  // Science: 3 questions (meets min requirement)
  { id:'q4', topic:'Science', diff:'easy',   q:'Sun?',   opts:['Star','Planet','Moon','Comet'], ans:[0], exp:'Star', pts:100 },
  { id:'q5', topic:'Science', diff:'medium', q:'H2O?',   opts:['Salt','Water','Oil','Acid'],    ans:[1], exp:'Water',pts:150 },
  { id:'q6', topic:'Science', diff:'hard',   q:'DNA?',   opts:['acid','base','protein','sugar'],ans:[0], exp:'acid', pts:200 },
  // History: 3 questions (meets min requirement)
  { id:'q7', topic:'History', diff:'easy',   q:'1776?',  opts:['USA','France','UK','Spain'],    ans:[0], exp:'USA',    pts:100 },
  { id:'q8', topic:'History', diff:'medium', q:'WW2 end?',opts:['1943','1944','1945','1946'],   ans:[2], exp:'1945',   pts:150 },
  { id:'q9', topic:'History', diff:'hard',   q:'Caesar?', opts:['Roman','Greek','Egyptian','Persian'], ans:[0], exp:'Roman', pts:200 },
];

function make(overrides = {}) {
  return createGameSession({
    code:'T1', title:'Test', mentorId:'m1',
    teams: TEAMS, questions: QS, timerSeconds: 30,
    topicFilter: [], diffFilter: 'all',
    ...overrides,
  });
}

// ══════════════════════════════════════════════════════════════════
// Suite 1 — createGameSession
// ══════════════════════════════════════════════════════════════════
console.log('\n📋 Suite 1: createGameSession');
{
  const s = make();
  assert('status is lobby',           s.status === 'lobby');
  assert('3 teams',                   s.teams.length === 3);
  assert('all scores start 0',        s.teams.every(t => t.score === 0));
  assert('currentTeamIdx is 0',       s.currentTeamIdx === 0);
  assert('usedQuestionIds empty',     s.usedQuestionIds.length === 0);
  assert('availableTopics = 3',       s.availableTopics.length === 3, 'got: '+s.availableTopics.length);
  assert('byTopic has Math',          s.byTopic['Math']?.length === 3);
  assert('byTopic has Science',       s.byTopic['Science']?.length === 3);
  assert('byTopic has History',       s.byTopic['History']?.length === 3);
  assert('currentQuestion null',      s.currentQuestion === null);
}

// ══════════════════════════════════════════════════════════════════
// Suite 2 — teamPicksTopic
// ══════════════════════════════════════════════════════════════════
console.log('\n📋 Suite 2: teamPicksTopic');
{
  let s = make();
  s = { ...s, status: 'topic_pick' };

  // Wrong team tries to pick
  const { error: e1 } = teamPicksTopic(s, 'B', 'Math');
  assert('Wrong team gets error',     !!e1);

  // Correct team picks Math
  const { session: s2, question: q } = teamPicksTopic(s, 'A', 'Math');
  assert('Status becomes playing',    s2.status === 'playing');
  assert('Question is from Math',     q.topic === 'Math');
  assert('Question is in usedIds',    s2.usedQuestionIds.includes(q.id));
  assert('chosenTopic is Math',       s2.chosenTopic === 'Math');
  assert('timerRunning is true',      s2.timerRunning === true);
  assert('timerRemaining = 30',       s2.timerRemaining === 30);
  assert('roundNumber = 1',           s2.roundNumber === 1);
  assert('currentQuestion set',       s2.currentQuestion !== null);

  // Pick non-existent topic
  const { error: e2 } = teamPicksTopic(s, 'A', 'Sports');
  assert('Unknown topic gets error',  !!e2);
}

// ══════════════════════════════════════════════════════════════════
// Suite 3 — processAnswer CORRECT
// ══════════════════════════════════════════════════════════════════
console.log('\n📋 Suite 3: processAnswer — correct');
{
  let s = make();
  s = { ...s, status: 'topic_pick' };
  let q;
  ({ session: s, question: q } = teamPicksTopic(s, 'A', 'Math'));

  const correctIdx = q.ans[0];
  const { session: s2, result: r } = processAnswer(s, 'A', correctIdx);

  assert('result.correct = true',     r.correct === true);
  assert('baseChange > 0',            r.baseChange > 0);
  assert('speedBonus >= 0',           r.speedBonus >= 0);
  assert('totalChange > 0',           r.totalChange > 0);
  assert('Team A score > 0',          s2.teams.find(t=>t.id==='A').score > 0);
  assert('status = round_result',     s2.status === 'round_result');
  assert('roundHistory has 1 entry',  s2.roundHistory.length === 1);
  assert('next team is B (idx 1)',    s2.currentTeamIdx === 1);
  assert('currentQuestion cleared',   s2.currentQuestion === null);
  assert('timerRunning false',        s2.timerRunning === false);
  assert('correctAnswer in result',   r.correctAnswer !== undefined);
}

// ══════════════════════════════════════════════════════════════════
// Suite 4 — processAnswer WRONG (points subtracted)
// ══════════════════════════════════════════════════════════════════
console.log('\n📋 Suite 4: processAnswer — wrong (deduct points)');
{
  let s = make();
  s = { ...s, status: 'topic_pick' };
  let q;
  ({ session: s, question: q } = teamPicksTopic(s, 'A', 'Math'));

  // Give team A some points first
  s = { ...s, teams: s.teams.map(t => t.id==='A' ? {...t, score:300} : t) };

  const wrongIdx = (q.ans[0] + 1) % q.opts.length;
  const { session: s2, result: r } = processAnswer(s, 'A', wrongIdx);

  assert('result.correct = false',    r.correct === false);
  assert('baseChange < 0',            r.baseChange < 0);
  assert('speedBonus = 0',            r.speedBonus === 0);
  assert('totalChange < 0',           r.totalChange < 0);
  assert('Team A score decreased',    s2.teams.find(t=>t.id==='A').score < 300);
  assert('status = round_result',     s2.status === 'round_result');
  assert('next team is B',            s2.currentTeamIdx === 1);
}

// ══════════════════════════════════════════════════════════════════
// Suite 5 — Score floor at 0 (cannot go negative)
// ══════════════════════════════════════════════════════════════════
console.log('\n📋 Suite 5: Score floor at 0');
{
  let s = make();
  s = { ...s, status: 'topic_pick' };
  // Team A starts at 0
  let q;
  ({ session: s, question: q } = teamPicksTopic(s, 'A', 'Math'));

  const wrongIdx = (q.ans[0] + 1) % q.opts.length;
  const { session: s2 } = processAnswer(s, 'A', wrongIdx);

  assert('Score never goes below 0',  s2.teams.find(t=>t.id==='A').score === 0);
}

// ══════════════════════════════════════════════════════════════════
// Suite 6 — handleTimerExpiry
// ══════════════════════════════════════════════════════════════════
console.log('\n📋 Suite 6: handleTimerExpiry');
{
  let s = make();
  s = { ...s, status: 'topic_pick' };
  s = { ...s, teams: s.teams.map(t => t.id==='A' ? {...t,score:400} : t) };

  let q;
  ({ session: s, question: q } = teamPicksTopic(s, 'A', 'Math'));
  const before = s.teams.find(t=>t.id==='A').score;

  const s2 = handleTimerExpiry(s);
  const after = s2.teams.find(t=>t.id==='A').score;

  assert('status = round_result',     s2.status === 'round_result');
  assert('timerRunning = false',      s2.timerRunning === false);
  assert('Score decreased on timeout',after < before);
  assert('Round logged as timedOut',  s2.roundHistory[0].timedOut === true);
  assert('Next team advances',        s2.currentTeamIdx === 1);
  assert('currentQuestion cleared',   s2.currentQuestion === null);
}

// ══════════════════════════════════════════════════════════════════
// Suite 7 — advanceToTopicPick
// ══════════════════════════════════════════════════════════════════
console.log('\n📋 Suite 7: advanceToTopicPick');
{
  let s = make();
  s = { ...s, status: 'round_result', _gameOver: false };

  const s2 = advanceToTopicPick(s);
  assert('status = topic_pick',       s2.status === 'topic_pick');

  // When _gameOver is true → finished
  const s3 = advanceToTopicPick({ ...s, _gameOver: true });
  assert('_gameOver → finished',      s3.status === 'finished');

  // When no topics left → finished
  const s4 = advanceToTopicPick({ ...s, availableTopics: [] });
  assert('No topics → finished',      s4.status === 'finished');
}

// ══════════════════════════════════════════════════════════════════
// Suite 8 — publicView hides answer
// ══════════════════════════════════════════════════════════════════
console.log('\n📋 Suite 8: publicView');
{
  let s = make();
  s = { ...s, status: 'topic_pick' };
  let q;
  ({ session: s, question: q } = teamPicksTopic(s, 'A', 'Math'));

  const hidden   = publicView(s, false);
  const revealed = publicView(s, true);

  assert('question visible',          hidden.question !== null);
  assert('answer hidden during play', hidden.question.ans === undefined);
  assert('opts always visible',       hidden.question.opts.length >= 2);
  assert('answer revealed on reveal', revealed.question.ans !== undefined);
  assert('exp revealed on reveal',    revealed.question.exp !== undefined);
  assert('availableTopics in view',   Array.isArray(hidden.availableTopics));
  assert('currentTeamId in view',     hidden.currentTeamId === 'A');
  assert('currentTeamName in view',   hidden.currentTeamName === 'Team Alpha');
  assert('roundNumber in view',       hidden.roundNumber === 1);
}

// ══════════════════════════════════════════════════════════════════
// Suite 9 — Points values (POINTS table)
// ══════════════════════════════════════════════════════════════════
console.log('\n📋 Suite 9: POINTS table');
{
  assert('easy correct = 100',        POINTS.easy.correct   === 100);
  assert('easy wrong = -50',          POINTS.easy.wrong     === -50);
  assert('medium correct = 150',      POINTS.medium.correct === 150);
  assert('medium wrong = -75',        POINTS.medium.wrong   === -75);
  assert('hard correct = 200',        POINTS.hard.correct   === 200);
  assert('hard wrong = -100',         POINTS.hard.wrong     === -100);
}

// ══════════════════════════════════════════════════════════════════
// Suite 10 — finalLeaderboard & roundSummary
// ══════════════════════════════════════════════════════════════════
console.log('\n📋 Suite 10: finalLeaderboard & roundSummary');
{
  let s = make();
  s = { ...s, status: 'topic_pick' };
  let q;

  // A picks Math, answers correctly
  ({ session: s, question: q } = teamPicksTopic(s, 'A', 'Math'));
  ({ session: s } = processAnswer(s, 'A', q.ans[0]));
  s = advanceToTopicPick(s);

  // B picks Science, answers wrong
  ({ session: s, question: q } = teamPicksTopic(s, 'B', 'Science'));
  ({ session: s } = processAnswer(s, 'B', (q.ans[0]+1)%q.opts.length));
  s = advanceToTopicPick(s);

  s = { ...s, status: 'finished' };
  const lb = finalLeaderboard(s);

  assert('LB has 3 teams',            lb.length === 3);
  assert('Rank 1 highest score',      lb[0].score >= lb[1].score);
  assert('A correct = 1',             lb.find(t=>t.id==='A').correct === 1);
  assert('B wrong = 1',               lb.find(t=>t.id==='B').wrong   === 1);
  assert('A totalEarned > 0',         lb.find(t=>t.id==='A').totalEarned > 0);
  assert('B totalLost > 0',           lb.find(t=>t.id==='B').totalLost  > 0);

  const summ = roundSummary(s);
  assert('summary has teamId',        !!summ.teamId);
  assert('summary has question text', typeof summ.question === 'string');
  assert('summary has correctAns',    !!summ.correctAns);
  assert('summary has totalChange',   typeof summ.totalChange === 'number');
}

// ══════════════════════════════════════════════════════════════════
// Suite 11 — Topic exhaustion
// ══════════════════════════════════════════════════════════════════
console.log('\n📋 Suite 11: Topic exhaustion');
{
  // History has only 1 question — after it's used, topic should be unavailable
  let s = make();
  s = { ...s, status: 'topic_pick' };
  let q;
  // Pick all 3 History questions to exhaust the topic
  ({ session: s, question: q } = teamPicksTopic(s, 'A', 'History'));
  assert('History question 1 served',   q.topic === 'History');
  // Advance through 2 more History picks to exhaust it
  const { session: sH2 } = require('../data/gameEngine').processAnswer(s, 'A', q.ans[0]);
  const s2 = require('../data/gameEngine').advanceToTopicPick({...sH2, status:'round_result', _gameOver:false});
  s2.currentTeamIdx = 0; // A picks again
  let q2;
  ({ session: s, question: q2 } = teamPicksTopic({...s2, status:'topic_pick'}, 'A', 'History'));
  const { session: sH3 } = require('../data/gameEngine').processAnswer(s, 'A', q2.ans[0]);
  const s3 = require('../data/gameEngine').advanceToTopicPick({...sH3, status:'round_result', _gameOver:false});
  s3.currentTeamIdx = 0;
  let q3;
  ({ session: s, question: q3 } = teamPicksTopic({...s3, status:'topic_pick'}, 'A', 'History'));
  // After all 3 questions used, History should be gone
  assert('History gone from available', !s.availableTopics.includes('History'));

  // Try picking History again — should error
  const s4 = require('../data/gameEngine').advanceToTopicPick({ ...s, status:'round_result', _gameOver:false });
  const { error } = teamPicksTopic({ ...s4, status:'topic_pick', currentTeamIdx:1 }, 'B', 'History');
  assert('Used-up topic gives error', !!error);
}

// ══════════════════════════════════════════════════════════════════
// Suite 12 — Wrong team cannot answer / pick
// ══════════════════════════════════════════════════════════════════
console.log('\n📋 Suite 12: Wrong team validation');
{
  let s = make();
  s = { ...s, status: 'topic_pick' }; // A's turn

  // B tries to pick — should error
  const { error: e1 } = teamPicksTopic(s, 'B', 'Math');
  assert('B cannot pick when A\'s turn',  !!e1);

  let q;
  ({ session: s, question: q } = teamPicksTopic(s, 'A', 'Math'));

  // B tries to answer when A should answer
  const { result } = processAnswer(s, 'B', 0);
  assert('B cannot answer when A\'s turn', result.error !== undefined);
}

// ══════════════════════════════════════════════════════════════════
// RESULTS
// ══════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(48)}`);
console.log(`  Tests passed: ${pass}`);
console.log(`  Tests failed: ${fail}`);
console.log(`  Total:        ${pass + fail}`);
if (fail === 0) console.log('\n  🎉 ALL TESTS PASSED!\n');
else { console.log('\n  ⚠️  Some tests failed\n'); process.exit(1); }
