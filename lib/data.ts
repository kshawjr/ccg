import type { Row } from './types';

// The official 6-row, 4-cluster True Colors word set.
// Cluster index 0..3 within each row is stable and used as the response key.
export const ROWS: Row[] = [
  // Row 1
  [
    { color: 'orange', words: ['Active', 'Opportunistic', 'Spontaneous'] },
    { color: 'gold', words: ['Parental', 'Traditional', 'Responsible'] },
    { color: 'blue', words: ['Authentic', 'Harmonious', 'Compassionate'] },
    { color: 'green', words: ['Versatile', 'Inventive', 'Competent'] },
  ],
  // Row 2
  [
    { color: 'green', words: ['Curious', 'Conceptual', 'Knowledgeable'] },
    { color: 'blue', words: ['Unique', 'Empathetic', 'Communicative'] },
    { color: 'gold', words: ['Practical', 'Sensible', 'Dependable'] },
    { color: 'orange', words: ['Competitive', 'Impetuous', 'Impactful'] },
  ],
  // Row 3
  [
    { color: 'gold', words: ['Loyal', 'Conservative', 'Organized'] },
    { color: 'blue', words: ['Devoted', 'Warm', 'Optimistic'] },
    { color: 'orange', words: ['Realistic', 'Open minded', 'Adventuresome'] },
    { color: 'green', words: ['Theoretical', 'Seeking', 'Ingenious'] },
  ],
  // Row 4
  [
    { color: 'gold', words: ['Concerned', 'Procedural', 'Cooperative'] },
    { color: 'orange', words: ['Daring', 'Impulsive', 'Fun'] },
    { color: 'blue', words: ['Peacemaker', 'Inspirational', 'Dramatic'] },
    { color: 'green', words: ['Determined', 'Complex', 'Composed'] },
  ],
  // Row 5
  [
    { color: 'green', words: ['Philosophical', 'Principled', 'Rational'] },
    { color: 'blue', words: ['Vivacious', 'Affectionate', 'Sympathetic'] },
    { color: 'orange', words: ['Exciting', 'Courageous', 'Skillful'] },
    { color: 'gold', words: ['Orderly', 'Conventional', 'Pride'] },
  ],
  // Row 6
  [
    { color: 'orange', words: ['Risk taker', 'Confident', 'Brief'] },
    { color: 'blue', words: ['Creative', 'Mediator', 'Sensitive'] },
    { color: 'gold', words: ['Accountable', 'Predictable', 'Reliable'] },
    { color: 'green', words: ['Visionary', 'Logical', 'Inquisitive'] },
  ],
];

export const COLOR_HEX: Record<'orange' | 'blue' | 'gold' | 'green', string> = {
  orange: '#D85A30',
  blue: '#378ADD',
  gold: '#BA7517',
  green: '#639922',
};

export const COLOR_LABEL: Record<'orange' | 'blue' | 'gold' | 'green', string> = {
  orange: 'Orange',
  blue: 'Blue',
  gold: 'Gold',
  green: 'Green',
};

export const PRIMARY_DESCRIPTION: Record<'orange' | 'blue' | 'gold' | 'green', string> = {
  orange:
    "You're a doer. Spontaneous, action-oriented, and energized by freedom. You thrive when you can move fast, take risks, and adapt on the fly.",
  blue:
    "You're a connector. Relationally driven, empathetic, motivated by authentic connection. You read people well and care deeply about how others feel.",
  gold:
    "You're a builder. Structured, dependable, grounded in responsibility. You bring order, follow-through, and reliability to everything you take on.",
  green:
    "You're a thinker. Analytical, curious, driven by understanding. You ask the deeper questions, think in systems, and seek competence over recognition.",
};

export const ROUND_VIBES: string[] = [
  'Quick warm-up ✨',
  'Doing great 🌊',
  'Halfway already 🌅',
  'Hitting your stride 🎯',
  'One more after this 🔥',
  'Last round! 🏁',
];

// One-line word definitions for the long-press tooltip.
export const DEFINITIONS: Record<string, string> = {
  Active: 'Full of energy, always doing something.',
  Opportunistic: 'Quick to seize a chance when it appears.',
  Spontaneous: 'Acts on impulse without planning.',
  Parental: 'Caring and protective like a parent.',
  Traditional: 'Prefers established ways and customs.',
  Responsible: "Reliable and accountable for one's actions.",
  Authentic: 'Genuine, true to oneself.',
  Harmonious: 'Peaceful, in agreement with others.',
  Compassionate: "Sympathetic, moved by others' feelings.",
  Versatile: 'Adapts easily to many different things.',
  Inventive: 'Creative at coming up with new ideas.',
  Competent: 'Capable, gets the job done well.',
  Curious: 'Eager to learn, asks lots of questions.',
  Conceptual: 'Thinks in abstract ideas and patterns.',
  Knowledgeable: 'Well-informed across many topics.',
  Unique: 'One of a kind, distinctive.',
  Empathetic: 'Feels what others are feeling.',
  Communicative: 'Shares thoughts and feelings openly.',
  Practical: 'Focused on what works in real life.',
  Sensible: 'Shows good judgment.',
  Dependable: 'Can be counted on.',
  Competitive: 'Driven to win or be the best.',
  Impetuous: 'Acts on impulse with intensity.',
  Impactful: 'Makes a strong impression or difference.',
  Loyal: 'Faithful, sticks with people and causes.',
  Conservative: 'Cautious, prefers the tried-and-true.',
  Organized: 'Keeps things ordered and structured.',
  Devoted: 'Deeply committed to someone or something.',
  Warm: 'Kind and welcoming.',
  Optimistic: 'Expects good things to happen.',
  Realistic: 'Sees things as they actually are.',
  'Open minded': 'Receptive to new ideas.',
  Adventuresome: 'Drawn to risk and new experiences.',
  Theoretical: 'Thinks in concepts before action.',
  Seeking: 'Always searching for deeper understanding.',
  Ingenious: 'Clever, finds smart solutions.',
  Concerned: 'Cares about how things turn out.',
  Procedural: 'Follows a set process step by step.',
  Cooperative: 'Works well with others toward a goal.',
  Daring: 'Bold, willing to take chances.',
  Impulsive: 'Acts without much thought.',
  Fun: 'Enjoys play and lighthearted moments.',
  Peacemaker: 'Brings calm and resolves conflict.',
  Inspirational: 'Motivates and uplifts others.',
  Dramatic: 'Expressive, makes things vivid.',
  Determined: 'Refuses to give up.',
  Complex: 'Rich and multi-layered in thinking.',
  Composed: 'Stays calm under pressure.',
  Philosophical: 'Ponders deep questions about life.',
  Principled: 'Acts according to firm beliefs.',
  Rational: 'Relies on logic and reason.',
  Vivacious: 'Lively, full of spirit.',
  Affectionate: 'Warm and openly caring.',
  Sympathetic: "Shares in others' feelings.",
  Exciting: 'Brings energy and thrill.',
  Courageous: 'Brave in the face of difficulty.',
  Skillful: 'Highly capable at what they do.',
  Orderly: 'Tidy and methodical.',
  Conventional: 'Follows accepted norms.',
  Pride: 'Takes deep satisfaction in their work.',
  'Risk taker': 'Willing to bet on uncertain outcomes.',
  Confident: "Sure of one's own abilities.",
  Brief: 'Gets to the point quickly.',
  Creative: 'Imagines new possibilities.',
  Mediator: 'Helps others find common ground.',
  Sensitive: 'Feels things deeply.',
  Accountable: 'Takes ownership of outcomes.',
  Predictable: 'Behaves consistently.',
  Reliable: 'Can be counted on time after time.',
  Visionary: 'Sees what could be, not just what is.',
  Logical: 'Reasons step by step.',
  Inquisitive: 'Questioning, eager to know.',
};
