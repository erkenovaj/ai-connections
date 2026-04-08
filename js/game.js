import PuzzleGenerator from './puzzle-generator.js';
import { trySampleWithPython } from './python-sampler-bridge.js';
import TooltipManager from './tooltip.js';
import DogAnimations from './dog-animations.js';
import Sounds from './sounds.js';
import { CONFIG, CONCEPT_DEFINITIONS } from './config.js';

const LEADERBOARD_KEY = 'ai_connections_leaderboard';
const GUIDE_SEEN_KEY = 'ai_connections_guide_seen';
const MAX_LEADERBOARD_ENTRIES = 20;

function parseUrlConfig() {
    const params = new URLSearchParams(window.location.search);
    return {
        mode: params.get('mode') === 'advanced' ? 'advanced' : (params.get('mode') === 'normal' ? 'normal' : null),
        showGuide: params.get('guide') !== '0'
    };
}

function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

class AISafetyGame {
    constructor() {
        this.currentPuzzle = null;
        this.selectedConcepts = [];
        this.mistakes = 0;
        this.solvedCategories = 0;
        this.hintsEnabled = true;
        this.gameMode = 'normal';
        this.tooltipManager = new TooltipManager();
        this.dogAnimations = new DogAnimations();
        this.timerStart = null;
        this.timerInterval = null;
        this.elapsedSeconds = 0;
        this.currentScore = 0;
        this.lastTappedForTooltip = null;
        this.init();
    }

    init() {
        const urlConfig = parseUrlConfig();
        if (urlConfig.mode !== null) this.gameMode = urlConfig.mode;
        this.bindEvents();
        this.updateHintsToggle();
        this.updateModeToggle();
        this.updateHeaderDesc();
        this.updateTimerDisplay(0);
        this.updateScoreDisplay(null);
        if (urlConfig.showGuide && !localStorage.getItem(GUIDE_SEEN_KEY)) {
            setTimeout(() => this.showGuide(), 100);
        }
        this.startNewGame();
    }

    bindEvents() {
        document.getElementById('submit-btn').addEventListener('click', () => this.submitGuess());
        document.getElementById('deselect-btn').addEventListener('click', () => this.deselectAll());
        document.getElementById('new-game-btn').addEventListener('click', () => this.startNewGame());
        document.querySelector('.dictionary-btn').addEventListener('click', () => this.showDictionary());
        document.querySelector('.guide-btn').addEventListener('click', () => this.showGuide());
        document.querySelector('.hints-toggle-btn').addEventListener('click', () => this.toggleHints());
        document.querySelector('.leaderboard-btn').addEventListener('click', () => this.showLeaderboard());
        document.querySelector('.guide-close-btn').addEventListener('click', () => {
            localStorage.setItem(GUIDE_SEEN_KEY, '1');
            document.getElementById('guide-modal').style.display = 'none';
        });
        document.getElementById('win-save-btn').addEventListener('click', () => this.closeWinAndSave());
        document.getElementById('leaderboard-close-btn').addEventListener('click', () => document.getElementById('leaderboard-modal').style.display = 'none');

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
        this.stopTimer();
        this.timerStart = Date.now();
        this.elapsedSeconds = 0;
        this.currentScore = 0;
        this.updateTimerDisplay(0);
        this.updateScoreDisplay(null);
        this.currentPuzzle = null;
        this.selectedConcepts = [];
        this.mistakes = 0;
        this.solvedCategories = 0;
        this.lastTappedForTooltip = null;

        this.updateCategorySlotsVisibility();
        this.updateMistakesDisplay();
        this.resetCategorySlots();
        this.updateSubmitButton();
        this.startTimer();

        this.dogAnimations.updateDogMood('happy');
        this.loadPuzzle();
    }

    async loadPuzzle() {
        // Try Python V2 sampler first; pass game mode so advanced mode
        // gets 3 categories + 4 red-herring decoys.
        try {
            const response = await fetch('./configs/category-templates.json');
            const templates = await response.json();
            const pythonPuzzle = await trySampleWithPython(this.gameMode, templates);
            if (pythonPuzzle && pythonPuzzle.board && pythonPuzzle.categories) {
                this.currentPuzzle = pythonPuzzle;
            } else {
                this.currentPuzzle = PuzzleGenerator.generatePuzzle(this.gameMode);
            }
        } catch {
            this.currentPuzzle = PuzzleGenerator.generatePuzzle(this.gameMode);
        }

        this.createGameBoard();
    }

    startTimer() {
        this.timerStart = Date.now();
        this.timerInterval = setInterval(() => {
            this.elapsedSeconds = Math.floor((Date.now() - this.timerStart) / 1000);
            this.updateTimerDisplay(this.elapsedSeconds);
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.timerStart) {
            this.elapsedSeconds = Math.floor((Date.now() - this.timerStart) / 1000);
        }
    }

    updateTimerDisplay(seconds) {
        const el = document.getElementById('timer-display');
        if (!el) return;
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }

    updateScoreDisplay(score) {
        const el = document.getElementById('score-display');
        if (!el) return;
        el.textContent = score === null ? 'Score: —' : `Score: ${score}`;
    }

    computeScore(won) {
        if (!won) return Math.max(0, 100 - this.mistakes * 25);
        const base = this.currentPuzzle.numCategories * 100;
        const mistakePenalty = this.mistakes * 25;
        const timeBonus = Math.max(0, 200 - Math.floor(this.elapsedSeconds / 2));
        return Math.max(0, base - mistakePenalty + timeBonus);
    }

    createGameBoard() {
        const gameBoard = document.getElementById('game-board');
        gameBoard.innerHTML = '';
        
        this.currentPuzzle.board.forEach(concept => {
            const card = document.createElement('div');
            card.className = 'concept-card';
            card.textContent = concept;
            card.dataset.concept = concept;

            if (this.hintsEnabled) {
                card.addEventListener('mouseenter', () => {
                    if (!card.classList.contains('correct') && !card.classList.contains('incorrect')) {
                        this.tooltipManager.show(concept, card);
                    }
                });
                card.addEventListener('mouseleave', () => this.tooltipManager.hide());
            }

            card.addEventListener('click', (e) => this.handleCardClick(concept, card, e));
            gameBoard.appendChild(card);
        });
    }

    handleCardClick(concept, cardElement, e) {
        if (isTouchDevice() && this.hintsEnabled && !this.selectedConcepts.includes(concept)) {
            if (this.lastTappedForTooltip === cardElement) {
                this.lastTappedForTooltip = null;
                this.tooltipManager.forceHide();
                this.toggleConcept(concept, cardElement);
            } else {
                this.lastTappedForTooltip = cardElement;
                this.tooltipManager.show(concept, cardElement);
                this.tooltipManager.makeSticky();
                return;
            }
        } else {
            this.toggleConcept(concept, cardElement);
        }
    }

    toggleConcept(concept, cardElement) {
        this.tooltipManager.forceHide();
        this.lastTappedForTooltip = null;

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
            this.currentScore = this.computeScore(false);
            this.updateScoreDisplay(this.currentScore);

            this.dogAnimations.updateDogMood('celebrating');

            if (this.solvedCategories === this.currentPuzzle.numCategories) {
                this.stopTimer();
                this.currentScore = this.computeScore(true);
                this.updateScoreDisplay(this.currentScore);
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
                this.stopTimer();
                this.currentScore = this.computeScore(false);
                this.updateScoreDisplay(this.currentScore);
                this.saveResult(false);
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
        const statsEl = document.getElementById('win-stats');
        const promptEl = document.getElementById('win-name-prompt');
        if (statsEl) statsEl.textContent = `Time: ${Math.floor(this.elapsedSeconds / 60)}:${(this.elapsedSeconds % 60).toString().padStart(2, '0')} — Score: ${this.currentScore}`;
        if (promptEl) promptEl.style.display = 'block';
        document.getElementById('player-name').value = '';
        document.getElementById('win-modal').style.display = 'flex';
    }

    closeWinAndSave() {
        const nameInput = document.getElementById('player-name');
        const name = (nameInput && nameInput.value.trim()) || 'Anonymous';
        this.addToLeaderboard(name, this.currentScore, this.elapsedSeconds, this.gameMode);
        this.saveResult(true);
        document.getElementById('win-modal').style.display = 'none';
        document.getElementById('win-name-prompt').style.display = 'none';
        this.startNewGame();
    }

    getLeaderboard() {
        try {
            const raw = localStorage.getItem(LEADERBOARD_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    addToLeaderboard(name, score, timeSeconds, mode) {
        let list = this.getLeaderboard();
        list.push({
            name: name.substring(0, 20),
            score,
            time: timeSeconds,
            mode,
            date: new Date().toISOString()
        });
        list.sort((a, b) => b.score - a.score);
        list = list.slice(0, MAX_LEADERBOARD_ENTRIES);
        localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list));
    }

    saveResult(won) {
        try {
            const key = 'ai_connections_recent';
            const entry = {
                won,
                score: this.currentScore,
                time: this.elapsedSeconds,
                mode: this.gameMode,
                date: new Date().toISOString()
            };
            let recent = [];
            try {
                const raw = localStorage.getItem(key);
                if (raw) recent = JSON.parse(raw);
            } catch {}
            recent.unshift(entry);
            recent = recent.slice(0, 10);
            localStorage.setItem(key, JSON.stringify(recent));
        } catch (_) {}
    }

    showLeaderboard() {
        const list = this.getLeaderboard();
        const container = document.getElementById('leaderboard-list');
        if (!container) return;
        container.innerHTML = '';
        if (list.length === 0) {
            container.innerHTML = '<p class="leaderboard-hint">No scores yet. Win a game and enter your name to appear here!</p>';
        } else {
            list.forEach((entry, i) => {
                const div = document.createElement('div');
                div.className = 'leaderboard-item' + (i < 3 ? ` rank-${i + 1}` : '');
                const timeStr = `${Math.floor(entry.time / 60)}:${(entry.time % 60).toString().padStart(2, '0')}`;
                div.innerHTML = `<span><strong>#${i + 1}</strong> ${entry.name}</span><span>${entry.score} pts · ${timeStr}</span>`;
                container.appendChild(div);
            });
        }
        document.getElementById('leaderboard-modal').style.display = 'flex';
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