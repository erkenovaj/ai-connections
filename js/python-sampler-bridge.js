// Bridge between JS game logic and Python samplers running in Pyodide.
//
// This module is optional: if Pyodide fails to load for any reason,
// callers should fall back to the existing JS PuzzleGenerator.

let pyodidePromise = null;
let pySamplerLastError = null;
const PY_MOUNT_DIR = '/home/py_sampler';

function formatError(err) {
    if (err == null) return '';
    if (typeof err === 'string') return err;
    try {
        const parts = [];
        if (err.name) parts.push(`name=${err.name}`);
        if (err.message) parts.push(`message=${err.message}`);
        if (err.type) parts.push(`type=${err.type}`);
        if (err.stack) parts.push(`stack=${String(err.stack).split('\n').slice(0, 4).join(' | ')}`);
        const keys = Object.keys(err || {});
        if (keys.length > 0) {
            const json = JSON.stringify(err, (k, v) => {
                if (typeof v === 'bigint') return String(v);
                return v;
            });
            if (json && json !== '{}') parts.push(`json=${json}`);
        }
        const asString = String(err);
        if (asString && asString !== '[object Object]') parts.push(`toString=${asString}`);
        return parts.length ? parts.join('; ') : asString;
    } catch {
        return String(err);
    }
}

function setLastError(err) {
    pySamplerLastError = err;
    if (typeof window !== 'undefined') {
        window.__pySamplerLastError = formatError(err);
    }
}

async function ensurePyodideLoader() {
    if (typeof loadPyodide === 'function') return;
    const candidates = [
        'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js',
        'https://unpkg.com/pyodide@0.26.1/pyodide.js'
    ];
    let lastErr = null;
    for (const src of candidates) {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.async = true;
                script.onload = resolve;
                script.onerror = () => reject(new Error(`Failed to load ${src}`));
                document.head.appendChild(script);
            });
            if (typeof loadPyodide === 'function') return;
        } catch (err) {
            lastErr = err;
        }
    }
    throw lastErr || new Error('Could not load pyodide.js from known CDNs');
}

async function loadPyodideOnce() {
    if (pyodidePromise) return pyodidePromise;

    pyodidePromise = (async () => {
        try {
            // Ensure pyodide loader is available (script tag or dynamic load).
            await ensurePyodideLoader();
            const pyodide = await loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/'
            });

            // Load sampler code from python package files bundled with the app.
            // Mount under a dedicated directory and add it to sys.path.
            const fileSpecs = [
                { path: `${PY_MOUNT_DIR}/python/__init__.py`, url: 'python/__init__.py' },
                { path: `${PY_MOUNT_DIR}/python/shared.py`, url: 'python/shared.py' },
                { path: `${PY_MOUNT_DIR}/python/game_sampler.py`, url: 'python/game_sampler.py' },
                { path: `${PY_MOUNT_DIR}/python/game_sampler_v2.py`, url: 'python/game_sampler_v2.py' }
            ];

            // Robust directory creation to avoid ErrnoError on repeated/mixed states.
            const ensureDir = (dirPath) => {
                const parts = dirPath.split('/').filter(Boolean);
                let cur = '';
                for (const part of parts) {
                    cur += `/${part}`;
                    const info = pyodide.FS.analyzePath(cur);
                    if (!info.exists) {
                        pyodide.FS.mkdir(cur);
                    } else if (!info.object || !pyodide.FS.isDir(info.object.mode)) {
                        throw new Error(`FS path exists but is not a directory: ${cur}`);
                    }
                }
            };
            ensureDir(`${PY_MOUNT_DIR}/python`);

            for (const spec of fileSpecs) {
                const resp = await fetch(spec.url);
                if (!resp.ok) {
                    throw new Error(`Failed to fetch ${spec.url}: ${resp.statusText}`);
                }
                const code = await resp.text();
                pyodide.FS.writeFile(spec.path, code);
            }

            // Import modules once so they're ready for use.
            await pyodide.runPythonAsync(`
import sys
if "${PY_MOUNT_DIR}" not in sys.path:
    sys.path.insert(0, "${PY_MOUNT_DIR}")
import python.game_sampler, python.game_sampler_v2
`);

            return pyodide;
        } catch (err) {
            setLastError(err);
            console.warn('Pyodide / Python samplers unavailable:', err);
            return null;
        }
    })();

    return pyodidePromise;
}

/**
 * Try to sample a puzzle using the Python V2 sampler.
 *
 * @param {'normal'|'advanced'} mode - Game mode. Normal = 4 categories,
 *     advanced = 3 categories + 4 red-herring decoys.
 * @param {Array} categoryTemplates - Parsed JSON from configs/category-templates-new.json.
 * @param {string|null} seed - Optional deterministic seed (used for lobby rounds).
 * @returns {Promise<object|null>} - Game object on success, or null on failure.
 */
export async function trySampleWithPython(mode, categoryTemplates, seed = null) {
    const pyodide = await loadPyodideOnce();
    if (!pyodide) return null;

    try {
        const pyConfig = pyodide.toPy(categoryTemplates);
        // Convert seed string into a stable 32-bit int for Python's RNG.
        const seedInt = seed === null ? null : Array.from(String(seed)).reduce(
            (acc, ch) => ((acc * 31) + ch.charCodeAt(0)) >>> 0,
            0
        );
        const code = `
import random
from python.game_sampler_v2 import sample_game_v2

def _run_sampler(mode, config, seed_int):
    num_categories = 4 if mode == "normal" else 3
    rng = random.Random(seed_int) if seed_int is not None else None
    return sample_game_v2(config, num_categories=num_categories, rng=rng)
`;
        await pyodide.runPythonAsync(code);
        const runFunc = pyodide.globals.get('_run_sampler');
        const result = runFunc(mode, pyConfig, seedInt);

        let game = null;
        if (result && typeof result.toJs === 'function') {
            game = result.toJs({ dict_converter: Object.fromEntries });
            if (typeof result.destroy === 'function') result.destroy();
        } else if (pyodide.ffi && typeof pyodide.ffi.to_js === 'function') {
            game = pyodide.ffi.to_js(result);
        } else {
            game = result;
        }
        setLastError(null);
        return game ?? null;
    } catch (err) {
        setLastError(err);
        console.warn('Python sampling failed:', err);
        return null;
    }
}

