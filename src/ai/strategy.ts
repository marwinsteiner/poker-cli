import type { ActionType, AIPersonality } from '../engine/types.js';

export interface StrategyAction {
  type: ActionType;
  frequency: number; // 0.0 - 1.0, frequencies in bucket must sum to 1.0
  betSizeMin?: number; // as fraction of pot
  betSizeMax?: number;
}

export interface StrategyBucket {
  minStrength: number;
  maxStrength: number;
  actions: StrategyAction[];
}

// When facing no bet (check or bet opportunity)
export const NO_BET_STRATEGY: StrategyBucket[] = [
  {
    minStrength: 0.0,
    maxStrength: 0.25,
    actions: [
      { type: 'check', frequency: 0.85 },
      { type: 'raise', frequency: 0.15, betSizeMin: 0.33, betSizeMax: 0.5 }, // bluff
    ],
  },
  {
    minStrength: 0.25,
    maxStrength: 0.45,
    actions: [
      { type: 'check', frequency: 0.65 },
      { type: 'raise', frequency: 0.35, betSizeMin: 0.33, betSizeMax: 0.5 },
    ],
  },
  {
    minStrength: 0.45,
    maxStrength: 0.65,
    actions: [
      { type: 'check', frequency: 0.3 },
      { type: 'raise', frequency: 0.7, betSizeMin: 0.5, betSizeMax: 0.75 },
    ],
  },
  {
    minStrength: 0.65,
    maxStrength: 0.85,
    actions: [
      { type: 'check', frequency: 0.1 },
      { type: 'raise', frequency: 0.9, betSizeMin: 0.6, betSizeMax: 1.0 },
    ],
  },
  {
    minStrength: 0.85,
    maxStrength: 1.0,
    actions: [
      { type: 'check', frequency: 0.15 }, // slow play
      { type: 'raise', frequency: 0.65, betSizeMin: 0.75, betSizeMax: 1.0 },
      { type: 'allin', frequency: 0.2 },
    ],
  },
];

// When facing a bet (fold, call, or raise)
export const FACING_BET_STRATEGY: StrategyBucket[] = [
  {
    minStrength: 0.0,
    maxStrength: 0.2,
    actions: [
      { type: 'fold', frequency: 0.85 },
      { type: 'call', frequency: 0.05 },
      { type: 'raise', frequency: 0.1, betSizeMin: 0.5, betSizeMax: 0.75 }, // bluff raise
    ],
  },
  {
    minStrength: 0.2,
    maxStrength: 0.4,
    actions: [
      { type: 'fold', frequency: 0.45 },
      { type: 'call', frequency: 0.5 },
      { type: 'raise', frequency: 0.05, betSizeMin: 0.5, betSizeMax: 0.75 },
    ],
  },
  {
    minStrength: 0.4,
    maxStrength: 0.6,
    actions: [
      { type: 'fold', frequency: 0.1 },
      { type: 'call', frequency: 0.7 },
      { type: 'raise', frequency: 0.2, betSizeMin: 0.5, betSizeMax: 0.75 },
    ],
  },
  {
    minStrength: 0.6,
    maxStrength: 0.8,
    actions: [
      { type: 'fold', frequency: 0.0 },
      { type: 'call', frequency: 0.4 },
      { type: 'raise', frequency: 0.6, betSizeMin: 0.6, betSizeMax: 1.0 },
    ],
  },
  {
    minStrength: 0.8,
    maxStrength: 1.0,
    actions: [
      { type: 'fold', frequency: 0.0 },
      { type: 'call', frequency: 0.15 },
      { type: 'raise', frequency: 0.55, betSizeMin: 0.75, betSizeMax: 1.0 },
      { type: 'allin', frequency: 0.3 },
    ],
  },
];

export function getBucket(strength: number, facingBet: boolean): StrategyBucket {
  const buckets = facingBet ? FACING_BET_STRATEGY : NO_BET_STRATEGY;
  for (const bucket of buckets) {
    if (strength >= bucket.minStrength && strength < bucket.maxStrength) {
      return bucket;
    }
  }
  return buckets[buckets.length - 1]!; // strength === 1.0
}

export function pickAction(bucket: StrategyBucket): StrategyAction {
  const roll = Math.random();
  let cumulative = 0;
  for (const action of bucket.actions) {
    cumulative += action.frequency;
    if (roll <= cumulative) return action;
  }
  return bucket.actions[bucket.actions.length - 1]!;
}

export function calculateBetSize(
  potSize: number,
  minBet: number,
  maxBet: number,
  sizeMin: number,
  sizeMax: number,
): number {
  const targetFraction = sizeMin + Math.random() * (sizeMax - sizeMin);
  const target = Math.round(potSize * targetFraction);
  return Math.max(minBet, Math.min(maxBet, target));
}

/**
 * Apply personality modifiers to a strategy bucket.
 * Returns a new bucket with adjusted frequencies.
 */
export function applyPersonality(bucket: StrategyBucket, personality: AIPersonality): StrategyBucket {
  const actions = bucket.actions.map(a => ({ ...a }));

  for (const action of actions) {
    switch (action.type) {
      case 'fold':
        // Tighter players fold less often when they play, but play fewer hands
        // handled by strength shift
        break;
      case 'check':
        // More aggressive = less checking
        action.frequency = Math.max(0, action.frequency - personality.aggression * 0.3);
        break;
      case 'call':
        // More aggressive = less calling, more raising
        action.frequency = Math.max(0, action.frequency - personality.aggression * 0.2);
        break;
      case 'raise':
        // More aggressive = more raising
        action.frequency = Math.max(0, action.frequency + personality.aggression * 0.4);
        // Bluff frequency: add bluff raises for weak hands
        action.frequency = Math.max(0, action.frequency + personality.bluffFreq * 0.3);
        break;
      case 'allin':
        action.frequency = Math.max(0, action.frequency + personality.aggression * 0.1);
        break;
    }
  }

  // Renormalize frequencies to sum to 1.0
  const total = actions.reduce((sum, a) => sum + a.frequency, 0);
  if (total > 0) {
    for (const action of actions) {
      action.frequency /= total;
    }
  }

  return { ...bucket, actions };
}
