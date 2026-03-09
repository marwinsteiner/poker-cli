import type { AIPersonality } from '../engine/types.js';

const ALL_PERSONALITIES: AIPersonality[] = [
  { name: 'Tight Tom', tightness: 0.1, aggression: -0.1, bluffFreq: 0 },
  { name: 'Loose Lucy', tightness: -0.1, aggression: 0.15, bluffFreq: 0 },
  { name: 'Solid Sam', tightness: 0, aggression: 0, bluffFreq: 0 },
  { name: 'Maniac Mike', tightness: -0.15, aggression: 0.2, bluffFreq: 0.05 },
  { name: 'Rock Rita', tightness: 0.15, aggression: -0.15, bluffFreq: 0 },
  { name: 'Tricky Tina', tightness: -0.05, aggression: 0.05, bluffFreq: 0.2 },
  { name: 'Calling Carl', tightness: -0.08, aggression: -0.1, bluffFreq: 0 },
];

/**
 * Randomly pick `count` unique personalities from the pool.
 */
export function assignPersonalities(count: number): AIPersonality[] {
  const pool = [...ALL_PERSONALITIES];
  const result: AIPersonality[] = [];

  for (let i = 0; i < count; i++) {
    if (pool.length === 0) {
      // If we need more than 7, reuse with suffix
      const base = ALL_PERSONALITIES[i % ALL_PERSONALITIES.length]!;
      result.push({ ...base, name: `${base.name} II` });
    } else {
      const idx = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(idx, 1)[0]!);
    }
  }

  return result;
}
