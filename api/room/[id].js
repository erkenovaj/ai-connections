import { getDb } from '../../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Room id required' });
  try {
    const db = await getDb();
    const roomResult = await db.execute({
      sql: 'SELECT id, mode, puzzle_seed, rounds FROM rooms WHERE id = ?',
      args: [id],
    });
    const row = roomResult.rows[0];
    if (!row) return res.status(404).json({ error: 'Room not found' });
    const resultsResult = await db.execute({
      sql: 'SELECT player_name, score, time_seconds, won, round_number, created_at FROM room_results WHERE room_id = ? ORDER BY round_number ASC, score DESC, time_seconds ASC',
      args: [row.id],
    });
    const rounds = row.rounds != null ? Number(row.rounds) : 1;
    res.status(200).json({
      roomId: row.id,
      mode: row.mode,
      seed: row.puzzle_seed,
      rounds,
      results: resultsResult.rows,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message) });
  }
}
