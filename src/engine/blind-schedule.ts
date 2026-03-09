import type { BlindLevel } from './types.js';

export const TURBO_SCHEDULE: BlindLevel[] = [
  { small: 10, big: 20, durationSeconds: 180 },
  { small: 15, big: 30, durationSeconds: 180 },
  { small: 25, big: 50, durationSeconds: 180 },
  { small: 50, big: 100, durationSeconds: 180 },
  { small: 75, big: 150, durationSeconds: 180 },
  { small: 100, big: 200, durationSeconds: 180 },
  { small: 150, big: 300, durationSeconds: 180 },
  { small: 200, big: 400, durationSeconds: 180 },
  { small: 300, big: 600, durationSeconds: 180 },
  { small: 500, big: 1000, durationSeconds: 180 },
];

export const NORMAL_SCHEDULE: BlindLevel[] = [
  { small: 10, big: 20, durationSeconds: 300 },
  { small: 15, big: 30, durationSeconds: 300 },
  { small: 25, big: 50, durationSeconds: 300 },
  { small: 50, big: 100, durationSeconds: 300 },
  { small: 75, big: 150, durationSeconds: 300 },
  { small: 100, big: 200, durationSeconds: 300 },
  { small: 150, big: 300, durationSeconds: 300 },
  { small: 200, big: 400, durationSeconds: 300 },
  { small: 300, big: 600, durationSeconds: 300 },
  { small: 500, big: 1000, durationSeconds: 300 },
];

export const DEEP_SCHEDULE: BlindLevel[] = [
  { small: 10, big: 20, durationSeconds: 600 },
  { small: 15, big: 30, durationSeconds: 600 },
  { small: 25, big: 50, durationSeconds: 600 },
  { small: 50, big: 100, durationSeconds: 600 },
  { small: 75, big: 150, durationSeconds: 600 },
  { small: 100, big: 200, durationSeconds: 600 },
  { small: 150, big: 300, durationSeconds: 600 },
  { small: 200, big: 400, durationSeconds: 600 },
  { small: 300, big: 600, durationSeconds: 600 },
  { small: 500, big: 1000, durationSeconds: 600 },
];

export type BlindSpeed = 'turbo' | 'normal' | 'deep';

export function getBlindSchedule(speed: BlindSpeed): BlindLevel[] {
  switch (speed) {
    case 'turbo': return TURBO_SCHEDULE;
    case 'normal': return NORMAL_SCHEDULE;
    case 'deep': return DEEP_SCHEDULE;
  }
}
