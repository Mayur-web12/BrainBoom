'use strict';
/**
 * In-memory store — swap these with DB calls later.
 * All mutations go through helper functions so callers don't touch the map directly.
 */

const sessions = new Map();   // code → SessionObject
const mentors  = new Map();   // socketId → { email, sessionCode }
const players  = new Map();   // socketId → PlayerObject

// ── SESSION HELPERS ────────────────────────────────────────────────────────
function createSession(code, data) {
  sessions.set(code, data);
  return sessions.get(code);
}

function getSession(code) {
  return sessions.get(code) || null;
}

function updateSession(code, updater) {
  const s = sessions.get(code);
  if (!s) return null;
  const updated = typeof updater === 'function' ? updater(s) : { ...s, ...updater };
  sessions.set(code, updated);
  return updated;
}

function deleteSession(code) {
  sessions.delete(code);
}

function getAllSessions() {
  return Array.from(sessions.values());
}

// ── PLAYER HELPERS ─────────────────────────────────────────────────────────
function addPlayer(socketId, data) {
  players.set(socketId, data);
}

function getPlayer(socketId) {
  return players.get(socketId) || null;
}

function removePlayer(socketId) {
  const p = players.get(socketId);
  players.delete(socketId);
  return p;
}

function getPlayersInSession(code) {
  return Array.from(players.values()).filter(p => p.sessionCode === code);
}

function updatePlayer(socketId, data) {
  players.set(socketId, data);
  return data;
}

// ── MENTOR HELPERS ─────────────────────────────────────────────────────────
function setMentor(socketId, data) {
  mentors.set(socketId, data);
}

function getMentor(socketId) {
  return mentors.get(socketId) || null;
}

function removeMentor(socketId) {
  mentors.delete(socketId);
}

module.exports = {
  createSession, getSession, updateSession, deleteSession, getAllSessions,
  addPlayer, getPlayer, updatePlayer, removePlayer, getPlayersInSession,
  setMentor, getMentor, removeMentor,
};
