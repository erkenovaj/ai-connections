/**
 * Pure game rules for Connections. No DOM dependency.
 * Used by game.js and by tests.
 */

const CONFIG = {
    MAX_MISTAKES: 4,
    CONCEPTS_PER_GROUP: 4,
    TOTAL_CATEGORIES_NORMAL: 4,
};

/**
 * Check if two sets have the same elements.
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {boolean}
 */
function setsAreEqual(setA, setB) {
    return setA.size === setB.size && [...setA].every(item => setB.has(item));
}

/**
 * Evaluate a guess: exactly four words; correct only if all four belong to the same category.
 * Partial correctness (e.g. 3/4) is incorrect.
 *
 * @param {Object} puzzle - { categories: { [difficulty]: { name, members } }, numCategories }
 * @param {string[]} selectedConcepts - exactly 4 concepts
 * @returns {{ correct: boolean, matchedCategory?: Object, difficulty?: string }}
 */
function evaluateGuess(puzzle, selectedConcepts) {
    if (!Array.isArray(selectedConcepts) || selectedConcepts.length !== CONFIG.CONCEPTS_PER_GROUP) {
        return { correct: false };
    }
    const selectedSet = new Set(selectedConcepts);
    if (selectedSet.size !== selectedConcepts.length) {
        return { correct: false }; // duplicates
    }
    for (const [difficulty, category] of Object.entries(puzzle.categories)) {
        const categorySet = new Set(category.members);
        if (setsAreEqual(categorySet, selectedSet)) {
            return { correct: true, matchedCategory: category, difficulty };
        }
    }
    return { correct: false };
}

/**
 * Game end status.
 * @param {number} mistakes
 * @param {number} solvedCategories
 * @param {number} numCategories
 * @returns {'playing'|'won'|'lost'}
 */
function getGameStatus(mistakes, solvedCategories, numCategories) {
    if (mistakes >= CONFIG.MAX_MISTAKES) return 'lost';
    if (solvedCategories >= numCategories) return 'won';
    return 'playing';
}

/**
 * Validate puzzle structure per Connections rules:
 * - 16 words on the board
 * - Exactly 4 categories (normal mode)
 * - Each category has exactly 4 members
 * - Every board word appears in exactly one category (unique solution)
 * - No word repeated on board
 *
 * @param {Object} puzzle - { board, categories, numCategories }
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePuzzleStructure(puzzle) {
    const errors = [];
    const expectedBoardSize = 16;
    const expectedGroups = puzzle.numCategories ?? 4;
    const expectedPerGroup = CONFIG.CONCEPTS_PER_GROUP;

    if (!puzzle.board || !Array.isArray(puzzle.board)) {
        errors.push('Puzzle has no board array');
        return { valid: false, errors };
    }
    if (puzzle.board.length !== expectedBoardSize) {
        errors.push(`Board must have exactly ${expectedBoardSize} words, got ${puzzle.board.length}`);
    }
    const boardSet = new Set(puzzle.board);
    if (boardSet.size !== puzzle.board.length) {
        errors.push('Board contains duplicate words');
    }

    if (!puzzle.categories || typeof puzzle.categories !== 'object') {
        errors.push('Puzzle has no categories');
        return { valid: false, errors };
    }
    const categoryEntries = Object.entries(puzzle.categories);
    if (categoryEntries.length !== expectedGroups) {
        errors.push(`Puzzle must have exactly ${expectedGroups} groups, got ${categoryEntries.length}`);
    }

    const allMembers = new Set();
    const wordToCategory = new Map();
    for (const [difficulty, cat] of categoryEntries) {
        if (!cat.members || !Array.isArray(cat.members)) {
            errors.push(`Category ${difficulty} has no members array`);
            continue;
        }
        if (cat.members.length !== expectedPerGroup) {
            errors.push(`Category "${cat.name}" must have exactly ${expectedPerGroup} members, got ${cat.members.length}`);
        }
        for (const w of cat.members) {
            if (wordToCategory.has(w)) {
                errors.push(`Word "${w}" appears in more than one category in the solution (ambiguous)`);
            }
            wordToCategory.set(w, cat.name);
            allMembers.add(w);
        }
    }

    for (const word of puzzle.board) {
        if (!allMembers.has(word)) {
            errors.push(`Board word "${word}" does not belong to any category`);
        }
    }
    for (const word of allMembers) {
        if (!puzzle.board.includes(word)) {
            errors.push(`Category member "${word}" is not on the board`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

export {
    CONFIG,
    setsAreEqual,
    evaluateGuess,
    getGameStatus,
    validatePuzzleStructure
};
