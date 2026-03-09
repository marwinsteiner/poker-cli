import type { Player } from './types.js';

/**
 * Get the next seat clockwise from `fromSeat`, skipping eliminated and folded players.
 * Optionally skip all-in players (for finding who acts next).
 */
export function getNextActiveSeat(
  fromSeat: number,
  players: Player[],
  skipAllIn: boolean = false,
): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const seat = (fromSeat + i) % n;
    const p = players[seat]!;
    if (p.isEliminated || p.hasFolded) continue;
    if (skipAllIn && p.isAllIn) continue;
    return seat;
  }
  return fromSeat;
}

/**
 * Get next non-eliminated seat (used for dealer rotation, dealing order).
 */
export function getNextNonEliminatedSeat(
  fromSeat: number,
  players: Player[],
): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const seat = (fromSeat + i) % n;
    if (!players[seat]!.isEliminated) return seat;
  }
  return fromSeat;
}

/**
 * Small Blind seat.
 * Heads-up (2 active): dealer IS SB.
 * Otherwise: first non-eliminated seat left of dealer.
 */
export function getSBSeat(dealerIndex: number, players: Player[]): number {
  const activeCount = players.filter(p => !p.isEliminated).length;
  if (activeCount <= 2) {
    return dealerIndex; // heads-up: dealer is SB
  }
  return getNextNonEliminatedSeat(dealerIndex, players);
}

/**
 * Big Blind seat: first non-eliminated seat left of SB.
 */
export function getBBSeat(dealerIndex: number, players: Player[]): number {
  const sbSeat = getSBSeat(dealerIndex, players);
  return getNextNonEliminatedSeat(sbSeat, players);
}

/**
 * First to act preflop.
 * Heads-up: dealer (SB) acts first.
 * Otherwise: UTG = left of BB.
 * Skips all-in players (e.g. from posting blinds with insufficient chips).
 */
export function getFirstToActPreflop(dealerIndex: number, players: Player[]): number {
  const activeCount = players.filter(p => !p.isEliminated).length;
  if (activeCount <= 2) {
    // Heads-up: SB (dealer) acts first preflop, but skip if all-in
    const sbSeat = dealerIndex;
    if (!players[sbSeat]!.isAllIn) return sbSeat;
    return getNextActiveSeat(sbSeat, players, true);
  }
  const bbSeat = getBBSeat(dealerIndex, players);
  return getNextActiveSeat(bbSeat, players, true);
}

/**
 * First to act postflop: first non-eliminated, non-folded, non-all-in seat left of dealer.
 */
export function getFirstToActPostflop(dealerIndex: number, players: Player[]): number {
  return getNextActiveSeat(dealerIndex, players, true);
}

/**
 * Get position label for a seat.
 */
export function getPositionLabel(
  seatIndex: number,
  dealerIndex: number,
  players: Player[],
): string {
  if (seatIndex === dealerIndex) return 'D';

  const sbSeat = getSBSeat(dealerIndex, players);
  const bbSeat = getBBSeat(dealerIndex, players);

  if (seatIndex === sbSeat) return 'SB';
  if (seatIndex === bbSeat) return 'BB';

  const activeCount = players.filter(p => !p.isEliminated).length;
  if (activeCount <= 3) return '';

  // Find position relative to BB going clockwise
  let seat = bbSeat;
  let pos = 0;
  const maxPositions = activeCount - 3; // excluding D, SB, BB
  while (pos < maxPositions) {
    seat = getNextNonEliminatedSeat(seat, players);
    if (seat === seatIndex) {
      if (pos === maxPositions - 1) return 'CO';
      if (pos === 0) return 'UTG';
      if (pos === 1 && maxPositions > 2) return 'UTG+1';
      if (pos === maxPositions - 2 && maxPositions > 3) return 'HJ';
      return '';
    }
    if (seat === dealerIndex) break;
    pos++;
  }

  return '';
}
