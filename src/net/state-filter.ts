import type { GameState } from '../engine/types.js';
import type { ClientGameState, ClientPlayer } from './types.js';

/**
 * Filter game state for a specific client seat.
 * - Strips deck, personality, totalHandBet
 * - Redacts hole cards for non-self, non-showdown players
 */
export function filterStateForClient(
  state: GameState,
  viewerSeat: number,
): ClientGameState {
  const players: ClientPlayer[] = state.players.map(p => {
    let holeCards = p.holeCards;

    if (p.seatIndex !== viewerSeat) {
      // Show cards only during showdown for non-folded players
      const showdownReveal =
        state.showdownRequired && !p.hasFolded && !p.isEliminated;
      if (!showdownReveal) {
        holeCards = [];
      }
    }

    return {
      seatIndex: p.seatIndex,
      name: p.name,
      isHuman: p.isHuman,
      isEliminated: p.isEliminated,
      chips: p.chips,
      holeCards,
      currentBet: p.currentBet,
      hasFolded: p.hasFolded,
      hasActed: p.hasActed,
      isAllIn: p.isAllIn,
      lastAction: p.lastAction,
    };
  });

  return {
    players,
    playerCount: state.playerCount,
    mode: state.mode,
    communityCards: state.communityCards,
    pots: state.pots,
    street: state.street,
    currentPlayerIndex: state.currentPlayerIndex,
    dealerIndex: state.dealerIndex,
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    handNumber: state.handNumber,
    isHandComplete: state.isHandComplete,
    winnerSeatIndices: state.winnerSeatIndices,
    showdownResults: state.showdownResults,
    showdownRequired: state.showdownRequired,
    messageLog: state.messageLog,
    eliminationOrder: state.eliminationOrder,
    blindSchedule: state.blindSchedule,
    currentBlindLevel: state.currentBlindLevel,
    actionTimerSeconds: state.actionTimerSeconds,
  };
}
