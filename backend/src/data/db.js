'use strict';

/**
 * db.js — durable persistence, PostgreSQL-first with a JSON-file fallback.
 * ─────────────────────────────────────────────────────────────────────────────
 * Set DATABASE_URL in backend/.env to point at a free, always-on Postgres
 * instance (Neon, Supabase, Railway, etc.) and this module stores everything
 * there — questions, topics, and finished-game results survive restarts,
 * redeploys, and free-tier disk wipes.
 *
 * If DATABASE_URL is NOT set, it transparently falls back to local JSON files
 * (the original behaviour) so local development still works with zero setup.
 *
 * Every exported function is ASYNC (returns a Promise) in both modes, so the
 * rest of the app never needs to know which backend is active — just always
 * `await db.xxx()`.
 *
 * Live in-progress game sessions still stay in memory (see store.js) — a
 * mid-play game does not need to survive a crash, but the QUESTION BANK,
 * TOPICS, and RESULTS do.
 */

const fs   = require('fs');
const path = require('path');

const { QUESTIONS: SEED_QUESTIONS, TOPICS: SEED_TOPICS } = require('./questions');
const { SABHA_TOPIC, SABHA_QUESTIONS } = require('./seedExtra');

const USE_PG = !!process.env.DATABASE_URL;

// ════════════════════════════════════════════════════════════════════════════
// POSTGRES BACKEND
// ════════════════════════════════════════════════════════════════════════════
let pgImpl = null;
if (USE_PG) {
  const { Pool } = require('pg');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Most free hosted Postgres providers (Neon, Supabase, Railway) require
    // SSL but use certs that Node won't validate by default — this is the
    // standard safe-enough setting for that. Set PGSSL=false to disable
    // entirely (e.g. local Postgres in Docker).
    ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
  });

  async function query(text, params) {
    return pool.query(text, params);
  }

  async function createSchema() {
    await query(`
      CREATE TABLE IF NOT EXISTS questions (
        id         TEXT PRIMARY KEY,
        data       JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS topics (
        name       TEXT PRIMARY KEY,
        data       JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS results (
        id         SERIAL PRIMARY KEY,
        data       JSONB NOT NULL,
        saved_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  }

  async function seedIfEmpty() {
    const { rows: [{ count: qCount }] } = await query('SELECT COUNT(*)::int AS count FROM questions');
    if (Number(qCount) === 0) {
      const all = [...SEED_QUESTIONS, ...SABHA_QUESTIONS];
      for (const q of all) {
        await query('INSERT INTO questions (id, data) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING', [q.id, q]);
      }
      console.log(`[db:pg] Seeded question bank with ${all.length} questions (incl. Sabha).`);
    }

    const { rows: [{ count: tCount }] } = await query('SELECT COUNT(*)::int AS count FROM topics');
    if (Number(tCount) === 0) {
      const all = [...SEED_TOPICS.map(t => ({ name: t.name, emoji: t.emoji, color: t.color })), SABHA_TOPIC];
      for (const t of all) {
        await query('INSERT INTO topics (name, data) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING', [t.name, t]);
      }
      console.log(`[db:pg] Seeded ${all.length} topics (incl. Sabha).`);
    } else {
      // Make sure Sabha exists even on a DB that predates this feature.
      const existing = await query('SELECT 1 FROM topics WHERE lower(name) = lower($1)', [SABHA_TOPIC.name]);
      if (existing.rowCount === 0) {
        await query('INSERT INTO topics (name, data) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING', [SABHA_TOPIC.name, SABHA_TOPIC]);
      }
    }
  }

  pgImpl = {
    async init() {
      await createSchema();
      await seedIfEmpty();
      const { rows: [{ count: qc }] } = await query('SELECT COUNT(*)::int AS count FROM questions');
      const { rows: [{ count: tc }] } = await query('SELECT COUNT(*)::int AS count FROM topics');
      const { rows: [{ count: rc }] } = await query('SELECT COUNT(*)::int AS count FROM results');
      console.log(`[db:pg] Ready — ${qc} questions, ${tc} topics, ${rc} saved results. (PostgreSQL)`);
    },

    async getQuestions() {
      const { rows } = await query('SELECT data FROM questions ORDER BY created_at ASC');
      return rows.map(r => r.data);
    },
    async findQuestion(id) {
      const { rows } = await query('SELECT data FROM questions WHERE id = $1', [id]);
      return rows[0] ? rows[0].data : null;
    },
    async addQuestion(q) {
      await query('INSERT INTO questions (id, data) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET data = $2', [q.id, q]);
      return { ...q };
    },
    async updateQuestion(id, patch) {
      const { rows } = await query('SELECT data FROM questions WHERE id = $1', [id]);
      if (!rows[0]) return null;
      const merged = { ...rows[0].data, ...patch, id };
      await query('UPDATE questions SET data = $1 WHERE id = $2', [merged, id]);
      return merged;
    },
    async deleteQuestion(id) {
      const { rowCount } = await query('DELETE FROM questions WHERE id = $1', [id]);
      return rowCount > 0;
    },

    async getTopics() {
      const { rows } = await query('SELECT data FROM topics ORDER BY name ASC');
      return rows.map(r => r.data);
    },
    async addTopic({ name, emoji, color }) {
      const clean = String(name || '').trim();
      if (!clean) return null;
      const { rows: existingRows } = await query('SELECT data FROM topics WHERE lower(name) = lower($1)', [clean]);
      if (existingRows[0]) return existingRows[0].data;
      const t = { name: clean, emoji: emoji || '📚', color: color || '#4F8CFF' };
      await query('INSERT INTO topics (name, data) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING', [t.name, t]);
      return t;
    },

    async saveResult(result) {
      const withTimestamp = { ...result, savedAt: new Date().toISOString() };
      await query('INSERT INTO results (data) VALUES ($1)', [withTimestamp]);
      // Cap history at 500, same as the old JSON-file behaviour.
      await query(`
        DELETE FROM results WHERE id NOT IN (
          SELECT id FROM results ORDER BY saved_at DESC LIMIT 500
        )
      `);
      return true;
    },
    async getResults() {
      const { rows } = await query('SELECT data FROM results ORDER BY saved_at DESC LIMIT 500');
      return rows.map(r => r.data);
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// JSON-FILE BACKEND (fallback for local dev / no DATABASE_URL configured)
// ════════════════════════════════════════════════════════════════════════════
const DATA_DIR      = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'db');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const TOPICS_FILE    = path.join(DATA_DIR, 'topics.json');
const RESULTS_FILE   = path.join(DATA_DIR, 'results.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`[db:json] Failed to read ${path.basename(file)}: ${err.message} — using fallback`);
    return fallback;
  }
}

function writeJSON(file, data) {
  ensureDir();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file); // atomic on same filesystem
}

let questions = [];
let topics    = [];
let results   = [];

function seedTopicsFrom(list) {
  return list.map(t => ({ name: t.name, emoji: t.emoji, color: t.color }));
}

const jsonImpl = {
  async init() {
    ensureDir();

    const loadedQ = readJSON(QUESTIONS_FILE, null);
    if (Array.isArray(loadedQ)) {
      questions = loadedQ;
    } else {
      questions = [...SEED_QUESTIONS, ...SABHA_QUESTIONS];
      writeJSON(QUESTIONS_FILE, questions);
      console.log(`[db:json] Seeded question bank with ${questions.length} questions (incl. Sabha).`);
    }

    const loadedT = readJSON(TOPICS_FILE, null);
    if (Array.isArray(loadedT)) {
      topics = loadedT;
    } else {
      topics = [...seedTopicsFrom(SEED_TOPICS), SABHA_TOPIC];
      writeJSON(TOPICS_FILE, topics);
      console.log(`[db:json] Seeded ${topics.length} topics (incl. Sabha).`);
    }
    if (!topics.some(t => t.name.toLowerCase() === 'sabha')) {
      topics.push(SABHA_TOPIC);
      writeJSON(TOPICS_FILE, topics);
    }

    results = readJSON(RESULTS_FILE, []);
    if (!Array.isArray(results)) results = [];

    console.log(`[db:json] Ready — ${questions.length} questions, ${topics.length} topics, ${results.length} saved results. (JSON files — set DATABASE_URL for real Postgres persistence)`);
  },

  async getQuestions() { return questions.map(q => ({ ...q })); },
  async findQuestion(id) {
    const q = questions.find(x => x.id === id);
    return q ? { ...q } : null;
  },
  async addQuestion(q) {
    questions.push(q);
    writeJSON(QUESTIONS_FILE, questions);
    return { ...q };
  },
  async updateQuestion(id, patch) {
    const idx = questions.findIndex(q => q.id === id);
    if (idx === -1) return null;
    questions[idx] = { ...questions[idx], ...patch, id };
    writeJSON(QUESTIONS_FILE, questions);
    return { ...questions[idx] };
  },
  async deleteQuestion(id) {
    const before = questions.length;
    questions = questions.filter(q => q.id !== id);
    if (questions.length === before) return false;
    writeJSON(QUESTIONS_FILE, questions);
    return true;
  },

  async getTopics() { return topics.map(t => ({ ...t })); },
  async addTopic({ name, emoji, color }) {
    const clean = String(name || '').trim();
    if (!clean) return null;
    const existing = topics.find(t => t.name.toLowerCase() === clean.toLowerCase());
    if (existing) return { ...existing };
    const t = { name: clean, emoji: emoji || '📚', color: color || '#4F8CFF' };
    topics.push(t);
    writeJSON(TOPICS_FILE, topics);
    return { ...t };
  },

  async saveResult(result) {
    results.unshift({ ...result, savedAt: new Date().toISOString() });
    if (results.length > 500) results = results.slice(0, 500);
    writeJSON(RESULTS_FILE, results);
    return true;
  },
  async getResults() { return results.map(r => ({ ...r })); },
};

// ════════════════════════════════════════════════════════════════════════════
// EXPORT — pick the active backend
// ════════════════════════════════════════════════════════════════════════════
const impl = USE_PG ? pgImpl : jsonImpl;

module.exports = {
  init:            impl.init,
  getQuestions:    impl.getQuestions,
  findQuestion:    impl.findQuestion,
  addQuestion:     impl.addQuestion,
  updateQuestion:  impl.updateQuestion,
  deleteQuestion:  impl.deleteQuestion,
  getTopics:       impl.getTopics,
  addTopic:        impl.addTopic,
  saveResult:      impl.saveResult,
  getResults:      impl.getResults,
  backend:         USE_PG ? 'postgres' : 'json',
};
