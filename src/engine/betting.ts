import type { GameState, AvailableAction } from './types.js';

export function getAvailableActions(state: GameState): AvailableAction[] {
  const player = state.players[state.currentPlayerIndex]!;
  const opponent = state.players[1 - state.currentPlayerIndex]!;
  const actions: AvailableAction[] = [];

  if (player.hasFolded || player.isAllIn) return [];

  const toCall = opponent.currentBet - player.currentBet;

  // Fold is always available if there's something to call
  if (toCall > 0) {
    actions.push({ type: 'fold', label: 'Fold' });
  }

  // Check if no bet to call
  if (toCall === 0) {
    actions.push({ type: 'check', label: 'Check' });
  }

  // Call if there's a bet
  if (toCall > 0) {
    const callAmount = Math.min(toCall, player.chips);
    if (callAmount >= player.chips) {
      // Calling costs all chips = call all-in
      actions.push({
        type: 'allin',
        label: `Call All-In $${player.chips + player.currentBet}`,
        minRaise: callAmount,
        maxRaise: callAmount,
      });
      return actions; // Can't raise if calling is already all-in
    }
    actions.push({ type: 'call', label: `Call $${callAmount}`, callAmount });
  }

  // Raise/Bet (only if player has chips beyond calling)
  const chipsAfterCall = player.chips - toCall;
  if (chipsAfterCall <= 0) return actions;

  const minRaiseTotal = opponent.currentBet + Math.max(state.minRaise, state.bigBlind);
  const raiseMin = Math.min(minRaiseTotal - player.currentBet, player.chips);
  const raiseMax = player.chips;

  if (raiseMax > toCall) {
    if (raiseMin >= raiseMax) {
      // Can only go all-in
      actions.push({
        type: 'allin',
        label: `All-In $${player.chips + player.currentBet}`,
        minRaise: raiseMax,
        maxRaise: raiseMax,
      });
    } else {
      const label = toCall === 0 ? 'Bet' : 'Raise';
      actions.push({
        type: 'raise',
        label,
        minRaise: raiseMin,
        maxRaise: raiseMax,
        callAmount: toCall,
      });
      actions.push({
        type: 'allin',
        label: `All-In $${player.chips + player.currentBet}`,
        minRaise: raiseMax,
        maxRaise: raiseMax,
      });
    }
  }

  return actions;
}

export function isRoundComplete(state: GameState): boolean {
  const [p1, p2] = state.players;

  // If someone folded, hand is complete
  if (p1.hasFolded || p2.hasFolded) return true;

  // If both all-in, round is complete
  if (p1.isAllIn && p2.isAllIn) return true;

  // If one is all-in and other has matched, round complete
  if (p1.isAllIn && p2.hasActed && p2.currentBet >= p1.currentBet) return true;
  if (p2.isAllIn && p1.hasActed && p1.currentBet >= p2.currentBet) return true;

  // Both must have acted and bets must be equal
  if (p1.hasActed && p2.hasActed && p1.currentBet === p2.currentBet) return true;

  return false;
}
