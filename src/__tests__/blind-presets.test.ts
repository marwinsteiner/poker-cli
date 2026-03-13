import { describe, it, expect } from 'vitest';
import { BLIND_PRESETS, STACK_PRESETS } from '../engine/constants.js';
import { createInitialState, gameReducer } from '../engine/game-state.js';
import type { GameConfig } from '../engine/types.js';

describe('blind presets', () => {
  it('all presets have positive small and big blinds', () => {
    for (const preset of BLIND_PRESETS) {
      expect(preset.small).toBeGreaterThan(0);
      expect(preset.big).toBeGreaterThan(0);
    }
  });

  it('small blind is less than or equal to big blind', () => {
    for (const preset of BLIND_PRESETS) {
      expect(preset.small).toBeLessThanOrEqual(preset.big);
    }
  });

  it('all values are integers (cents)', () => {
    for (const preset of BLIND_PRESETS) {
      expect(Number.isInteger(preset.small)).toBe(true);
      expect(Number.isInteger(preset.big)).toBe(true);
    }
  });

  it('presets are sorted in ascending order', () => {
    for (let i = 1; i < BLIND_PRESETS.length; i++) {
      expect(BLIND_PRESETS[i]!.big).toBeGreaterThanOrEqual(BLIND_PRESETS[i - 1]!.big);
    }
  });
});

describe('stack presets', () => {
  it('all values are positive integers', () => {
    for (const stack of STACK_PRESETS) {
      expect(stack).toBeGreaterThan(0);
      expect(Number.isInteger(stack)).toBe(true);
    }
  });

  it('are sorted in ascending order', () => {
    for (let i = 1; i < STACK_PRESETS.length; i++) {
      expect(STACK_PRESETS[i]!).toBeGreaterThan(STACK_PRESETS[i - 1]!);
    }
  });
});

describe('game initialization with presets', () => {
  it('initializes correctly with each blind preset', () => {
    for (const preset of BLIND_PRESETS) {
      const config: GameConfig = {
        mode: 'cash',
        playerCount: 6,
        startingChips: 2000,
        smallBlind: preset.small,
        bigBlind: preset.big,
      };
      const state = createInitialState(config);

      expect(state.smallBlind).toBe(preset.small);
      expect(state.bigBlind).toBe(preset.big);
    }
  });

  it('POST_BLINDS deducts correct cent amounts', () => {
    for (const preset of BLIND_PRESETS) {
      const config: GameConfig = {
        mode: 'cash',
        playerCount: 3,
        startingChips: 10000,
        smallBlind: preset.small,
        bigBlind: preset.big,
      };
      let state = createInitialState(config);
      state = gameReducer(state, { type: 'START_NEW_HAND' });
      state = gameReducer(state, { type: 'POST_BLINDS' });

      // Find SB and BB players — they should have chips reduced
      const totalPosted = state.pots.reduce((sum, p) => sum + p.amount, 0);
      expect(totalPosted).toBe(preset.small + preset.big);

      // Check no player has more chips than starting amount
      for (const p of state.players) {
        expect(p.chips).toBeLessThanOrEqual(10000);
      }
    }
  });
});
