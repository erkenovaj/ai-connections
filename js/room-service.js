/**
 * Room service: create/join rooms, submit results.
 * Uses Supabase when configured; Airtable as optional export.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import ROOM_CONFIG, { isRoomServiceAvailable } from './room-config.js';
import PuzzleGenerator from './puzzle-generator.js';

const STORAGE_KEYS = {
    AIRTABLE_BASE: 'ai_connections_airtable_base',
    AIRTABLE_KEY: 'ai_connections_airtable_key',
};

let supabase = null;

function getSupabase() {
    if (!isRoomServiceAvailable()) return null;
    try {
        if (!supabase) {
            supabase = createClient(ROOM_CONFIG.SUPABASE_URL, ROOM_CONFIG.SUPABASE_ANON_KEY);
        }
        return supabase;
    } catch (e) {
        return null;
    }
}

/** Generate a short room code (6 chars) */
function shortCode() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
}

/**
 * Create a room. Returns { roomId, adminSecret, roomLink, playerLink, puzzle } or error.
 */
export async function createRoom(gameMode = 'normal', requiresAuth = false) {
    const sb = getSupabase();
    if (!sb) return { error: 'Room service not configured. Add Supabase URL and key to room-config.js' };

    const puzzle = PuzzleGenerator.generatePuzzle(gameMode);
    const roomId = shortCode();
    const adminSecret = requiresAuth ? shortCode() + shortCode() : null;

    const { data, error } = await sb.from('rooms').insert({
        id: roomId,
        puzzle,
        game_mode: gameMode,
        admin_secret: adminSecret,
        requires_auth: !!requiresAuth,
    }).select().single();

    if (error) return { error: error.message };

    const base = window.location.origin + window.location.pathname;
    const roomLink = `${base}?room=${roomId}&admin=1`;
    const playerLink = `${base}?room=${roomId}`;

    if (adminSecret) {
        sessionStorage.setItem(`room_admin_${roomId}`, adminSecret);
    }

    return {
        roomId,
        adminSecret,
        roomLink: adminSecret ? `${roomLink}#${adminSecret}` : roomLink,
        playerLink,
        puzzle,
        gameMode,
    };
}

/**
 * Join a room by ID. Returns { puzzle, gameMode } or error.
 */
export async function joinRoom(roomId) {
    const sb = getSupabase();
    if (!sb) return { error: 'Room service not configured' };

    const { data, error } = await sb.from('rooms').select('puzzle, game_mode').eq('id', roomId).single();
    if (error || !data) return { error: error?.message || 'Room not found' };

    return {
        puzzle: PuzzleGenerator.fromStored(data.puzzle),
        gameMode: data.game_mode || 'normal',
    };
}

/**
 * Submit a player's result to the room.
 */
export async function submitResult(roomId, { playerName, score, timeSeconds, won }) {
    const sb = getSupabase();
    if (!sb) return { error: 'Room service not configured' };

    const { error } = await sb.from('results').insert({
        room_id: roomId,
        player_name: (playerName || 'Anonymous').substring(0, 50),
        score: score ?? 0,
        time_seconds: timeSeconds ?? 0,
        won: !!won,
    });

    if (error) return { error: error.message };
    return { ok: true };
}

/**
 * Fetch all results for a room (admin view).
 */
export async function getRoomResults(roomId, adminSecret = null) {
    const sb = getSupabase();
    if (!sb) return { error: 'Room service not configured' };

    const roomRes = await sb.from('rooms').select('requires_auth, admin_secret').eq('id', roomId).single();
    if (roomRes.error || !roomRes.data) return { error: 'Room not found' };

    if (roomRes.data.requires_auth && roomRes.data.admin_secret !== adminSecret) {
        const stored = sessionStorage.getItem(`room_admin_${roomId}`);
        if (roomRes.data.admin_secret !== adminSecret && roomRes.data.admin_secret !== stored) {
            return { error: 'Admin secret required', requiresAuth: true };
        }
    }

    const { data, error } = await sb.from('results').select('*').eq('room_id', roomId).order('score', { ascending: false });
    if (error) return { error: error.message };
    return { results: data || [] };
}

/**
 * Export results to Airtable. Admin provides base ID and API key (or from config).
 */
export async function exportToAirtable(roomId, results, airtableBaseId = null, airtableApiKey = null) {
    const baseId = airtableBaseId || ROOM_CONFIG.AIRTABLE_BASE_ID || localStorage.getItem(STORAGE_KEYS.AIRTABLE_BASE);
    const apiKey = airtableApiKey || ROOM_CONFIG.AIRTABLE_API_KEY || localStorage.getItem(STORAGE_KEYS.AIRTABLE_KEY);

    if (!baseId || !apiKey) {
        return { error: 'Airtable credentials required. Enter Base ID and API key.' };
    }

    const url = `https://api.airtable.com/v0/${baseId}/Results`;
    const records = results.map(r => ({
        fields: {
            Room: roomId,
            Player: r.player_name || 'Anonymous',
            Score: r.score,
            TimeSeconds: r.time_seconds,
            Won: r.won,
            Date: new Date().toISOString(),
        },
    }));

    try {
        for (let i = 0; i < records.length; i += 10) {
            const batch = records.slice(i, i + 10);
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ records: batch }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return { error: err.error?.message || `Airtable error: ${res.status}` };
            }
        }
        return { ok: true };
    } catch (e) {
        return { error: e.message || 'Export failed' };
    }
}

export function saveAirtableCreds(baseId, apiKey) {
    if (baseId) localStorage.setItem(STORAGE_KEYS.AIRTABLE_BASE, baseId);
    if (apiKey) localStorage.setItem(STORAGE_KEYS.AIRTABLE_KEY, apiKey);
}

export { isRoomServiceAvailable };
