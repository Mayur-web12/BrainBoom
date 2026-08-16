# 🦁 QuizQuest 3.0 — Real-Time Team Battle Platform

A full-stack, real-time quiz game with turn-based team competition.
Built with **Node.js + Socket.IO** (backend) and **React 18** (frontend).

---

## 🚀 How to Run the Project

### Prerequisites
- **Node.js v18 or newer** — check with `node -v`. Get it from https://nodejs.org
- npm (comes bundled with Node.js)

The app has **two parts** that must both be running at the same time:
the **backend** (API + real-time server, port `4000`) and the **frontend**
(the React app you open in the browser, port `3000`).

---

### Option A — Two terminals (recommended, works everywhere)

Open **two** terminal windows in the project folder (`quizquest-v10-updated`).

**Terminal 1 — Backend**
```bash
cd backend
npm install        # first time only — installs dependencies
npm start
# ✅ Running on http://localhost:4000
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm install        # first time only — installs dependencies
npm start
# ✅ Opens http://localhost:3000 in your browser automatically
```

Then open **http://localhost:3000** in your browser. Keep both terminals open
while you use the app; press **Ctrl + C** in each to stop.

---

### Option B — One command (Mac / Linux / Git Bash on Windows)
From the project root:
```bash
./start.sh
```
This installs dependencies (if needed) and starts **both** servers together.
On Windows, run it from **Git Bash** (not the regular Command Prompt).

---

### First run — what to expect
- On first backend start, a **`backend/db/`** folder is created automatically with
  `questions.json`, `topics.json`, and `results.json`. This is your saved data —
  **everything the mentor adds now survives a restart.** Do not delete it unless you
  want to reset to the seed questions.
- The backend seeds **40 starter questions across 8 topics** (including the **Sabha**
  topic). Edit or replace these from the mentor dashboard.

---

### Configuration (optional but recommended)
Settings live in `backend/.env` and `frontend/.env`.

Before sharing or deploying, change the mentor login in **`backend/.env`**:
```
MENTOR_EMAIL=your@email.com
MENTOR_PASSWORD=your-strong-password
MENTOR_NAME=Your Name
```
The password is never stored in plain text — the server keeps only a hashed copy.

---

### Troubleshooting
- **`Port 4000 in use`** — another program (or an old backend) is using the port.
  Close it, or change `PORT` in `backend/.env`.
- **Frontend can't reach the backend** — make sure the backend terminal is running,
  and that `REACT_APP_API_URL` in `frontend/.env` points to `http://localhost:4000`.
- **`npm start` fails with a dependency error** — delete `node_modules` in that
  folder and run `npm install` again.
- **Changed a topic/question but it "came back"** — the file in `backend/db/` is the
  source of truth; restart the backend after editing files there by hand.

---

## 🔐 Login Credentials

| Role   | Email           | Password |
|--------|-----------------|----------|
| Mentor | mentor@quiz.com | quiz123  |

Students enter **name + game code** (no password needed).

**Where to log in as mentor:** the dashboard is on a private path — open
**http://localhost:3000/mentor** (this path is set by `REACT_APP_MENTOR_PATH`
in `frontend/.env`).

**Ways to play (from the home page http://localhost:3000):**
- **Team Game** — multi-device, join a team with a code
- **Solo Player** — individual, live student-vs-student leaderboard
- **Shared Screen** — everyone on one screen
- **🎯 Practice Mode** — solo, untimed, **no code needed**; instant answers +
  explanations, read-aloud, and ⭐ stars. Great for learning and memorizing.

---

## 🎮 How to Run a Game

### Step 1 — Mentor creates a session
1. Login → **Sessions tab** → **Create Session**
2. Set title, difficulty, timer per turn (5–120s)
3. Choose topics (optional)
4. Set **number of teams** (2–6) and **customize names/colors/emoji**
5. Click **Create & Get Code** → get 6-letter code e.g. `QUIZ42`

### Step 2 — Share code with students
- All teams use the **same code** — team is selected at login
- Multiple students can join the same team

### Step 3 — Students join
1. Role Select → Student
2. Enter nickname + game code
3. Pick avatar
4. **Select their team** (Red, Blue, Green, etc.)
5. Wait in lobby

### Step 4 — Mentor starts the game
- Go to **Live Control** tab (or click "Control" on session)
- See who joined each team
- Click **🚀 Start Game**

### Step 5 — Turn-based answering
- **Q1:** Team A answers first
- **Q2:** Team B answers first (rotation)
- If a team answers **wrong**, question passes to the next team (**steal chance**)
- If a team answers **correct**, they score and the round ends
- If all teams fail, nobody scores

### Step 6 — After each question
- Round result shown: who scored, who failed, current standings
- **Mentor clicks "Next Question"** to advance
- Mentor can also **pause/resume timer** or **skip questions** live

### Step 7 — Final leaderboard
- Shown automatically after last question
- Shows podium (🥇🥈🥉) and full ranking

---

## ⚡ Scoring System

| Attempt | Points |
|---------|--------|
| 1st (original team) | 100% base + speed bonus (up to 50% extra) |
| 2nd (steal) | 60% of base pts |
| 3rd (steal) | 40% of base pts |
| 4th+ (steal) | 20% of base pts |

**Speed Bonus:** proportional to timer remaining when answered.

---

## 🗂 Project Structure

```
quizquest-v3/
├── backend/
│   ├── src/
│   │   ├── server.js              ← Express + Socket.IO entry
│   │   ├── routes/api.js          ← REST: login, sessions, questions
│   │   ├── socket/gameSocket.js   ← Real-time: all game events
│   │   ├── data/
│   │   │   ├── gameEngine.js      ← Pure game logic (fully testable)
│   │   │   ├── store.js           ← In-memory store (swap for DB)
│   │   │   └── questions.js       ← 45 seed questions, 7 topics
│   │   └── tests/
│   │       └── runTests.js        ← 69 unit tests
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── App.jsx                ← Router
    │   ├── index.js               ← Entry point
    │   ├── context/AppContext.jsx ← Global state (useReducer)
    │   ├── hooks/useSocket.js     ← Socket listeners + useEmit
    │   ├── utils/
    │   │   ├── api.js             ← REST client
    │   │   └── socket.js          ← Socket singleton
    │   ├── components/shared.jsx  ← Nav, Modal, Timer, Confetti, etc.
    │   ├── screens/
    │   │   ├── Landing.jsx        ← Landing + Role Select
    │   │   ├── MentorLogin.jsx    ← Auth
    │   │   ├── MentorDash.jsx     ← Dashboard, Sessions, Live, Builder
    │   │   ├── StudentJoin.jsx    ← Code entry + team picker
    │   │   └── GameScreens.jsx    ← Lobby, Game, RoundResult, FinalLB
    │   └── styles/globals.css    ← All CSS (no external UI lib)
    └── package.json
```

---

## 🧪 Tests

```bash
# Unit tests (game engine logic)
cd backend
node src/tests/runTests.js
# → 69 tests, all passing

# Integration test (full game simulation)
node integration.js  # (run from backend dir)
# → 32 tests, all passing
```

---

## 🔌 Socket.IO Events Reference

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `mentor-auth` | `{email, password}` | Authenticate mentor |
| `mentor-join-session` | `{code}` | Mentor joins session room |
| `student-join` | `{code, name, teamId, avatar}` | Student joins session |
| `start-game` | `{code}` | Mentor starts the game |
| `submit-answer` | `{code, teamId, answerIdx}` | Team submits an answer |
| `next-question` | `{code}` | Mentor advances to next Q |
| `pause-timer` | `{code}` | Mentor pauses timer |
| `resume-timer` | `{code}` | Mentor resumes timer |
| `skip-question` | `{code}` | Mentor skips current Q |
| `set-timer` | `{code, seconds}` | Mentor changes timer duration |

### Server → Client
| Event | Description |
|-------|-------------|
| `lobby-update` | New player joined/left lobby |
| `game-started` | Game has begun, go to game screen |
| `game-state` | Question changed or turn passed |
| `round-result` | Question done, show scores |
| `timer-tick` | Timer countdown (every second) |
| `timer-paused` | Timer was paused |
| `timer-resumed` | Timer resumed |
| `timer-settings-updated` | Timer duration changed |
| `game-over` | Final leaderboard ready |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js v18+ |
| HTTP server | Express 4 |
| Real-time | Socket.IO 4 |
| Frontend | React 18 |
| State management | useReducer + Context |
| Styling | Pure CSS (no UI framework) |
| Fonts | Google Fonts (Nunito + Fredoka) |

---

## 🔮 Extending / Adding a Real Database

The `store.js` file is the only place that touches data.
Swap the in-memory `Map` operations for MongoDB/Firestore calls:

```js
// store.js — current (in-memory)
function getSession(code) { return sessions.get(code) || null; }

// store.js — with MongoDB
async function getSession(code) {
  return await Session.findOne({ code }).lean();
}
```

All game logic in `gameEngine.js` stays untouched — it's pure functions.
