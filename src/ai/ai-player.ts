import type { GameState, PlayerAction, AIPersonality } from '../engine/types.js';
import { getAvailableActions } from '../engine/betting.js';
import { evaluatePreflopStrength, evaluatePostflopStrength } from './hand-strength.js';
import { getBucket, pickAction, calculateBetSize, applyPersonality } from './strategy.js';
import { getTotalPot } from '../engine/side-pots.js';

export function getAIAction(state: GameState, seatIndex?: number, personality?: AIPersonality): PlayerAction {
  const aiSeat = seatIndex ?? state.currentPlayerIndex;
  const aiPlayer = state.players[aiSeat]!;
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

  // Apply personality tightness modifier (shifts perceived strength)
  const effectivePersonality = personality ?? aiPlayer.personality;
  if (effectivePersonality) {
    strength = Math.max(0, Math.min(1, strength - effectivePersonality.tightness));
  }

  // Determine if facing a bet
  const maxBet = Math.max(...state.players.filter(p => !p.isEliminated).map(p => p.currentBet));
  const facingBet = maxBet > aiPlayer.currentBet;

  // Get strategy bucket and apply personality
  let bucket = getBucket(strength, facingBet);
  if (effectivePersonality) {
    bucket = applyPersonality(bucket, effectivePersonality);
  }

  const strategyAction = pickAction(bucket);

  // Map strategy action to available actions
  const actionType = strategyAction.type;
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
        const pot = getTotalPot(state.pots);
        const betSize = calculateBetSize(
          pot,
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

  return { type: 'check' };
}
