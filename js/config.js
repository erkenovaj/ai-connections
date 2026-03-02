// Game configuration and constants
const CONFIG = {
    MAX_MISTAKES: 4,
    CONCEPTS_PER_GROUP: 4,
    TOTAL_CATEGORIES_NORMAL: 4,
    TOTAL_CATEGORIES_ADVANCED: 3,
    DOG_UPDATE_INTERVAL: 10000,
    TOOLTIP_DELAY: 300
};

// Concept definitions and category templates are now derived from the JSON config.
// They are kept mutable so that we can populate them once at module load time.
let CONCEPT_DEFINITIONS = {};
let CATEGORY_TEMPLATES = [];

// Load item-based config from JSON file and derive concept definitions and categories.
async function loadGameConfig() {
    try {
        const url = new URL('../configs/category-templates.json', import.meta.url).href;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load game config: ${response.statusText}`);
        }

        const items = await response.json();
        if (!Array.isArray(items)) {
            throw new Error('Game config must be an array of items.');
        }

        CONCEPT_DEFINITIONS = {};
        const categoryMap = new Map(); // tag -> Set of item names

        for (const raw of items) {
            if (!raw || typeof raw !== 'object') continue;

            const name = typeof raw.name === 'string' ? raw.name : null;
            if (!name) continue;

            const description = typeof raw.description === 'string' ? raw.description : '';
            const rawTags = Array.isArray(raw.tags) ? raw.tags : [];
            const tags = rawTags
                .map(t => (typeof t === 'string' ? t : String(t)))
                .filter(Boolean);

            // Populate concept definitions for tooltips/dictionary.
            CONCEPT_DEFINITIONS[name] = description;

            // Build category membership from tags.
            for (const tag of tags) {
                if (!categoryMap.has(tag)) {
                    categoryMap.set(tag, new Set());
                }
                categoryMap.get(tag).add(name);
            }
        }

        // Derive CATEGORY_TEMPLATES from categoryMap, keeping only categories
        // that have at least CONCEPTS_PER_GROUP members.
        CATEGORY_TEMPLATES = [];
        for (const [tag, membersSet] of categoryMap.entries()) {
            const members = Array.from(membersSet);
            if (members.length >= CONFIG.CONCEPTS_PER_GROUP) {
                CATEGORY_TEMPLATES.push({
                    name: tag,
                    members
                });
            }
        }
    } catch (error) {
        // In production we might want to surface this more clearly,
        // but for now we fail silently and let the JS fallback handle it.
        // console.warn('Failed to load game config:', error);
    }
}

// Initialize config-derived data immediately at module load.
await loadGameConfig();

export { CONFIG, CONCEPT_DEFINITIONS, CATEGORY_TEMPLATES };