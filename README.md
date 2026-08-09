# 🦁 QuizQuest 3.0 — Real-Time Team Battle Platform

A full-stack, real-time quiz game with turn-based team competition.

Built with **Node.js + Socket.IO** for the backend and **React 18** for the frontend.

---

## 🎯 What is QuizQuest?

QuizQuest is a real-time quiz platform designed for **team-based competitions, individual practice, shared-screen games, and mentor-controlled quiz sessions**.

It allows mentors to create quiz sessions, manage teams, control the game, and view live scores while students join using a game code and compete in real time.

---

## 💡 Why We Built QuizQuest

QuizQuest was built to make quiz competitions more **interactive, engaging, and competitive**.

The platform provides:

- 🎯 Real-time team quiz battles
- 👥 Multiple teams in the same game
- 🧑‍🏫 Mentor-controlled quiz sessions
- 🎮 Students joining with a game code
- 🔄 Real-time game updates
- ⏱️ Configurable question timer
- 🏆 Turn-based team competition
- 🔀 Steal chances after incorrect answers
- 📊 Live scores and leaderboard
- 🥇 Final rankings and podium
- 📺 Shared-screen game mode
- 👤 Individual/solo player mode
- 📚 Practice mode

---

## 🎮 How to Play

### 🧑‍🏫 Mentor

1. Open the **Mentor Login**.
2. Login to the mentor dashboard.
3. Open the **Sessions** section.
4. Click **Create Session**.
5. Configure the quiz.
6. Select the required topics.
7. Configure the teams.
8. Create the session and get the **game code**.
9. Share the game code with the students.
10. Open **Live Control**.
11. Start the game.
12. Control questions and the timer.
13. View live scores and the leaderboard.

---

### 👨‍🎓 Students

1. Open the **QuizQuest website**.
2. Select **Student**.
3. Enter your name.
4. Enter the **game code** shared by the mentor.
5. Select an avatar.
6. Select a team.
7. Wait in the lobby.
8. Answer questions when your team gets a turn.
9. View the scores and final leaderboard.

---

## 🏆 Game Rules

QuizQuest uses **turn-based team competition**.

A typical round works like this:

```text
Team A
   ↓
Answer
   │
   ├── Correct → Score
   │
   └── Wrong → Steal Chance
                    ↓
                 Team B
                    ↓
                 Team C
                    ↓
                 Team D