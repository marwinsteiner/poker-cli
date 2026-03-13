import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from '../engine/game-state.js';
import { filterStateForClient } from '../net/state-filter.js';
import type { GameConfig } from '../engine/types.js';

function setupGame(playerCount = 3): ReturnType<typeof createInitialState> {
  const config: GameConfig = {
    mode: 'cash',
    playerCount,
    startingChips: 2000,
    smallBlind: 10,
    bigBlind: 20,
  };
  return createInitialState(config);
}

function advanceToShowdown(initialState: ReturnType<typeof createInitialState>) {
  let state = initialState;

  // Start hand
  state = gameReducer(state, { type: 'START_NEW_HAND' });
  state = gameReducer(state, { type: 'POST_BLINDS' });
  state = gameReducer(state, { type: 'DEAL_HOLE_CARDS' });

  // Everyone calls preflop
  for (let i = 0; i < state.playerCount; i++) {
    const player = state.players[state.currentPlayerIndex]!;
    if (player.hasFolded || player.isAllIn || player.isEliminated) continue;
    const maxBet = Math.max(...state.players.filter(p => !p.isEliminated).map(p => p.currentBet));
    const toCall = maxBet - player.currentBet;
    if (toCall > 0) {
      state = gameReducer(state, { type: 'PLAYER_ACTION', action: { type: 'call', amount: toCall } });
    } else {
      state = gameReducer(state, { type: 'PLAYER_ACTION', action: { type: 'check' } });
    }
  }

  // Advance through flop, turn, river with checks
  for (const _street of ['flop', 'turn', 'river']) {
    state = gameReducer(state, { type: 'ADVANCE_STREET' });
    for (let i = 0; i < state.playerCount; i++) {
      const player = state.players[state.currentPlayerIndex]!;
      if (player.hasFolded || player.isAllIn || player.isEliminated) continue;
      state = gameReducer(state, { type: 'PLAYER_ACTION', action: { type: 'check' } });
    }
  }

  // Showdown
  state = gameReducer(state, { type: 'SHOWDOWN' });
  return state;
}

describe('showdown visibility', () => {
  it('sets showdownRequired to true after SHOWDOWN action', () => {
    const state = advanceToShowdown(setupGame());
    expect(state.showdownRequired).toBe(true);
  });

  it('populates showdownResults for non-folded players', () => {
    const state = advanceToShowdown(setupGame());
    expect(state.showdownResults).not.toBeNull();
    expect(state.showdownResults!.length).toBeGreaterThan(0);

    // All non-folded players should have results
    const nonFolded = state.players.filter(p => !p.hasFolded && !p.isEliminated);
    for (const p of nonFolded) {
      const result = state.showdownResults!.find(r => r.seatIndex === p.seatIndex);
      expect(result).toBeDefined();
      expect(result!.hand).toBeDefined();
      expect(result!.hand.name).toBeTruthy();
    }
  });

  it('non-folded players have holeCards populated during showdown', () => {
    const state = advanceToShowdown(setupGame());
    const nonFolded = state.players.filter(p => !p.hasFolded && !p.isEliminated);
    for (const p of nonFolded) {
      expect(p.holeCards.length).toBe(2);
    }
  });

  it('filterStateForClient reveals holeCards during showdown for non-folded players', () => {
    const state = advanceToShowdown(setupGame());

    // Filter for seat 0 (should see all non-folded players' cards)
    const filtered = filterStateForClient(state, 0);

    for (const p of filtered.players) {
      if (p.hasFolded || p.isEliminated) {
        // Folded players should not have cards revealed
        if (p.seatIndex !== 0) {
          expect(p.holeCards.length).toBe(0);
        }
      } else {
        // Non-folded players should have cards visible during showdown
        expect(p.holeCards.length).toBe(2);
      }
    }
  });

  it('filterStateForClient hides holeCards when showdownRequired is false', () => {
    const config: GameConfig = {
      mode: 'cash',
      playerCount: 3,
      startingChips: 2000,
      smallBlind: 10,
      bigBlind: 20,
    };
    let state = createInitialState(config);
    state = gameReducer(state, { type: 'START_NEW_HAND' });
    state = gameReducer(state, { type: 'POST_BLINDS' });
    state = gameReducer(state, { type: 'DEAL_HOLE_CARDS' });

    // Before showdown, other players' cards should be hidden
    expect(state.showdownRequired).toBe(false);
    const filtered = filterStateForClient(state, 0);

    for (const p of filtered.players) {
      if (p.seatIndex === 0) {
        expect(p.holeCards.length).toBe(2); // own cards visible
      } else {
        expect(p.holeCards.length).toBe(0); // others hidden
      }
    }
  });

  it('does not reveal cards when hand ends via fold', () => {
    const config: GameConfig = {
      mode: 'cash',
      playerCount: 3,
      startingChips: 2000,
      smallBlind: 10,
      bigBlind: 20,
    };
    let state = createInitialState(config);
    state = gameReducer(state, { type: 'START_NEW_HAND' });
    state = gameReducer(state, { type: 'POST_BLINDS' });
    state = gameReducer(state, { type: 'DEAL_HOLE_CARDS' });

    // All players except one fold
    for (let i = 0; i < state.playerCount - 1; i++) {
      state = gameReducer(state, { type: 'PLAYER_ACTION', action: { type: 'fold' } });
    }

    // Hand should end without showdown
    expect(state.showdownRequired).toBe(false);
  });
});
