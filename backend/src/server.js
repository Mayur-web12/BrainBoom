'use strict';
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const apiRouter  = require('./routes/api');
const initSocket = require('./socket/gameSocket');
const db         = require('./data/db');
const {
  rateLimit, sanitizeBody, blockInjection, securityHeaders,
} = require('./middleware/security');

const PORT = process.env.PORT || 4000;

// Allowed frontend origins
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',');

const app    = express();
const server = http.createServer(app);

// ── SECURITY MIDDLEWARE (applied to ALL requests) ─────────────────────────────
app.set('trust proxy', 1); // trust first proxy (needed for correct IP with Nginx/load balancer)
app.use(securityHeaders);

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}));

// ── BODY PARSING (with size limit to prevent DoS) ────────────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

// ── GLOBAL RATE LIMIT (100 req/min per IP across all endpoints) ───────────────
app.use(rateLimit({ windowMs: 60000, max: 100, message: 'Rate limit exceeded. Try again in a minute.' }));

// ── SANITIZE + INJECT BLOCK ───────────────────────────────────────────────────
app.use(sanitizeBody);
app.use(blockInjection);

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ name:'QuizQuest API', version:'3.0', status:'running' }));
app.use('/api', apiRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ ok:false, error:`${req.method} ${req.path} not found` }));

// ── GLOBAL ERROR HANDLER ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  // Don't leak stack traces in production
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    ok: false,
    error: isProd ? 'Internal server error' : err.message,
  });
});

// ── SOCKET.IO ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods:['GET','POST'] },
  pingTimeout: 60000,
  maxHttpBufferSize: 1e5, // 100KB max socket message size
});
initSocket(io);

// ── START ─────────────────────────────────────────────────────────────────────
// Wait for the database (Postgres schema + seed, or JSON-file load) to be
// ready before accepting traffic — avoids race conditions on first request.
db.init().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀  QuizQuest backend → http://localhost:${PORT}`);
    console.log(`🗄️   Database backend: ${db.backend === 'postgres' ? 'PostgreSQL (persistent)' : 'JSON files (local dev — set DATABASE_URL for persistent Postgres)'}`);
    console.log(`🔒  Security: rate limiting, XSS protection, injection blocking`);
    console.log(`🌐  CORS allowed: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log(`\n  Mentor: mentor@quiz.com / quiz123\n`);
  });
}).catch(err => {
  console.error('❌ Failed to initialize database:', err.message);
  process.exit(1);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') { console.error(`❌ Port ${PORT} in use`); process.exit(1); }
});
