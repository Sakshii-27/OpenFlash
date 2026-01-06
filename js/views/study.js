import { StorageManager } from '../storage.js';
import { createElement, shuffleArray } from '../utils.js';

export function render(deckId) {
    const deck = StorageManager.getDeck(deckId);
    if (!deck) {
        window.location.hash = '#/dashboard';
        return createElement('div');
    }

    // Load progress to resume or start fresh?
    // For simplicity, we just start fresh session logic but update cumulative stats.
    let currentIndex = 0;
    let isFlipped = false;
    let sessionStats = { viewed: 0, correct: 0, incorrect: 0 };

    const container = createElement('div', 'study-view fade-in');

    // Header
    const header = createElement('header', 'view-header');
    header.innerHTML = `
        <h1>Studying: ${deck.title}</h1>
        <a href="#/dashboard" class="btn btn-outline">Exit</a>
    `;
    container.appendChild(header);
    // Progress indicator (session-based)
    const progressIndicator = createElement('div', 'study-progress');
    let sessionCards = deck.cards.slice(); // will be set when session starts
    let sessionTotal = sessionCards.length;
    const updateProgress = () => {
        progressIndicator.textContent = `Card ${currentIndex + 1} of ${sessionTotal}`;
    };
    container.appendChild(progressIndicator);
    updateProgress();

    // Flashcard Container
    const scene = createElement('div', 'scene');
    scene.setAttribute('tabindex', '0'); // allow keyboard focus so Space works reliably
    const cardElement = createElement('div', 'flashcard');

    const frontFace = createElement('div', 'card-face card-front');
    const backFace = createElement('div', 'card-face card-back');

    cardElement.appendChild(frontFace);
    cardElement.appendChild(backFace);
    scene.appendChild(cardElement);
    container.appendChild(scene);

    // Controls
    const controls = createElement('div', 'study-controls');

    const flipBtn = createElement('button', 'btn btn-primary', 'Flip Card');
    flipBtn.style.width = '100%';

    const ratingBtns = createElement('div', 'rating-btns');
    ratingBtns.style.display = 'none'; // Hidden initially
    ratingBtns.innerHTML = `
        <button class="btn btn-danger" id="btn-incorrect">Again</button>
        <button class="btn btn-primary" style="background-color: var(--success); color: white;" id="btn-correct">Good</button>
    `;

    controls.appendChild(flipBtn);
    controls.appendChild(ratingBtns);
    container.appendChild(controls);
    // Config panel: single checkbox to control shuffle behavior
    const configPanel = createElement('div', 'card-config');
    configPanel.innerHTML = '<h3>Session Options</h3><p style="color: var(--text-3); margin-bottom: var(--space-sm);">Enable Shuffle to study cards in random order; disable to study in the order they were added.</p>';
    const cfgRow = createElement('div', 'config-row');
    cfgRow.style.display = 'flex';
    cfgRow.style.alignItems = 'center';
    cfgRow.style.gap = '0.75rem';
    const shuffleCb = document.createElement('input');
    shuffleCb.type = 'checkbox';
    shuffleCb.id = 'shuffle-cb';
    shuffleCb.checked = true; // default: shuffle enabled
    const shuffleLabel = createElement('label', '', 'Shuffle cards for this session');
    shuffleLabel.setAttribute('for', 'shuffle-cb');
    shuffleLabel.style.color = 'var(--text-2)';
    cfgRow.appendChild(shuffleCb);
    cfgRow.appendChild(shuffleLabel);
    configPanel.appendChild(cfgRow);

    const startBtn = createElement('button', 'btn btn-primary', 'Start Session');
    startBtn.style.marginTop = '1rem';
    configPanel.appendChild(startBtn);

    // Insert config above the scene
    container.insertBefore(configPanel, scene);

    // Logic
    const showCard = (index) => {
        if (index >= sessionCards.length) {
            finishSession();
            return;
        }

        const card = sessionCards[index];
        frontFace.textContent = card.front;
        backFace.textContent = card.back;

        // Reset state
        isFlipped = false;
        cardElement.classList.remove('is-flipped');
        flipBtn.style.display = 'block';
        ratingBtns.style.display = 'none';
        updateProgress();
    };

    const handleFlip = () => {
        isFlipped = !isFlipped;
        cardElement.classList.toggle('is-flipped');

        if (isFlipped) {
            flipBtn.style.display = 'none';
            ratingBtns.style.display = 'flex';
        }
    };

    const handleRating = (correct) => {
        // Update stats
        const currentProgress = StorageManager.getDeckProgress(deck.id);
        currentProgress.viewed++;
        currentProgress.total = deck.cards.length; // Ensure total is up to date (cumulative deck size)
        sessionStats.viewed++;
        if (correct) {
            currentProgress.correct++;
            sessionStats.correct++;
        } else {
            currentProgress.incorrect++;
            sessionStats.incorrect++;
        }

        StorageManager.saveDeckProgress(deck.id, currentProgress);

        // Next card
        currentIndex++;
        showCard(currentIndex);
    };

    const finishSession = () => {
        scene.style.display = 'none';
        controls.style.display = 'none';
        progressIndicator.style.display = 'none';
        // remove global key handler when session finishes
        try { document.removeEventListener('keydown', keyHandler); } catch (e) {}

        const completeContainer = createElement('div', 'session-complete');
        completeContainer.innerHTML = `
            <h2>Session Complete!</h2>
            <div class="stats-box">
                <p>Correct: ${sessionStats.correct}</p>
                <p>Incorrect: ${sessionStats.incorrect}</p>
            </div>
            <div class="actions">
                <button class="btn btn-primary" id="study-again-btn">Study Again</button>
                <a href="#/dashboard" class="btn btn-outline">Back to Decks</a>
            </div>
        `;
        container.appendChild(completeContainer);

        // Re-bind study again
        container.querySelector('#study-again-btn').addEventListener('click', () => {
            container.innerHTML = '';
            // Re-render essentially by just calling render logic again or reloading route
            // Since we are inside the component, the cleanest SPA way without logic extraction is 
            // to trigger a route reload or just recursively call render (but we need to replace content).
            // Simplest: 
            const newContent = render(deckId);
            const app = document.getElementById('app');
            app.innerHTML = '';
            app.appendChild(newContent);
        });
    };

    // Event Listeners
    scene.addEventListener('click', handleFlip);
    flipBtn.addEventListener('click', handleFlip);

    ratingBtns.querySelector('#btn-correct').addEventListener('click', (e) => {
        e.stopPropagation();
        handleRating(true);
    });

    ratingBtns.querySelector('#btn-incorrect').addEventListener('click', (e) => {
        e.stopPropagation();
        handleRating(false);
    });

    // Keyboard support (attached/removed with session lifecycle)
    const keyHandler = (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            handleFlip();
        }
    };
    // Start Session
    startBtn.addEventListener('click', () => {
        const shouldShuffle = !!document.getElementById('shuffle-cb').checked;
        // Build session card order
        sessionCards = shouldShuffle ? shuffleArray(deck.cards.slice()) : deck.cards.slice();
        sessionTotal = sessionCards.length;
        currentIndex = 0;
        // Reset session stats
        sessionStats = { viewed: 0, correct: 0, incorrect: 0 };

        // Hide config and show scene/controls
        configPanel.style.display = 'none';
        scene.style.display = '';
        controls.style.display = '';
        progressIndicator.style.display = '';
        updateProgress();
        showCard(0);
        // focus the scene so keyboard (Space) works immediately
        scene.focus();
        // Attach key handler for the session
        document.addEventListener('keydown', keyHandler);
    });

    // Initialize
    if (deck.cards.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>This deck has no cards.</p>
                <a href="#/edit/${deckId}" class="btn btn-primary">Add Cards</a>
            </div>
        `;
    } else {
        // showCard(0);
        // Hide the study UI until the user starts the session (via config)
        scene.style.display = 'none';
        controls.style.display = 'none';
        progressIndicator.style.display = 'none';
    }

    return container;
}
