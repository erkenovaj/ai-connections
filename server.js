import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// On Vercel we use serverless api/ + Turso; do not run SQLite or create data/
// Also skip if we can't create data/ (read-only fs, e.g. Vercel without VERCEL env)
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === true;
let dataDir;
try {
  dataDir = path.join(__dirname, 'data');
  if (!isVercel && !fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
} catch (e) {
  dataDir = null; // read-only filesystem
}
if (!isVercel && dataDir) {
// SQLite database
const dbPath = path.join(dataDir, 'game.db');
const db = new Database(dbPath);

// Base schema (for fresh databases)
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    puzzle_seed TEXT NOT NULL,
    rounds INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS room_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    time_seconds INTEGER NOT NULL,
    won INTEGER NOT NULL,
    round_number INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
  );
  CREATE TABLE IF NOT EXISTS solo_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    time_seconds INTEGER NOT NULL,
    mode TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_room_results_room ON room_results(room_id);
  CREATE INDEX IF NOT EXISTS idx_solo_results_score ON solo_results(score DESC);
`);

// Lightweight migration for existing databases (add new columns if missing)
try {
  db.prepare('ALTER TABLE rooms ADD COLUMN rounds INTEGER NOT NULL DEFAULT 1').run();
} catch (_) {
  // Column already exists; ignore
}

try {
  db.prepare('ALTER TABLE room_results ADD COLUMN round_number INTEGER NOT NULL DEFAULT 1').run();
} catch (_) {
  // Column already exists; ignore
}

function randomId(len = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Create room
app.post('/api/room', (req, res) => {
  try {
    const mode = req.body.mode === 'advanced' ? 'advanced' : 'normal';
    const rounds = Math.max(1, Math.min(10, Number(req.body.rounds) || 1));
    const id = randomId();
    const puzzle_seed = id + '-' + Date.now();
    const created_at = Date.now();
    db.prepare('INSERT INTO rooms (id, mode, puzzle_seed, rounds, created_at) VALUES (?, ?, ?, ?, ?)').run(id, mode, puzzle_seed, rounds, created_at);
    const origin = req.get('origin') || req.protocol + '://' + req.get('host');
    const joinLink = `${origin}?room=${id}`;
    res.json({ roomId: id, joinLink, seed: puzzle_seed, mode, rounds });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
});

// Get room info (for joining)
app.get('/api/room/:id', (req, res) => {
  const row = db.prepare('SELECT id, mode, puzzle_seed, rounds FROM rooms WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Room not found' });
  const results = db.prepare(
    'SELECT player_name, score, time_seconds, won, round_number, created_at FROM room_results WHERE room_id = ? ORDER BY round_number ASC, score DESC, time_seconds ASC'
  ).all(row.id);
  const rounds = row.rounds ? Number(row.rounds) : 1;
  res.json({ roomId: row.id, mode: row.mode, seed: row.puzzle_seed, rounds: rounds, results });
});

// Submit room result
app.post('/api/room/:id/result', (req, res) => {
  const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const { playerName, score, timeSeconds, won, roundNumber } = req.body;
  const name = (playerName && String(playerName).trim()) || 'Anonymous';
  const round = Math.max(1, Number(roundNumber) || 1);
  const created_at = Date.now();
  db.prepare(
    'INSERT INTO room_results (room_id, player_name, score, time_seconds, won, round_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, name.substring(0, 50), Number(score) || 0, Number(timeSeconds) || 0, won ? 1 : 0, round, created_at);
  res.json({ ok: true });
});

// Get room leaderboard
app.get('/api/room/:id/leaderboard', (req, res) => {
  const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const roundFilter = req.query.round ? ` AND round_number = ${Number(req.query.round)}` : '';
  const results = db.prepare(
    `SELECT player_name AS playerName, score, time_seconds AS timeSeconds, won, round_number AS roundNumber, created_at AS createdAt FROM room_results WHERE room_id = ?${roundFilter} ORDER BY round_number ASC, score DESC, time_seconds ASC`
  ).all(req.params.id);
  res.json(results);
});

// Solo: submit result
app.post('/api/solo/result', (req, res) => {
  const { playerName, score, timeSeconds, mode } = req.body;
  const name = (playerName && String(playerName).trim()) || 'Anonymous';
  const created_at = Date.now();
  db.prepare(
    'INSERT INTO solo_results (player_name, score, time_seconds, mode, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(name.substring(0, 50), Number(score) || 0, Number(timeSeconds) || 0, mode === 'advanced' ? 'advanced' : 'normal', created_at);
  res.json({ ok: true });
});

// Solo: get leaderboard (top 50)
app.get('/api/solo/leaderboard', (req, res) => {
  const mode = req.query.mode === 'advanced' ? 'advanced' : 'normal';
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const rows = db.prepare(
    'SELECT player_name AS playerName, score, time_seconds AS timeSeconds, mode, created_at AS createdAt FROM solo_results WHERE mode = ? ORDER BY score DESC, time_seconds ASC LIMIT ?'
  ).all(mode, limit);
  res.json(rows);
});

app.listen(PORT, () => {
  console.log(`AI Safety Connections server at http://localhost:${PORT}`);
});
}
