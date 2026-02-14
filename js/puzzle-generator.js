import { CONCEPT_DEFINITIONS, CATEGORY_TEMPLATES, CONFIG } from './config.js';

const DIFFICULTIES = ['easy', 'medium', 'hard', 'harder'];

class PuzzleGenerator {
    /**
     * @param {'normal'|'advanced'} mode - 'normal' = 4 categories (16 tiles), 'advanced' = 3 categories (12 + 4 decoys)
     */
    static generatePuzzle(mode = 'normal') {
        if (!Array.isArray(CATEGORY_TEMPLATES) || CATEGORY_TEMPLATES.length === 0) {
            throw new Error('Cannot generate puzzle: category templates not loaded. Check that category-templates.json is deployed (e.g. on GitHub Pages).');
        }
        const allConcepts = Object.keys(CONCEPT_DEFINITIONS);
        const numCategories = mode === 'normal'
            ? CONFIG.TOTAL_CATEGORIES_NORMAL
            : CONFIG.TOTAL_CATEGORIES_ADVANCED;

        const shuffledCategories = [...CATEGORY_TEMPLATES].sort(() => Math.random() - 0.5);
        const selectedCategories = shuffledCategories.slice(0, numCategories);

        const allPuzzleConcepts = new Set();
        selectedCategories.forEach(category => {
            category.members.forEach(concept => allPuzzleConcepts.add(concept));
        });

        const neededConcepts = 16 - allPuzzleConcepts.size;
        if (neededConcepts > 0) {
            const availableDecoys = allConcepts.filter(concept => !allPuzzleConcepts.has(concept));
            const decoys = availableDecoys.sort(() => Math.random() - 0.5).slice(0, neededConcepts);
            decoys.forEach(decoy => allPuzzleConcepts.add(decoy));
        }

        const boardConcepts = Array.from(allPuzzleConcepts).sort(() => Math.random() - 0.5);

        const categories = {};
        selectedCategories.forEach((cat, i) => {
            const d = DIFFICULTIES[i];
            categories[d] = { ...cat, difficulty: d };
        });

        return {
            board: boardConcepts,
            categories,
            numCategories
        };
    }

    /**
     * Use a pre-generated puzzle (e.g. from a room). Validates structure.
     * @param {object} stored - { board, categories, numCategories }
     */
    static fromStored(stored) {
        if (!stored || !Array.isArray(stored.board) || !stored.categories || typeof stored.numCategories !== 'number') {
            throw new Error('Invalid stored puzzle');
        }
        return { ...stored };
    }
}

export default PuzzleGenerator;