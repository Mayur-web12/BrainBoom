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
  // Every check-answer / 50-50 call during gameplay is a cross-origin POST with a
  // JSON body, which browsers always preflight with an OPTIONS request first.
  // Without maxAge, some browsers re-preflight far more often than needed, which
  // doubles the network round trips on the hot gameplay path. Caching the
  // preflight result for a day removes that repeat cost for the rest of the game.
  maxAge: 86400,
}));

// ── BODY PARSING (with size limit to prevent DoS) ────────────────────────────
// Quiz Builder's "Upload File" converts an image to a base64 data: URL on the
// client and embeds it directly in the question's JSON — no separate file
// upload endpoint exists (see the note on that in MentorDash.jsx). Base64
// inflates size by ~33%, so a question with the max-allowed 10MB image
// becomes a ~13.3MB request body. The previous 50kb limit meant literally
// any real photo failed instantly — not a fringe case, this broke every
// image upload, which is exactly what produced the "Internal server error"
// toast (see the improved error handler below for why the message itself
// was also unhelpful). 15mb gives that a bit of headroom.
//
// This is a real ceiling, not a full fix — see the comment on handleFileUpload
// in MentorDash.jsx for why images-as-base64-in-Postgres isn't where this
// should end up long-term.
app.use(express.json({ limit: '15mb' }));
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
  const isProd = process.env.NODE_ENV === 'production';

  // A masked "Internal server error" for EVERY error type is exactly what
  // turned "your image is too big" into an undiagnosable mystery — the
  // person hitting it has no way to tell a real server bug apart from
  // "you need a smaller file". Payload-too-large is common enough (any
  // image/media upload) and specific enough to explain clearly without
  // leaking anything sensitive, so it gets a real message even in prod;
  // everything else still falls back to the generic message.
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      ok: false,
      error: 'That file is too large to upload. Try a smaller image, or use a video/image URL instead of uploading the file directly.',
    });
  }

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
