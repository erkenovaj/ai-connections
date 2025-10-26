import { CONCEPT_DEFINITIONS } from './config.js';

class TooltipManager {
    constructor() {
        this.tooltip = document.getElementById('concept-tooltip');
        this.currentConcept = null;
        this.isSticky = false;
        this.init();
    }

    init() {
        // Create tooltip element if it doesn't exist
        if (!this.tooltip) {
            this.tooltip = document.createElement('div');
            this.tooltip.id = 'concept-tooltip';
            this.tooltip.className = 'concept-tooltip';
            document.body.appendChild(this.tooltip);
        }

        this.tooltip.addEventListener('mouseenter', () => this.makeSticky());
        this.tooltip.addEventListener('mouseleave', () => this.unstick());
    }

    show(concept, element) {
        const conceptData = CONCEPT_DEFINITIONS[concept];
        if (!conceptData) return;

        this.tooltip.innerHTML = `
            <div class="tooltip-title">${concept}</div>
            <div class="tooltip-definition">${conceptData}</div>
        `;

        this.positionTooltip(element);
        this.tooltip.classList.add('show');
        this.currentConcept = concept;
    }

    positionTooltip(element) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        
        // Calculate position - try to place tooltip near the cursor without overlapping
        let left = rect.left + (rect.width / 2) - 150; // Center horizontally
        let top = rect.top - tooltipRect.height - 10; // Position above the tile
        
        // Adjust if tooltip would go off screen
        if (left < 10) left = 10;
        if (left + 300 > window.innerWidth) left = window.innerWidth - 310;
        if (top < 10) {
            // If too high, position below the tile instead
            top = rect.bottom + 10;
        }

        this.tooltip.style.left = left + 'px';
        this.tooltip.style.top = top + 'px';
    }

    hide() {
        if (!this.isSticky) {
            this.tooltip.classList.remove('show');
            this.currentConcept = null;
        }
    }

    makeSticky() {
        this.isSticky = true;
        this.tooltip.classList.add('sticky');
    }

    unstick() {
        this.isSticky = false;
        this.tooltip.classList.remove('sticky');
        this.hide();
    }

    // Force hide tooltip (for game events)
    forceHide() {
        this.isSticky = false;
        this.tooltip.classList.remove('show', 'sticky');
        this.currentConcept = null;
    }
}

export default TooltipManager;