// Bridge between JS game logic and Python samplers running in Pyodide.
//
// This module is optional: if Pyodide fails to load for any reason,
// callers should fall back to the existing JS PuzzleGenerator.

let pyodidePromise = null;

async function loadPyodideOnce() {
    if (pyodidePromise) return pyodidePromise;

    pyodidePromise = (async () => {
        try {
            // Expect pyodide.js to be available globally (e.g. via <script> tag).
            if (typeof loadPyodide !== 'function') {
                throw new Error('loadPyodide is not available on window');
            }
            const pyodide = await loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/'
            });

            // Load sampler code from python package files bundled with the app.
            // We mount them into Pyodide's virtual filesystem so that
            // `import python.game_sampler` etc. works.
            const fileSpecs = [
                { path: 'python/__init__.py', url: 'python/__init__.py' },
                { path: 'python/shared.py', url: 'python/shared.py' },
                { path: 'python/game_sampler.py', url: 'python/game_sampler.py' },
                { path: 'python/game_sampler_v2.py', url: 'python/game_sampler_v2.py' }
            ];

            pyodide.FS.mkdirTree('python');
            for (const spec of fileSpecs) {
                const resp = await fetch(spec.url);
                if (!resp.ok) {
                    throw new Error(`Failed to fetch ${spec.url}: ${resp.statusText}`);
                }
                const code = await resp.text();
                pyodide.FS.writeFile(spec.path, code);
            }

            // Import modules once so they're ready for use.
            await pyodide.runPythonAsync('import python.game_sampler, python.game_sampler_v2');

            return pyodide;
        } catch (err) {
            console.warn('Pyodide / Python samplers unavailable:', err);
            return null;
        }
    })();

    return pyodidePromise;
}

/**
 * Try to sample a puzzle using the Python sampler.
 *
 * @param {'1'|'2'} version - '1' for disjoint categories, '2' for private categories.
 * @param {Array} categoryTemplates - Parsed JSON from configs/category-templates.json.
 * @returns {Promise<object|null>} - Game object on success, or null on failure.
 */
export async function trySampleWithPython(version, categoryTemplates) {
    const pyodide = await loadPyodideOnce();
    if (!pyodide) return null;

    try {
        const pyConfig = pyodide.toPy(categoryTemplates);
        const code = `
from python.game_sampler import sample_game_v1
from python.game_sampler_v2 import sample_game_v2

def _run_sampler(version, config):
    if version == "1":
        return sample_game_v1(config)
    else:
        return sample_game_v2(config)
`;
        await pyodide.runPythonAsync(code);
        const runFunc = pyodide.globals.get('_run_sampler');
        const result = runFunc(version, pyConfig);
        const game = pyodide.toJs(result);
        return game ?? null;
    } catch (err) {
        console.warn('Python sampling failed:', err);
        return null;
    }
}

