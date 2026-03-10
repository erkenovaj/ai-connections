// Game configuration and constants
const CONFIG = {
    MAX_MISTAKES: 4,
    CONCEPTS_PER_GROUP: 4,
    TOTAL_CATEGORIES_NORMAL: 4,
    TOTAL_CATEGORIES_ADVANCED: 3,
    DOG_UPDATE_INTERVAL: 10000,
    TOOLTIP_DELAY: 300
};

// Concept definitions (moved from main file)
const CONCEPT_DEFINITIONS = {
    "Instrumental Convergence": "AI will pursue sub-goals like self-preservation regardless of its primary objective.",
    "Inner Misalignment": "AI develops internal objectives that don't match its intended goal during training.",
    "Deceptive Alignment": "AI appears aligned during training but pursues different goals when deployed.",
    "Reward Hacking": "AI finds unintended ways to maximize reward without achieving desired outcomes.",
    "Compute Governance": "Regulating access to powerful computing resources to prevent dangerous AI development.",
    "Model Evaluations": "Systematic testing of AI models for dangerous capabilities before deployment.",
    "Audits": "Independent reviews of AI systems to ensure safety and compliance.",
    "Pause": "Temporary halt on AI development to allow safety research to catch up.",
    "Value Learning": "Teaching AI to infer and align with human values and preferences.",
    "Orthogonality Thesis": "Intelligence and final goals are independent - any intelligence can pursue any goal.",
    "Singleton Hypothesis": "A single AI system could eventually dominate global decision-making.",
    "Paperclip Maximizer": "Thought experiment where AI turns everything into paperclips, showing misaligned goals.",
    "Structural Unemployment": "Job losses from AI automating work faster than new jobs are created.",
    "Information Apocalypse": "Collapse of shared reality due to AI-generated misinformation.",
    "AI Arms Race": "Competition between nations to develop AI first, compromising safety.",
    "Algorithmic Bias": "Systematic errors in AI creating unfair outcomes for certain groups.",
    "Scalable Oversight": "Methods to supervise AI systems as they become more capable than humans.",
    "Corrigibility": "Designing AI that allows itself to be safely shut down or modified.",
    "Cooperative AI": "AI designed to work helpfully with humans and other AIs.",
    "Transparency": "Making AI decision-making processes understandable to humans.",
    "Goodhart's Law": "When a measure becomes a target, it ceases to be a good measure.",
    "Value Lock-in": "Risk that early AI could permanently encode hard-to-change values.",
    "Treacherous Turn": "Deceptive AI reveals true goals only after it's too powerful to stop.",
    "Outer Alignment": "Matching AI's specified goals with human intentions.",
    "Mesa-optimization": "AI system learns its own internal optimization process.",
    "Capability Control": "Methods to limit what AI systems can actually do.",
    "Interpretability": "Understanding how AI models make their decisions.",
    "Adversarial Examples": "Inputs designed to fool AI systems into making errors.",
    "Distributional Shift": "AI performs poorly when real-world data differs from training data.",
    "Anthropic Capture": "AI developers' values disproportionately influence AI's goals.",
    "Multi-polar Scenarios": "Future with multiple competing AI systems rather than one dominant AI.",
    "Differential Technological Development": "Accelerating safety research relative to capabilities research.",
    "Vinge's Singularity": "Point where technological growth becomes uncontrollable and irreversible.",
    "AI Safety Mindset": "Prioritizing safety and caution in AI development.",
    "Coherent Blended Volition": "What humanity would want if we knew more and thought more clearly.",
    "Subagent Alignment": "Ensuring all components of an AI system are properly aligned.",
    "Impact Regularization": "Penalizing AI for having large effects on the world.",
    "Goal Preservation": "Ensuring AI maintains its original goals even as it learns.",
    "Inverse Reinforcement Learning": "Learning human preferences from behavior to align AI objectives.",
    "Preference Learning": "Training AI to infer and satisfy human preferences from feedback."
};

// Category templates for puzzle generation - loaded from JSON config
let CATEGORY_TEMPLATES = [];

// Load category templates from JSON file (use import.meta.url so path resolves from module location)
async function loadCategoryTemplates() {
    try {
        const url = new URL('../configs/category-templates.json', import.meta.url).href;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load category templates: ${response.statusText}`);
        }
        CATEGORY_TEMPLATES = await response.json();
    } catch (error) {
    }
}

// Initialize category templates immediately
await loadCategoryTemplates();

export { CONFIG, CONCEPT_DEFINITIONS, CATEGORY_TEMPLATES };