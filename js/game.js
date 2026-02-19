import PuzzleGenerator from './puzzle-generator.js';
import TooltipManager from './tooltip.js';
import DogAnimations from './dog-animations.js';
import Sounds from './sounds.js';
import { CONFIG, CONCEPT_DEFINITIONS } from './config.js';
import * as api from './api.js';

const LEADERBOARD_KEY = 'ai_connections_leaderboard';
const GUIDE_SEEN_KEY = 'ai_connections_guide_seen';
const MAX_LEADERBOARD_ENTRIES = 20;

function parseUrlConfig() {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    return {
        mode: params.get('mode') === 'advanced' ? 'advanced' : (params.get('mode') === 'normal' ? 'normal' : null),
        showGuide: params.get('guide') !== '0',
        roomId: room || null
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
        this.hintsRemaining = 4;
        this.hintRevealedConcepts = new Set();
        this.gameMode = 'normal';
        this.tooltipManager = new TooltipManager();
        this.dogAnimations = new DogAnimations();
        this.timerStart = null;
        this.timerInterval = null;
        this.elapsedSeconds = 0;
        this.currentScore = 0;
        this.lastTappedForTooltip = null;
        this.lastGuessTimestamp = null;
        this.conceptCategoryMap = {};
        this.regime = 'solo';
        this.roomId = null;
        this.puzzleSeed = null;
        this.baseSeed = null;
        this.joinLink = null;
        this.playerName = '';
        this.customTemplates = null;
        this.currentRound = 1;
        this.totalRounds = 1;
        this.init();
    }

    init() {
        const urlConfig = parseUrlConfig();
        if (urlConfig.mode !== null) this.gameMode = urlConfig.mode;
        this.bindEvents();
        this.updateHintsToggle();
        this.updateHintButton();
        this.updateModeToggle();
        this.updateHeaderDesc();
        this.updateTimerDisplay(0);
        this.updateScoreDisplay(null);

        if (urlConfig.roomId) {
            api.getRoom(urlConfig.roomId).then((data) => {
                this.showGameWithRoom(data);
            }).catch(() => {
                this.showWelcome();
            });
            return;
        }
        this.showWelcome();
    }

    showWelcome() {
        document.getElementById('welcome-screen').style.display = 'flex';
        document.getElementById('game-container').style.display = 'none';
        this.bindWelcomeEvents();
    }

    bindWelcomeEvents() {
        document.getElementById('welcome-solo').onclick = () => this.startSolo();
        document.getElementById('welcome-lobby-create').onclick = () => this.createRoomWithOptions();
        document.getElementById('welcome-join-btn').onclick = () => this.joinRoomFromInput();
        document.getElementById('welcome-room-link').onkeydown = (e) => { if (e.key === 'Enter') this.joinRoomFromInput(); };
        
        document.querySelectorAll('.welcome-mode-btn').forEach(btn => {
            btn.onclick = (e) => {
                const regime = e.target.dataset.regime;
                const mode = e.target.dataset.mode;
                document.querySelectorAll(`.welcome-mode-btn[data-regime="${regime}"]`).forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                if (regime === 'solo') this.gameMode = mode;
            };
        });
        
        document.getElementById('solo-templates-btn').onclick = () => document.getElementById('solo-templates-file').click();
        document.getElementById('lobby-templates-btn').onclick = () => document.getElementById('lobby-templates-file').click();
        
        document.getElementById('solo-templates-file').onchange = (e) => this.handleTemplateFile(e, 'solo');
        document.getElementById('lobby-templates-file').onchange = (e) => this.handleTemplateFile(e, 'lobby');
        
        const roundsSlider = document.getElementById('lobby-rounds');
        const roundsValue = document.getElementById('lobby-rounds-value');
        roundsSlider.oninput = (e) => { roundsValue.textContent = e.target.value; };
    }

    handleTemplateFile(event, regime) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if (!Array.isArray(json) || json.length === 0) throw new Error('Invalid format');
                json.forEach(cat => {
                    if (!cat.name || !Array.isArray(cat.members) || cat.members.length !== 4) throw new Error('Invalid format');
                });
                if (regime === 'solo') {
                    this.customTemplates = json;
                    document.getElementById('solo-templates-name').textContent = file.name;
                } else {
                    this.customTemplates = json;
                    document.getElementById('lobby-templates-name').textContent = file.name;
                }
            } catch (err) {
                alert('Invalid JSON file. Expected array of categories with name and members (4 items each).');
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    }

    getSelectedMode(regime) {
        const btn = document.querySelector(`.welcome-mode-btn.active[data-regime="${regime}"]`);
        return btn ? btn.dataset.mode : 'normal';
    }

    joinRoomFromInput() {
        const input = document.getElementById('welcome-room-link');
        const raw = (input && input.value && input.value.trim()) || '';
        const match = raw.match(/room=([a-z0-9]+)/i) || (raw.length >= 6 && !raw.includes(' ') ? [{}, raw] : null);
        const roomId = match ? (match[1] || match[0]).toLowerCase() : null;
        if (roomId) {
            window.location.search = '?room=' + roomId;
        } else {
            alert('Paste a full room link (e.g. https://...?room=abc12345) or enter the room code.');
        }
    }

    createRoomWithOptions() {
        const mode = this.getSelectedMode('lobby');
        const roundsInput = document.getElementById('lobby-rounds');
        if (!roundsInput) {
            alert('Error: Could not find rounds input');
            return;
        }
        const rounds = Math.max(1, Math.min(10, parseInt(roundsInput.value, 10) || 1));
        const templates = this.customTemplates;
        api.createRoom(mode, rounds).then((data) => {
            // Store creator-specific settings keyed by room ID for this browser
            sessionStorage.setItem(`room_rounds_${data.roomId}`, String(rounds));
            if (templates) {
                sessionStorage.setItem(`room_templates_${data.roomId}`, JSON.stringify(templates));
            }
            window.location.search = '?room=' + data.roomId;
        }).catch((err) => {
            alert('Could not create room. Is the server running? ' + (err.message || ''));
        });
    }

    startSolo() {
        const mode = this.getSelectedMode('solo');
        this.gameMode = mode;
        const templates = this.customTemplates;
        if (templates) {
            this.customTemplates = templates;
        }
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        this.regime = 'solo';
        this.roomId = null;
        this.puzzleSeed = null;
        this.joinLink = null;
        this.currentRound = 1;
        this.totalRounds = 1;
        document.getElementById('lobby-bar').style.display = 'none';
        document.querySelector('.header').classList.remove('has-lobby-bar');
        const lbBtn = document.querySelector('.leaderboard-btn');
        if (lbBtn) lbBtn.style.display = '';
        document.querySelectorAll('.mode-btn').forEach(btn => { btn.disabled = false; });
        if (document.getElementById('leaderboard-download-btn')) document.getElementById('leaderboard-download-btn').style.display = 'none';
        this.updateModeToggle();
        this.updateHeaderDesc();
        this.updateRoundDisplay();
        if (!localStorage.getItem(GUIDE_SEEN_KEY)) setTimeout(() => this.showGuide(), 100);
        this.startNewGame();
    }

    showGameWithRoom(roomData) {
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        this.regime = 'lobby';
        this.roomId = roomData.roomId;
        // Prefer locally stored rounds for the room (creator’s choice), fall back to server value
        const storedRounds = sessionStorage.getItem(`room_rounds_${this.roomId}`);
        if (storedRounds !== null && storedRounds !== undefined) {
            this.totalRounds = Number(storedRounds) || 1;
        } else {
            this.totalRounds = roomData.rounds !== undefined && roomData.rounds !== null
                ? Number(roomData.rounds)
                : 1;
        }
        this.baseSeed = roomData.seed || `${this.roomId}-${Date.now()}`;
        const storedRound = localStorage.getItem(`room_round_${this.roomId}`);
        this.currentRound = storedRound ? parseInt(storedRound, 10) : 1;
        if (this.currentRound > this.totalRounds) {
            this.currentRound = this.totalRounds;
        }
        this.puzzleSeed = this.generateRoundSeed(this.currentRound);
        this.joinLink = window.location.href.split('?')[0] + '?room=' + this.roomId;
        this.gameMode = roomData.mode === 'advanced' ? 'advanced' : 'normal';
        const storedTemplates = sessionStorage.getItem(`room_templates_${this.roomId}`);
        if (storedTemplates) {
            try {
                this.customTemplates = JSON.parse(storedTemplates);
            } catch {}
        }
        this.updateModeToggle();
        this.updateHeaderDesc();
        document.getElementById('lobby-bar').style.display = 'flex';
        document.querySelector('.header').classList.add('has-lobby-bar');
        const linkEl = document.getElementById('lobby-link');
        if (linkEl) linkEl.value = this.joinLink;
        document.querySelectorAll('.mode-btn').forEach(btn => { btn.disabled = true; });
        document.querySelector('.leaderboard-btn').style.display = 'none';
        document.getElementById('lobby-copy-btn').onclick = () => this.copyRoomLink();
        document.getElementById('lobby-leaderboard-btn').onclick = () => this.showLeaderboard();
        document.getElementById('lobby-download-btn').onclick = () => this.downloadRoomResults();
        this.updateRoundDisplay();
        this.showRoomNameModal();
    }

    generateRoundSeed(round) {
        return `${this.baseSeed}-round-${round}`;
    }

    showRoomNameModal() {
        const modal = document.getElementById('room-name-modal');
        const input = document.getElementById('room-player-name');
        const startBtn = document.getElementById('room-name-start-btn');
        if (!modal || !input) return;
        input.value = '';
        modal.style.display = 'flex';
        input.focus();
        const start = () => {
            this.playerName = (input.value && input.value.trim()) || 'Anonymous';
            modal.style.display = 'none';
            if (!localStorage.getItem(GUIDE_SEEN_KEY)) setTimeout(() => this.showGuide(), 100);
            this.startNewGame();
        };
        startBtn.onclick = start;
        input.onkeydown = (e) => { if (e.key === 'Enter') start(); };
    }

    copyRoomLink() {
        if (!this.joinLink) return;
        navigator.clipboard.writeText(this.joinLink).then(() => {
            const btn = document.getElementById('lobby-copy-btn');
            const orig = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = orig; }, 1500);
        });
    }

    async downloadRoomResults() {
        if (this.regime !== 'lobby' || !this.roomId) return;
        try {
            const rows = await api.getRoomLeaderboard(this.roomId);
            const headers = ['Rank', 'Name', 'Score', 'Time (s)', 'Won', 'Date'];
            const lines = [headers.join(',')];
            rows.forEach((r, i) => {
                const date = r.createdAt ? new Date(r.createdAt).toISOString() : '';
                lines.push([i + 1, `"${(r.playerName || '').replace(/"/g, '""')}"`, r.score, r.timeSeconds, r.won ? 'Yes' : 'No', date].join(','));
            });
            const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `room-${this.roomId}-results.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (e) {
            alert('Could not download: ' + (e.message || ''));
        }
    }

    bindEvents() {
        document.getElementById('submit-btn').addEventListener('click', () => this.submitGuess());
        document.getElementById('deselect-btn').addEventListener('click', () => this.deselectAll());
        document.getElementById('new-game-btn').addEventListener('click', () => this.startNewGame());
        document.querySelector('.dictionary-btn').addEventListener('click', () => this.showDictionary());
        document.querySelector('.guide-btn').addEventListener('click', () => this.showGuide());
        document.querySelector('.hints-toggle-btn').addEventListener('click', () => this.toggleHints());
        const hintBtn = document.querySelector('.category-hints-toggle-btn');
        if (hintBtn) {
            hintBtn.addEventListener('click', () => this.useHint());
        }
        document.querySelector('.leaderboard-btn').addEventListener('click', () => this.showLeaderboard());
        document.querySelector('.guide-close-btn').addEventListener('click', () => {
            localStorage.setItem(GUIDE_SEEN_KEY, '1');
            document.getElementById('guide-modal').style.display = 'none';
        });
        document.getElementById('win-save-btn').addEventListener('click', () => this.closeWinAndSave());
        document.getElementById('win-next-btn').addEventListener('click', () => this.nextRound());
        document.getElementById('leaderboard-close-btn').addEventListener('click', () => document.getElementById('leaderboard-modal').style.display = 'none');
        document.getElementById('home-btn').addEventListener('click', () => { window.location = window.location.pathname || '/'; });
        const dlBtn = document.getElementById('leaderboard-download-btn');
        if (dlBtn) dlBtn.addEventListener('click', () => this.downloadRoomResults());

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setGameMode(e.target.dataset.mode));
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.concept-tooltip')) {
                this.tooltipManager.forceHide();
            }
        });

        this.setupModalCloseOnBackdrop();
    }

    setupModalCloseOnBackdrop() {
        const modalIds = ['room-name-modal', 'win-modal', 'lose-modal', 'dictionary-modal', 'guide-modal', 'leaderboard-modal'];
        modalIds.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.style.display = 'none';
                    }
                });
                const content = modal.querySelector('.modal-content');
                if (content) {
                    content.addEventListener('click', (e) => {
                        e.stopPropagation();
                    });
                }
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
        if (!hintsBtn) return;
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

    useHint() {
        if (this.hintsRemaining <= 0 || !this.currentPuzzle) return;
        const solvedConcepts = this.getSolvedConcepts();
        const unrevealed = this.currentPuzzle.board.filter(
            concept => !this.hintRevealedConcepts.has(concept) && !solvedConcepts.has(concept)
        );
        if (unrevealed.length === 0) return;

        const chosen = unrevealed[Math.floor(Math.random() * unrevealed.length)];
        this.hintRevealedConcepts.add(chosen);
        this.hintsRemaining--;
        this.currentScore = Math.max(0, Math.round(this.currentScore - 200));
        this.updateScoreDisplay(this.currentScore);
        this.updateHintButton();
        this.updateHintRevealedOnBoard();
    }

    getSolvedConcepts() {
        const solved = new Set();
        const slots = document.querySelectorAll('.category-slot.filled');
        slots.forEach(slot => {
            const difficulty = slot.dataset.difficulty;
            const category = this.currentPuzzle?.categories[difficulty];
            if (category) category.members.forEach(c => solved.add(c));
        });
        return solved;
    }

    updateHintButton() {
        const btn = document.querySelector('.category-hints-toggle-btn');
        if (!btn) return;
        btn.textContent = `💡 Hint (${this.hintsRemaining})`;
        btn.disabled = this.hintsRemaining <= 0;
        btn.classList.toggle('on', this.hintsRemaining > 0);
        btn.classList.toggle('off', this.hintsRemaining <= 0);
    }

    updateHintRevealedOnBoard() {
        const cards = document.querySelectorAll('.concept-card');
        cards.forEach(card => {
            const concept = card.dataset.concept;
            const categoryName = this.conceptCategoryMap[concept];
            if (this.hintRevealedConcepts.has(concept) && categoryName) {
                card.dataset.hint = categoryName;
            }
        });
    }

    startNewGame() {
        this.closeAllModals();
        this.stopTimer();
        this.timerStart = Date.now();
        this.elapsedSeconds = 0;
        this.currentScore = 0;
        this.updateTimerDisplay(0);
        this.updateScoreDisplay(null);
        if (this.regime === 'lobby' && this.puzzleSeed === null) {
            this.puzzleSeed = this.generateRoundSeed(this.currentRound);
        }
        const seed = this.regime === 'lobby' ? this.puzzleSeed : null;
        const templates = this.customTemplates;
        this.currentPuzzle = PuzzleGenerator.generatePuzzle(this.gameMode, seed, templates);
        this.selectedConcepts = [];
        this.mistakes = 0;
        this.solvedCategories = 0;
        this.hintsRemaining = 4;
        this.hintRevealedConcepts = new Set();
        this.lastTappedForTooltip = null;
        this.lastGuessTimestamp = null;

        // Build a quick lookup from concept to its category name (if any)
        this.conceptCategoryMap = {};
        for (const category of Object.values(this.currentPuzzle.categories)) {
            category.members.forEach(concept => {
                this.conceptCategoryMap[concept] = category.name;
            });
        }

        this.updateCategorySlotsVisibility();
        this.updateMistakesDisplay();
        this.updateHintButton();
        this.resetCategorySlots();
        this.createGameBoard();
        this.updateSubmitButton();
        this.startTimer();
        this.updateRoundDisplay();

        this.dogAnimations.updateDogMood('happy');
    }

    updateRoundDisplay() {
        const roundEl = document.getElementById('round-display');
        if (!roundEl) return;
        if (this.regime === 'lobby' && this.totalRounds) {
            const total = Number(this.totalRounds) || 1;
            roundEl.style.display = 'block';
            roundEl.textContent = `Round ${this.currentRound} of ${total}`;
        } else {
            roundEl.style.display = 'none';
        }
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
        // Legacy helper retained for compatibility; scoring is now applied
        // incrementally inside submitGuess based on time between guesses.
        return Math.max(0, Math.round(this.currentScore));
    }

    createGameBoard() {
        const gameBoard = document.getElementById('game-board');
        const solvedConcepts = this.getSolvedConcepts();
        gameBoard.innerHTML = '';

        this.currentPuzzle.board.forEach(concept => {
            const card = document.createElement('div');
            card.className = 'concept-card';
            card.textContent = concept;
            card.dataset.concept = concept;

            const categoryName = this.conceptCategoryMap[concept];
            if (this.hintRevealedConcepts.has(concept) && categoryName) {
                card.dataset.hint = categoryName;
            }
            if (this.selectedConcepts.includes(concept)) {
                card.classList.add('selected');
            }
            if (solvedConcepts.has(concept)) {
                card.classList.add('correct');
            }

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
        if (cardElement.classList.contains('correct')) return;
        if (isTouchDevice() && this.hintsEnabled && !this.selectedConcepts.includes(concept)) {
            // If already 3 selected, allow single-tap to add the 4th (no tooltip required)
            if (this.selectedConcepts.length === CONFIG.CONCEPTS_PER_GROUP - 1) {
                this.toggleConcept(concept, cardElement);
                return;
            }
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
        if (cardElement.classList.contains('correct')) return;
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

        // Time since previous guess (or since game start for the first guess)
        const now = Date.now();
        let secondsSinceLastGuess;
        if (this.lastGuessTimestamp) {
            secondsSinceLastGuess = (now - this.lastGuessTimestamp) / 1000;
        } else if (this.timerStart) {
            secondsSinceLastGuess = (now - this.timerStart) / 1000;
        } else {
            secondsSinceLastGuess = 0;
        }
        // Avoid division by zero and negative/NaN values
        if (!Number.isFinite(secondsSinceLastGuess) || secondsSinceLastGuess <= 0) {
            secondsSinceLastGuess = 0.1;
        }
        this.lastGuessTimestamp = now;

        // Keep elapsed time in sync with scoring
        this.elapsedSeconds = Math.floor((now - this.timerStart) / 1000);
        this.updateTimerDisplay(this.elapsedSeconds);

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

            // Scoring for a correct category: base + speed bonus, always at least 100
            const rawPoints = 12000 / secondsSinceLastGuess - this.elapsedSeconds;
            const pointsForThisCategory = Math.max(100, Math.round(rawPoints));
            this.currentScore += pointsForThisCategory;
            this.currentScore = Math.max(0, Math.round(this.currentScore));
            this.updateScoreDisplay(this.currentScore);

            this.dogAnimations.updateDogMood('celebrating');

            if (this.solvedCategories === this.currentPuzzle.numCategories) {
                this.stopTimer();
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

            // Scoring for a mistake:
            // - (seconds since previous guess)
            this.currentScore -= secondsSinceLastGuess;
            this.currentScore = Math.max(0, Math.round(this.currentScore));
            this.updateScoreDisplay(this.currentScore);

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
        const roundInfoEl = document.getElementById('win-round-info');
        const saveBtn = document.getElementById('win-save-btn');
        const nextBtn = document.getElementById('win-next-btn');
        if (statsEl) statsEl.textContent = `Time: ${Math.floor(this.elapsedSeconds / 60)}:${(this.elapsedSeconds % 60).toString().padStart(2, '0')} — Score: ${this.currentScore}`;
        if (promptEl) promptEl.style.display = this.regime === 'lobby' ? 'none' : 'block';
        if (this.regime !== 'lobby') document.getElementById('player-name').value = '';

        const isLobby = this.regime === 'lobby';
        const total = this.totalRounds ? Number(this.totalRounds) : 1;

        if (isLobby) {
            // In lobby mode, always show round info and "Next game",
            // regardless of how many rounds were chosen.
            if (roundInfoEl) {
                roundInfoEl.style.display = 'block';
                roundInfoEl.textContent = `Round ${this.currentRound} of ${total}`;
            }
            if (saveBtn) saveBtn.style.display = 'none';
            if (nextBtn) {
                nextBtn.style.display = 'inline-block';
                nextBtn.textContent = 'Next game';
            }
        } else {
            // Solo play: no round info, show save button as before
            if (roundInfoEl) roundInfoEl.style.display = 'none';
            if (saveBtn) {
                saveBtn.style.display = 'inline-block';
                saveBtn.textContent = 'Save & Play Again';
            }
            if (nextBtn) nextBtn.style.display = 'none';
        }
        document.getElementById('win-modal').style.display = 'flex';
    }

    async closeWinAndSave() {
        const nameInput = document.getElementById('player-name');
        const baseName = (nameInput && nameInput.value && nameInput.value.trim()) || 'Anonymous';
        const name = this.regime === 'lobby' ? (this.playerName || baseName) : baseName;
        const isMultiRoundFinal = this.regime === 'lobby' && this.totalRounds && this.totalRounds > 1 && this.currentRound >= this.totalRounds;
        try {
            if (this.regime === 'lobby') {
                const nameWithRound = `${name} (R${this.currentRound})`;
                await api.submitRoomResult(this.roomId, {
                    playerName: nameWithRound,
                    score: this.currentScore,
                    timeSeconds: this.elapsedSeconds,
                    won: true,
                    roundNumber: this.currentRound
                });
            } else {
                await api.submitSoloResult({
                    playerName: name,
                    score: this.currentScore,
                    timeSeconds: this.elapsedSeconds,
                    mode: this.gameMode
                });
                this.addToLeaderboard(name, this.currentScore, this.elapsedSeconds, this.gameMode);
            }
        } catch (e) {
            if (this.regime === 'solo') {
                this.addToLeaderboard(name, this.currentScore, this.elapsedSeconds, this.gameMode);
            }
        }
        document.getElementById('win-modal').style.display = 'none';
        document.getElementById('win-name-prompt').style.display = 'none';
        this.startNewGame();
    }

    async nextRound() {
        const name = this.playerName || 'Anonymous';
        const nameWithRound = `${name} (R${this.currentRound})`;
        try {
            await api.submitRoomResult(this.roomId, {
                playerName: nameWithRound,
                score: this.currentScore,
                timeSeconds: this.elapsedSeconds,
                won: true,
                roundNumber: this.currentRound
            });
        } catch (e) {
            console.error('Failed to submit round result:', e);
        }
        if (this.currentRound < this.totalRounds) {
            this.currentRound++;
            localStorage.setItem(`room_round_${this.roomId}`, this.currentRound.toString());
            this.puzzleSeed = this.generateRoundSeed(this.currentRound);
            document.getElementById('win-modal').style.display = 'none';
            this.updateRoundDisplay();
            this.startNewGame();
        }
    }

    async getLeaderboard() {
        if (this.regime === 'lobby' && this.roomId) {
            try {
                return await api.getRoomLeaderboard(this.roomId);
            } catch {
                return [];
            }
        }
        try {
            const rows = await api.getSoloLeaderboard(this.gameMode, MAX_LEADERBOARD_ENTRIES);
            return rows.map(r => ({
                name: r.playerName,
                score: r.score,
                time: r.timeSeconds,
                mode: r.mode,
                date: r.createdAt
            }));
        } catch {
            try {
                const raw = localStorage.getItem(LEADERBOARD_KEY);
                return raw ? JSON.parse(raw) : [];
            } catch {
                return [];
            }
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
        const submit = () => {
            if (this.regime === 'lobby' && this.roomId) {
                const baseName = this.playerName || 'Anonymous';
                const nameWithRound = `${baseName} (R${this.currentRound})`;
                api.submitRoomResult(this.roomId, {
                    playerName: nameWithRound,
                    score: this.currentScore,
                    timeSeconds: this.elapsedSeconds,
                    won: false,
                    roundNumber: this.currentRound
                }).catch(() => {});
            } else if (this.regime === 'solo') {
                api.submitSoloResult({
                    playerName: 'Anonymous',
                    score: this.currentScore,
                    timeSeconds: this.elapsedSeconds,
                    mode: this.gameMode
                }).catch(() => {});
            }
        };
        submit();
        try {
            const key = 'ai_connections_recent';
            const entry = { won, score: this.currentScore, time: this.elapsedSeconds, mode: this.gameMode, date: new Date().toISOString() };
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

    async showLeaderboard() {
        const container = document.getElementById('leaderboard-list');
        const hintEl = document.getElementById('leaderboard-hint');
        const downloadBtn = document.getElementById('leaderboard-download-btn');
        if (!container) return;
        container.innerHTML = '<p>Loading…</p>';
        const list = await this.getLeaderboard();
        container.innerHTML = '';
        if (hintEl) {
            hintEl.textContent = this.regime === 'lobby' ? 'Room results (same puzzle)' : 'Best scores (saved online)';
        }
        if (downloadBtn) {
            downloadBtn.style.display = this.regime === 'lobby' ? 'inline-block' : 'none';
        }
        if (list.length === 0) {
            container.innerHTML = '<p class="leaderboard-hint">No scores yet. Win a game and enter your name to appear here!</p>';
        } else {
            list.forEach((entry, i) => {
                const div = document.createElement('div');
                div.className = 'leaderboard-item' + (i < 3 ? ` rank-${i + 1}` : '');
                const time = entry.timeSeconds != null ? entry.timeSeconds : entry.time;
                const name = entry.playerName != null ? entry.playerName : entry.name;
                const timeStr = `${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, '0')}`;
                const wonStr = entry.won !== undefined ? (entry.won ? ' ✓' : '') : '';
                // For lobby we already bake round into the name (e.g. "Alice (R2)")
                // For solo we don't have rounds, so just show the name.
                div.innerHTML = `<span><strong>#${i + 1}</strong> ${name}</span><span>${entry.score} pts · ${timeStr}${wonStr}</span>`;
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