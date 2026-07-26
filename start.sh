#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# QuizQuest 3.0 — Start both backend and frontend
# Usage: ./start.sh
# ─────────────────────────────────────────────────────────────────

echo ""
echo "🦁  QuizQuest 3.0 — Starting..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌  Node.js not found. Please install from https://nodejs.org (v18+)"
  exit 1
fi

NODE_VER=$(node -v | cut -c2- | cut -d. -f1)
if [ "$NODE_VER" -lt 16 ]; then
  echo "❌  Node.js v16+ required. Current: $(node -v)"
  exit 1
fi

echo "✅  Node.js $(node -v) found"
echo ""

# Install backend deps if needed
if [ ! -d "backend/node_modules" ]; then
  echo "📦  Installing backend dependencies..."
  cd backend && npm install && cd ..
  echo ""
fi

# Install frontend deps if needed
if [ ! -d "frontend/node_modules" ]; then
  echo "📦  Installing frontend dependencies..."
  cd frontend && npm install && cd ..
  echo ""
fi

echo "🚀  Starting backend on  http://localhost:4000"
echo "🎨  Starting frontend on http://localhost:3000"
echo ""
echo "  Mentor login:  mentor@quiz.com / quiz123"
echo "  Students join: http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop both servers"
echo ""

# Start backend in background
cd backend && npm start &
BACKEND_PID=$!

# Give backend 2 seconds to start
sleep 2

# Start frontend
cd ../frontend && npm start &
FRONTEND_PID=$!

# Trap Ctrl+C to kill both
trap "echo ''; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

# Wait
wait
