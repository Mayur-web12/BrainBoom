// All API calls — swap BASE for production
const BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000';

// ── MENTOR TOKEN ──────────────────────────────────────────────────────────────
// Set after login; attached to every mutating admin request as x-mentor-token.
// Persisted in sessionStorage so a page refresh during a session keeps the mentor
// authenticated (cleared automatically when the tab/window closes).
let mentorToken = null;
try { mentorToken = sessionStorage.getItem('quizquest_mentor_token') || null; } catch (_) {}

function setMentorToken(token) {
  mentorToken = token || null;
  try {
    if (token) sessionStorage.setItem('quizquest_mentor_token', token);
    else       sessionStorage.removeItem('quizquest_mentor_token');
  } catch (_) {}
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (mentorToken) headers['x-mentor-token'] = mentorToken;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login:           async (email, password) => {
    const data = await request('POST', '/auth/login', { email, password });
    if (data.token) setMentorToken(data.token);
    return data;
  },
  setMentorToken,                       // expose for logout / manual control
  logout:          () => setMentorToken(null),

  // Questions
  getTopics:       ()             => request('GET',    '/topics'),
  addTopic:        (topic)        => request('POST',   '/topics', topic),
  getQuestions:    (params)       => request('GET',    `/questions?${new URLSearchParams(params || {})}`),
  checkPracticeAnswer: (questionId, answerIdx) => request('POST', '/practice/check-answer', { questionId, answerIdx }),
  addQuestion:     (question)     => request('POST',   '/questions', question),
  updateQuestion:  (id, question) => request('PUT',    `/questions/${id}`, question),
  deleteQuestion:  (id)           => request('DELETE', `/questions/${id}`),

  // Sessions
  getSessions:     ()           => request('GET',    '/sessions'),
  getSession:      (code)       => request('GET',    `/sessions/${code}`),
  createSession:   (body)       => request('POST',   '/sessions', body),
  deleteSession:   (code)       => request('DELETE', `/sessions/${code}`),
  setTimer:        (code, sec)  => request('PATCH',  `/sessions/${code}/timer`, { timerSeconds: sec }),

  // Results (durable history of finished games)
  getResults:      ()           => request('GET',    '/results'),

  // Health
  health:          ()           => request('GET',    '/health'),
};
