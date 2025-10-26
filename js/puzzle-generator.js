import { CONCEPT_DEFINITIONS, CATEGORY_TEMPLATES } from './config.js';

class PuzzleGenerator {
    static generatePuzzle() {
        const allConcepts = Object.keys(CONCEPT_DEFINITIONS);
        
        // Shuffle and pick 3 categories
        const shuffledCategories = [...CATEGORY_TEMPLATES].sort(() => Math.random() - 0.5);
        const selectedCategories = shuffledCategories.slice(0, 3);
        
        // Collect all unique concepts from selected categories
        const allPuzzleConcepts = new Set();
        selectedCategories.forEach(category => {
            category.members.forEach(concept => allPuzzleConcepts.add(concept));
        });

        // Add decoys if needed to reach 16 concepts
        const neededConcepts = 16 - allPuzzleConcepts.size;
        if (neededConcepts > 0) {
            const availableDecoys = allConcepts.filter(concept => !allPuzzleConcepts.has(concept));
            const decoys = availableDecoys.sort(() => Math.random() - 0.5).slice(0, neededConcepts);
            decoys.forEach(decoy => allPuzzleConcepts.add(decoy));
        }

        // Convert to array and shuffle
        const boardConcepts = Array.from(allPuzzleConcepts).sort(() => Math.random() - 0.5);

        return {
            board: boardConcepts,
            categories: {
                easy: { ...selectedCategories[0], difficulty: 'easy' },
                medium: { ...selectedCategories[1], difficulty: 'medium' },
                hard: { ...selectedCategories[2], difficulty: 'hard' }
            }
        };
    }
}

export default PuzzleGenerator;