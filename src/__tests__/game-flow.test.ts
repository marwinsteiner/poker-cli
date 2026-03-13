import { describe, it, expect } from 'vitest';
import { createInitialState, gameReducer } from '../engine/game-state.js';
import { isRoundComplete } from '../engine/betting.js';
import type { GameConfig, GameState } from '../engine/types.js';

function makeConfig(overrides?: Partial<GameConfig>): GameConfig {
  return {
    mode: 'cash',
    playerCount: 3,
    startingChips: 2000,
    smallBlind: 10,
    bigBlind: 20,
    ...overrides,
  };
}

function startHand(config: GameConfig): GameState {
  let state = createInitialState(config);
  state = gameReducer(state, { type: 'START_NEW_HAND' });
  state = gameReducer(state, { type: 'POST_BLINDS' });
  state = gameReducer(state, { type: 'DEAL_HOLE_CARDS' });
  return state;
}

describe('full hand lifecycle', () => {
  it('START_NEW_HAND → POST_BLINDS → DEAL_HOLE_CARDS', () => {
    const config = makeConfig();
    let state = createInitialState(config);

    state = gameReducer(state, { type: 'START_NEW_HAND' });
    expect(state.handNumber).toBe(1);
    expect(state.isHandComplete).toBe(false);

    state = gameReducer(state, { type: 'POST_BLINDS' });
    expect(state.pots.length).toBeGreaterThan(0);
    const totalBlind = state.pots[0]!.amount;
    expect(totalBlind).toBe(30); // 10 + 20 cents

    state = gameReducer(state, { type: 'DEAL_HOLE_CARDS' });
    for (const p of state.players) {
      if (!p.isEliminated) {
        expect(p.holeCards.length).toBe(2);
      }
    }
  });

  it('chip amounts in cents are correct after blind posting', () => {
    const config = makeConfig({ startingChips: 5000, smallBlind: 25, bigBlind: 50 });
    const state = startHand(config);

    // Total chips in system should be preserved
    const totalChips = state.players.reduce((sum, p) => sum + p.chips, 0);
    const potChips = state.pots.reduce((sum, p) => sum + p.amount, 0);
    expect(totalChips + potChips).toBe(5000 * 3);
  });

  it('completes a full hand through showdown', () => {
    const config = makeConfig();
    let state = startHand(config);

    // Everyone calls/checks through all streets
    for (let street = 0; street < 4; street++) {
      if (street > 0) {
        state = gameReducer(state, { type: 'ADVANCE_STREET' });
      }

      // All players act
      let safety = 0;
      while (!isRoundComplete(state) && safety < 20) {
        const player = state.players[state.currentPlayerIndex]!;
        if (player.hasFolded || player.isAllIn || player.isEliminated) break;

        const maxBet = Math.max(...state.players.filter(p => !p.isEliminated).map(p => p.currentBet));
        const toCall = maxBet - player.currentBet;
        if (toCall > 0) {
          state = gameReducer(state, { type: 'PLAYER_ACTION', action: { type: 'call', amount: toCall } });
        } else {
          state = gameReducer(state, { type: 'PLAYER_ACTION', action: { type: 'check' } });
        }
        safety++;
      }
    }

    // Showdown
    state = gameReducer(state, { type: 'SHOWDOWN' });
    expect(state.showdownRequired).toBe(true);
    expect(state.showdownResults).not.toBeNull();

    // Award pot
    const winners = state.showdownResults!
      .filter(r => r.potWinnings > 0)
      .map(r => ({ seatIndex: r.seatIndex, amount: r.potWinnings }));
    state = gameReducer(state, { type: 'AWARD_POT', winners });

    expect(state.isHandComplete).toBe(true);

    // Total chips should be conserved
    const totalChips = state.players.reduce((sum, p) => sum + p.chips, 0);
    expect(totalChips).toBe(2000 * 3);
  });

  it('handles fold ending correctly', () => {
    const config = makeConfig();
    let state = startHand(config);

    // Everyone folds except last player
    for (let i = 0; i < config.playerCount - 1; i++) {
      state = gameReducer(state, { type: 'PLAYER_ACTION', action: { type: 'fold' } });
    }

    expect(isRoundComplete(state)).toBe(true);

    // Award pot to remaining player
    const nonFolded = state.players.filter(p => !p.hasFolded && !p.isEliminated);
    expect(nonFolded.length).toBe(1);

    const totalPot = state.pots.reduce((sum, p) => sum + p.amount, 0);
    state = gameReducer(state, {
      type: 'AWARD_POT',
      winners: [{ seatIndex: nonFolded[0]!.seatIndex, amount: totalPot }],
    });

    expect(state.isHandComplete).toBe(true);

    // Total chips conserved
    const totalChips = state.players.reduce((sum, p) => sum + p.chips, 0);
    expect(totalChips).toBe(2000 * 3);
  });

  it('handles betting with raises', () => {
    const config = makeConfig({ startingChips: 10000 });
    let state = startHand(config);

    // First player raises
    const player = state.players[state.currentPlayerIndex]!;
    const maxBet = Math.max(...state.players.filter(p => !p.isEliminated).map(p => p.currentBet));
    const toCall = maxBet - player.currentBet;
    const raiseAmount = toCall + 40; // raise by 40 cents
    state = gameReducer(state, { type: 'PLAYER_ACTION', action: { type: 'raise', amount: raiseAmount } });

    // Verify the raise was applied
    const raisingPlayer = state.players.find(p => p.lastAction?.startsWith('Raise'));
    expect(raisingPlayer).toBeDefined();

    // Total chips should still be conserved
    const totalChips = state.players.reduce((sum, p) => sum + p.chips, 0);
    const potChips = state.pots.reduce((sum, p) => sum + p.amount, 0);
    expect(totalChips + potChips).toBe(10000 * 3);
  });

  it('preserves chip conservation with odd cent pot splitting', () => {
    // With 3 players and odd pot, remainder should go to first winner
    const config = makeConfig({ startingChips: 1000 });
    let state = startHand(config);

    // All players go all-in
    for (let i = 0; i < 3; i++) {
      const p = state.players[state.currentPlayerIndex]!;
      if (!p.hasFolded && !p.isAllIn && !p.isEliminated) {
        state = gameReducer(state, { type: 'PLAYER_ACTION', action: { type: 'allin' } });
      }
    }

    // Run out the board
    while (state.street !== 'river') {
      state = gameReducer(state, { type: 'ADVANCE_STREET' });
    }

    state = gameReducer(state, { type: 'SHOWDOWN' });
    const winners = state.showdownResults!
      .filter(r => r.potWinnings > 0)
      .map(r => ({ seatIndex: r.seatIndex, amount: r.potWinnings }));

    // Total winnings should equal total pot
    const totalWinnings = winners.reduce((sum, w) => sum + w.amount, 0);
    const totalPot = state.pots.reduce((sum, p) => sum + p.amount, 0);
    expect(totalWinnings).toBe(totalPot);

    state = gameReducer(state, { type: 'AWARD_POT', winners });

    // Total chips conserved after award
    const totalChips = state.players.reduce((sum, p) => sum + p.chips, 0);
    expect(totalChips).toBe(1000 * 3);
  });
});
