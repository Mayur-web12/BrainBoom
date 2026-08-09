🦁 QuizQuest 3.0 — Real-Time Team Battle Platform

QuizQuest is a full-stack, real-time quiz platform designed for team-based competitions, individual practice, shared-screen games, and live mentor-controlled quiz sessions.

The application uses React 18 for the frontend, Node.js + Express + Socket.IO for the backend, and PostgreSQL for persistent data storage.

✨ Features
🎯 Real-time team quiz battles
👥 Multiple teams in the same game
🧑‍🏫 Mentor dashboard
🔐 Mentor authentication
🎮 Student join using a game code
🔄 Real-time game updates with Socket.IO
⏱️ Configurable question timer
🔀 Turn-based team answering
🏆 Steal chance when a team answers incorrectly
📊 Live scores and leaderboard
🥇 Final podium and rankings
📺 Shared-screen game mode
👤 Individual/solo player mode
📚 Practice mode
📝 Mentor question management
🗂️ Topic management
💾 Persistent questions, topics, and game results
📱 Responsive UI
🔊 Correct/wrong/winner sound effects
🛠️ Technology Stack
Layer	Technology
Frontend	React 18
Frontend Build	Create React App / react-scripts
Backend	Node.js
API	Express.js
Real-time Communication	Socket.IO
Database	PostgreSQL
PostgreSQL Driver	pg
Authentication	Mentor token + session storage
Styling	Custom CSS
Package Manager	npm
Deployment Frontend	Vercel
Deployment Backend	Render
Database Hosting	Neon PostgreSQL

📁 Project Structure
quizquest/
├── frontend/
├── backend/
├── render.yaml
└── README.md

🎮 How to Play
Mentor
Open /mentor
Login
Open the Sessions section
Create a session
Configure the quiz
Select topics
Configure teams
Create the session
Share the game code with students
Open Live Control
Start the game
Control questions and timer
View scores and leaderboard
Students
Open the QuizQuest website
Select Student
Enter a name
Enter the game code
Select an avatar
Select a team
Wait in the lobby
Answer questions when their team gets a turn
View scores and final leaderboard
🏆 Game Rules

QuizQuest uses turn-based team competition.

A typical round works like this:

Team A
   ↓
Answer
   │
   ├── Correct → Score
   │
   └── Wrong → Steal chance
                    ↓
                 Team B
                    ↓
                 Team C
                    ↓
                 Team D

The starting team rotates between questions.

⚡ Scoring
Attempt	Score
Original team	100% + speed bonus
First steal	60%
Second steal	40%
Later steal	20%

The original team can receive an additional speed bonus based on the remaining timer.

🎯 Practice Mode

Practice Mode allows an individual student to practice without creating or joining a live game.

Features include:

No game code required
Untimed questions
Instant answer feedback
Explanations
Read-aloud support
Star/favorite functionality