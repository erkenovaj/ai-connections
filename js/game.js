import PuzzleGenerator from './puzzle-generator.js';
import TooltipManager from './tooltip.js';
import DogAnimations from './dog-animations.js';
import Sounds from './sounds.js';
import { CONFIG, CONCEPT_DEFINITIONS } from './config.js';

class AISafetyGame {
    constructor() {
        this.currentPuzzle = null;
        this.selectedConcepts = [];
        this.mistakes = 0;
        this.solvedCategories = 0;
        this.hintsEnabled = true;
        this.gameMode = 'normal'; // 'normal' = 4 categories, 'advanced' = 3 categories
        this.tooltipManager = new TooltipManager();
        this.dogAnimations = new DogAnimations();
        this.init();
    }

    init() {
        this.bindEvents();
        this.startNewGame();
        this.updateHintsToggle();
        this.updateModeToggle();
        this.updateHeaderDesc();
    }

    bindEvents() {
        document.getElementById('submit-btn').addEventListener('click', () => this.submitGuess());
        document.getElementById('deselect-btn').addEventListener('click', () => this.deselectAll());
        document.getElementById('new-game-btn').addEventListener('click', () => this.startNewGame());
        document.querySelector('.shuffle-btn').addEventListener('click', () => this.shuffleBoard());
        document.querySelector('.dictionary-btn').addEventListener('click', () => this.showDictionary());
        document.querySelector('.guide-btn').addEventListener('click', () => this.showGuide());
        document.querySelector('.hints-toggle-btn').addEventListener('click', () => this.toggleHints());

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setGameMode(e.target.dataset.mode));
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.concept-tooltip')) {
                this.tooltipManager.forceHide();
            }
        });
    }

    setGameMode(mode) {
        if (this.gameMode === mode) return;
        this.gameMode = mode;
        this.updateModeToggle();
        this.updateHeaderDesc();
        this.startNewGame();
    }

    updateModeToggle() {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === this.gameMode);
        });
        this.updateCategorySlotsVisibility();
    }

    updateHeaderDesc() {
        const p = document.querySelector('.header-desc');
        if (this.gameMode === 'normal') {
            p.textContent = 'Create four groups of four that share a common theme. Many concepts fit multiple categories. The dog is watching...';
        } else {
            p.textContent = 'Create three groups of four that share a common theme. Four decoys included. The dog is watching...';
        }
    }

    updateCategorySlotsVisibility() {
        const fourth = document.querySelector('.category-slot-4th');
        if (fourth) fourth.classList.toggle('hidden', this.gameMode === 'advanced');
        const slots = document.getElementById('category-slots');
        slots.classList.toggle('slots-4', this.gameMode === 'normal');
        slots.classList.toggle('slots-3', this.gameMode === 'advanced');
    }

    toggleHints() {
        this.hintsEnabled = !this.hintsEnabled;
        this.updateHintsToggle();
        
        // If hints are disabled, hide any currently visible tooltip
        if (!this.hintsEnabled) {
            this.tooltipManager.forceHide();
        }
        
        // Recreate the game board to apply the new hints setting
        this.createGameBoard();
    }

    updateHintsToggle() {
        const hintsBtn = document.querySelector('.hints-toggle-btn');
        if (this.hintsEnabled) {
            hintsBtn.classList.add('on');
            hintsBtn.classList.remove('off');
            hintsBtn.innerHTML = '📖 DEFS: ON';
        } else {
            hintsBtn.classList.add('off');
            hintsBtn.classList.remove('on');
            hintsBtn.innerHTML = '🚫 DEFS: OFF';
        }
    }

    startNewGame() {
        this.closeAllModals();
        this.currentPuzzle = PuzzleGenerator.generatePuzzle(this.gameMode);
        this.selectedConcepts = [];
        this.mistakes = 0;
        this.solvedCategories = 0;

        this.updateCategorySlotsVisibility();
        this.updateMistakesDisplay();
        this.createGameBoard();
        this.resetCategorySlots();
        this.updateSubmitButton();

        this.dogAnimations.updateDogMood('happy');
    }

    createGameBoard() {
        const gameBoard = document.getElementById('game-board');
        gameBoard.innerHTML = '';
        
        this.currentPuzzle.board.forEach(concept => {
            const card = document.createElement('div');
            card.className = 'concept-card';
            card.textContent = concept;
            
            // Only add hover events if hints are enabled
            if (this.hintsEnabled) {
                card.addEventListener('mouseenter', (e) => {
                    if (!card.classList.contains('correct') && !card.classList.contains('incorrect')) {
                        this.tooltipManager.show(concept, card);
                    }
                });
                
                card.addEventListener('mouseleave', () => {
                    this.tooltipManager.hide();
                });
            } else {
                // Remove any existing hover events when hints are disabled
                card.removeEventListener('mouseenter', this.tooltipManager.show);
                card.removeEventListener('mouseleave', this.tooltipManager.hide);
            }
            
            card.addEventListener('click', () => this.toggleConcept(concept, card));
            
            gameBoard.appendChild(card);
        });
    }

    toggleConcept(concept, cardElement) {
        this.tooltipManager.forceHide();

        const incorrectCards = Array.from(document.querySelectorAll('.concept-card.incorrect:not(.correct)'));
        if (incorrectCards.length > 0) {
            this.fadeIncorrectTiles(incorrectCards);
        }

        const index = this.selectedConcepts.indexOf(concept);

        if (index > -1) {
            this.selectedConcepts.splice(index, 1);
            cardElement.classList.remove('selected');
            if (cardElement.classList.contains('incorrect') && !cardElement.classList.contains('correct')) {
                cardElement.classList.remove('incorrect');
            }
        } else {
            if (this.selectedConcepts.length < CONFIG.CONCEPTS_PER_GROUP) {
                this.selectedConcepts.push(concept);
                cardElement.classList.add('selected');
                if (cardElement.classList.contains('incorrect')) {
                    cardElement.classList.remove('incorrect');
                }
            }
        }

        this.updateSubmitButton();

        if (this.selectedConcepts.length === CONFIG.CONCEPTS_PER_GROUP) {
            this.dogAnimations.updateDogMood('excited');
        } else {
            this.dogAnimations.updateDogMood('happy');
        }
    }

    fadeIncorrectTiles(cards) {
        cards.forEach(card => {
            card.classList.add('incorrect-fading');
        });
        setTimeout(() => {
            cards.forEach(card => {
                card.classList.remove('incorrect', 'incorrect-fading');
            });
        }, 400);
    }

    updateSubmitButton() {
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.disabled = this.selectedConcepts.length !== CONFIG.CONCEPTS_PER_GROUP;
    }

    submitGuess() {
        if (this.selectedConcepts.length !== CONFIG.CONCEPTS_PER_GROUP) return;

        // Dog gets worried during submission
        this.dogAnimations.updateDogMood('worried');

        let matchedCategory = null;
        let categoryDifficulty = null;
        
        for (const [difficulty, category] of Object.entries(this.currentPuzzle.categories)) {
            const categorySet = new Set(category.members);
            const selectedSet = new Set(this.selectedConcepts);
            
            if (this.setsAreEqual(categorySet, selectedSet)) {
                matchedCategory = category;
                categoryDifficulty = difficulty;
                break;
            }
        }

        if (matchedCategory) {
            Sounds.correct();
            this.markGroupAsCorrect(this.selectedConcepts);
            this.fillCategorySlot(matchedCategory, categoryDifficulty);
            this.solvedCategories++;

            this.dogAnimations.updateDogMood('celebrating');

            if (this.solvedCategories === this.currentPuzzle.numCategories) {
                setTimeout(() => {
                    Sounds.win();
                    this.showWinModal();
                    this.dogAnimations.updateDogMood('happy');
                }, 2000);
            } else {
                setTimeout(() => {
                    this.dogAnimations.updateDogMood('happy');
                }, 2000);
            }
        } else {
            Sounds.wrong();
            this.mistakes++;
            this.updateMistakesDisplay();
            this.markGroupAsIncorrect(this.selectedConcepts);
            
            // Dog gets progressively more sad with each mistake
            if (this.mistakes === 1) {
                this.dogAnimations.updateDogMood('worried');
                this.dogAnimations.spawnBones();
            }
            if (this.mistakes === 2) {
                this.dogAnimations.updateDogMood('concerned');
                this.dogAnimations.spawnBones();
            }
            if (this.mistakes === 3) {
                this.dogAnimations.updateDogMood('sad');
                this.dogAnimations.spawnBones();
            }
            
            if (this.mistakes === CONFIG.MAX_MISTAKES) {
                setTimeout(() => {
                    Sounds.lose();
                    this.showLoseModal();
                    this.dogAnimations.updateDogMood('sad');
                }, 1500);
            } else {
                // Return to concerned after a brief period
                setTimeout(() => {
                    if (this.mistakes > 0) {
                        this.dogAnimations.updateDogMood('concerned');
                    }
                }, 1000);
            }
        }
        
        this.selectedConcepts = [];
        this.updateSubmitButton();
    }

    markGroupAsCorrect(concepts) {
        concepts.forEach(concept => {
            const card = this.findCardByConcept(concept);
            if (card) {
                card.classList.add('correct');
                card.classList.remove('selected', 'incorrect');
            }
        });
    }

    markGroupAsIncorrect(concepts) {
        concepts.forEach(concept => {
            const card = this.findCardByConcept(concept);
            if (card && !card.classList.contains('correct')) {
                card.classList.add('incorrect');
                card.classList.remove('selected');
                card.classList.add('shake');
                setTimeout(() => card.classList.remove('shake'), 500);
            }
        });
    }

    fillCategorySlot(category, difficulty) {
        const slot = document.querySelector(`.category-slot[data-difficulty="${difficulty}"]`);
        if (slot) {
            slot.classList.add('filled');
            slot.querySelector('.category-name').textContent = category.name;
            slot.querySelector('.category-concepts').textContent = category.members.join(', ');
        }
    }

    findCardByConcept(concept) {
        const cards = document.querySelectorAll('.concept-card');
        for (const card of cards) {
            if (card.textContent === concept) {
                return card;
            }
        }
        return null;
    }

    setsAreEqual(setA, setB) {
        return setA.size === setB.size && [...setA].every(item => setB.has(item));
    }

    updateMistakesDisplay() {
        const mistakeDots = document.querySelectorAll('.mistake-dot');
        mistakeDots.forEach((dot, index) => {
            dot.classList.toggle('used', index < this.mistakes);
        });
    }

    deselectAll() {
        this.selectedConcepts = [];
        const cards = document.querySelectorAll('.concept-card');
        cards.forEach(card => {
            card.classList.remove('selected');
            // Remove incorrect styling when deselecting all
            if (card.classList.contains('incorrect') && !card.classList.contains('correct')) {
                card.classList.remove('incorrect');
            }
        });
        this.updateSubmitButton();
        
        // Dog becomes HAPPY when deselecting
        this.dogAnimations.updateDogMood('happy');
    }

    shuffleBoard() {
        const previouslySelected = [...this.selectedConcepts];
        const cards = Array.from(document.querySelectorAll('.concept-card'));
        const shuffledConcepts = [...this.currentPuzzle.board].sort(() => Math.random() - 0.5);

        cards.forEach((card, index) => {
            card.textContent = shuffledConcepts[index];
            if (card.classList.contains('correct')) {
                card.classList.add('correct');
            } else if (card.classList.contains('incorrect')) {
                card.classList.add('incorrect');
            }
            card.classList.remove('selected');
        });

        this.currentPuzzle.board = shuffledConcepts;
        this.selectedConcepts = [];
        previouslySelected.forEach(concept => {
            const card = this.findCardByConcept(concept);
            if (card && !card.classList.contains('correct')) {
                this.selectedConcepts.push(concept);
                card.classList.add('selected');
            }
        });
        this.updateSubmitButton();

        Sounds.shuffle();
        this.dogAnimations.updateDogMood('excited');
        setTimeout(() => this.dogAnimations.updateDogMood('happy'), 1000);
    }

    showDictionary() {
        const dictionaryModal = document.getElementById('dictionary-modal');
        const conceptList = document.getElementById('dictionary-list');
        
        conceptList.innerHTML = '';
        
        Object.entries(CONCEPT_DEFINITIONS).forEach(([concept, definition]) => {
            const item = document.createElement('div');
            item.className = 'concept-item';
            
            const name = document.createElement('div');
            name.className = 'concept-name';
            name.textContent = concept;
            
            const desc = document.createElement('div');
            desc.className = 'concept-description';
            desc.textContent = definition;
            
            item.appendChild(name);
            item.appendChild(desc);
            conceptList.appendChild(item);
        });
        
        dictionaryModal.style.display = 'flex';
    }

    showGuide() {
        document.getElementById('guide-modal').style.display = 'flex';
    }

    showWinModal() {
        document.getElementById('win-modal').style.display = 'flex';
        // Dog stays celebrating for win modal
    }

    showLoseModal() {
        const solutionContainer = document.getElementById('solution-container');
        solutionContainer.innerHTML = '';
        
        for (const [difficulty, category] of Object.entries(this.currentPuzzle.categories)) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = `solution-category ${difficulty}`;
            
            const badge = document.createElement('span');
            badge.className = `difficulty-badge ${difficulty}-badge`;
            badge.textContent = difficulty.toUpperCase();
            
            const name = document.createElement('div');
            name.className = 'category-name';
            name.textContent = category.name;
            
            const concepts = document.createElement('div');
            concepts.className = 'category-concepts';
            concepts.textContent = category.members.join(', ');
            
            categoryDiv.appendChild(badge);
            categoryDiv.appendChild(name);
            categoryDiv.appendChild(concepts);
            solutionContainer.appendChild(categoryDiv);
        }
        
        document.getElementById('lose-modal').style.display = 'flex';
        // Dog stays sad for lose modal
    }

    closeAllModals() {
        document.getElementById('win-modal').style.display = 'none';
        document.getElementById('lose-modal').style.display = 'none';
        document.getElementById('dictionary-modal').style.display = 'none';
        document.getElementById('guide-modal').style.display = 'none';
        this.tooltipManager.forceHide();
    }

    resetCategorySlots() {
        const slots = document.querySelectorAll('.category-slot');
        slots.forEach((slot, index) => {
            slot.classList.remove('filled', 'incorrect');
            slot.querySelector('.category-name').textContent = `Category ${index + 1}`;
            slot.querySelector('.category-concepts').textContent = '';
        });
    }
}

// Initialize game when DOM is ready (modules run deferred; DOMContentLoaded may have already fired)
function initGame() {
    new AISafetyGame();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

export default AISafetyGame;