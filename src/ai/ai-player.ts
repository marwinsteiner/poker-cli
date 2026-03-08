import type { GameState, PlayerAction } from '../engine/types.js';
import { getAvailableActions } from '../engine/betting.js';
import { evaluatePreflopStrength, evaluatePostflopStrength } from './hand-strength.js';
import { getBucket, pickAction, calculateBetSize } from './strategy.js';

export function getAIAction(state: GameState): PlayerAction {
  const aiPlayer = state.players[1]!;
  const humanPlayer = state.players[0]!;
  const available = getAvailableActions(state);

  if (available.length === 0) {
    return { type: 'check' };
  }

  // Calculate hand strength
  let strength: number;
  if (state.street === 'preflop') {
    strength = evaluatePreflopStrength(aiPlayer.holeCards);
  } else {
    strength = evaluatePostflopStrength(aiPlayer.holeCards, state.communityCards);
  }

  // Determine if facing a bet
  const facingBet = humanPlayer.currentBet > aiPlayer.currentBet;

  // Get strategy bucket and pick action
  const bucket = getBucket(strength, facingBet);
  const strategyAction = pickAction(bucket);

  // Map strategy action to available actions
  const actionType = strategyAction.type;

  // Find matching available action
  const matchedAction = available.find(a => a.type === actionType);

  if (matchedAction) {
    switch (matchedAction.type) {
      case 'fold':
        return { type: 'fold' };
      case 'check':
        return { type: 'check' };
      case 'call':
        return { type: 'call', amount: matchedAction.callAmount };
      case 'raise': {
        const betSize = calculateBetSize(
          state.pot,
          matchedAction.minRaise!,
          matchedAction.maxRaise!,
          strategyAction.betSizeMin ?? 0.5,
          strategyAction.betSizeMax ?? 0.75,
        );
        return { type: 'raise', amount: betSize };
      }
      case 'allin': {
        return { type: 'allin', amount: aiPlayer.chips };
      }
    }
  }

  // Fallback: map strategy to closest available action
  // If strategy says "call" but only "allin" is available, consider strength
  if (actionType === 'call' || actionType === 'raise') {
    const allinAction = available.find(a => a.type === 'allin');
    if (allinAction && strength > 0.4) {
      return { type: 'allin', amount: aiPlayer.chips };
    }
  }

  // Default fallbacks
  const checkAction = available.find(a => a.type === 'check');
  if (checkAction) return { type: 'check' };

  const callAction = available.find(a => a.type === 'call');
  if (callAction) return { type: 'call', amount: callAction.callAmount };

  const foldAction = available.find(a => a.type === 'fold');
  if (foldAction) return { type: 'fold' };

  // Last resort
  return { type: 'check' };
}
