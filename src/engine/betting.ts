import type { GameState, AvailableAction } from './types.js';

export function getAvailableActions(state: GameState): AvailableAction[] {
  const player = state.players[state.currentPlayerIndex]!;
  if (player.hasFolded || player.isAllIn || player.isEliminated) return [];

  const actions: AvailableAction[] = [];

  // Max current bet among all non-eliminated players
  const maxBet = Math.max(...state.players.filter(p => !p.isEliminated).map(p => p.currentBet));
  const toCall = maxBet - player.currentBet;

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

  const minRaiseTotal = maxBet + Math.max(state.minRaise, state.bigBlind);
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
  const activePlayers = state.players.filter(p => !p.isEliminated && !p.hasFolded);

  // If <=1 non-folded player, hand is over
  if (activePlayers.length <= 1) return true;

  // All non-folded, non-all-in players must have acted with equal bets
  const canAct = activePlayers.filter(p => !p.isAllIn);

  if (canAct.length === 0) return true; // all remaining are all-in

  const maxBet = Math.max(...activePlayers.map(p => p.currentBet));

  return canAct.every(p => p.hasActed && p.currentBet === maxBet);
}
