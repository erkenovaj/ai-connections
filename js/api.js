/**
 * API client for AI Safety Connections backend.
 * Uses same origin when served from Node (e.g. http://localhost:3000).
 */
const getBase = () => (typeof window !== 'undefined' ? window.location.origin : '');

export async function createRoom(mode = 'normal') {
    const res = await fetch(`${getBase()}/api/room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getRoom(roomId) {
    const res = await fetch(`${getBase()}/api/room/${roomId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function submitRoomResult(roomId, { playerName, score, timeSeconds, won }) {
    const res = await fetch(`${getBase()}/api/room/${roomId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, score, timeSeconds, won })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getRoomLeaderboard(roomId) {
    const res = await fetch(`${getBase()}/api/room/${roomId}/leaderboard`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function submitSoloResult({ playerName, score, timeSeconds, mode }) {
    const res = await fetch(`${getBase()}/api/solo/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, score, timeSeconds, mode })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getSoloLeaderboard(mode = 'normal', limit = 20) {
    const res = await fetch(`${getBase()}/api/solo/leaderboard?mode=${encodeURIComponent(mode)}&limit=${limit}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export function isApiAvailable() {
    return true;
}
