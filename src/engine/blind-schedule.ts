import type { BlindLevel } from './types.js';

export const TURBO_SCHEDULE: BlindLevel[] = [
  { small: 1000, big: 2000, durationSeconds: 180 },
  { small: 1500, big: 3000, durationSeconds: 180 },
  { small: 2500, big: 5000, durationSeconds: 180 },
  { small: 5000, big: 10000, durationSeconds: 180 },
  { small: 7500, big: 15000, durationSeconds: 180 },
  { small: 10000, big: 20000, durationSeconds: 180 },
  { small: 15000, big: 30000, durationSeconds: 180 },
  { small: 20000, big: 40000, durationSeconds: 180 },
  { small: 30000, big: 60000, durationSeconds: 180 },
  { small: 50000, big: 100000, durationSeconds: 180 },
];

export const NORMAL_SCHEDULE: BlindLevel[] = [
  { small: 1000, big: 2000, durationSeconds: 300 },
  { small: 1500, big: 3000, durationSeconds: 300 },
  { small: 2500, big: 5000, durationSeconds: 300 },
  { small: 5000, big: 10000, durationSeconds: 300 },
  { small: 7500, big: 15000, durationSeconds: 300 },
  { small: 10000, big: 20000, durationSeconds: 300 },
  { small: 15000, big: 30000, durationSeconds: 300 },
  { small: 20000, big: 40000, durationSeconds: 300 },
  { small: 30000, big: 60000, durationSeconds: 300 },
  { small: 50000, big: 100000, durationSeconds: 300 },
];

export const DEEP_SCHEDULE: BlindLevel[] = [
  { small: 1000, big: 2000, durationSeconds: 600 },
  { small: 1500, big: 3000, durationSeconds: 600 },
  { small: 2500, big: 5000, durationSeconds: 600 },
  { small: 5000, big: 10000, durationSeconds: 600 },
  { small: 7500, big: 15000, durationSeconds: 600 },
  { small: 10000, big: 20000, durationSeconds: 600 },
  { small: 15000, big: 30000, durationSeconds: 600 },
  { small: 20000, big: 40000, durationSeconds: 600 },
  { small: 30000, big: 60000, durationSeconds: 600 },
  { small: 50000, big: 100000, durationSeconds: 600 },
];

export type BlindSpeed = 'turbo' | 'normal' | 'deep';

export function getBlindSchedule(speed: BlindSpeed): BlindLevel[] {
  switch (speed) {
    case 'turbo': return TURBO_SCHEDULE;
    case 'normal': return NORMAL_SCHEDULE;
    case 'deep': return DEEP_SCHEDULE;
  }
}
