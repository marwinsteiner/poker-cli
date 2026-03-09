import type { Player, SidePot, EvaluatedHand } from './types.js';

/**
 * Calculate side pots from players' totalHandBet.
 * Works for any number of players, with or without all-ins.
 */
export function calculateSidePots(players: Player[]): SidePot[] {
  // Collect all non-eliminated players with their total hand contributions
  const contribs = players
    .filter(p => !p.isEliminated && p.totalHandBet > 0)
    .map(p => ({
      seatIndex: p.seatIndex,
      totalBet: p.totalHandBet,
      folded: p.hasFolded,
    }));

  if (contribs.length === 0) return [];

  // Get unique bet levels (sorted ascending)
  const levels = [...new Set(contribs.map(c => c.totalBet))].sort((a, b) => a - b);

  const pots: SidePot[] = [];
  let prevLevel = 0;

  for (const level of levels) {
    // Each contributor puts in min(totalBet, level) - prevLevel
    let potAmount = 0;
    for (const c of contribs) {
      const contribution = Math.min(c.totalBet, level) - Math.min(c.totalBet, prevLevel);
      if (contribution > 0) {
        potAmount += contribution;
      }
    }

    // Eligible = non-folded players with totalBet >= level
    const eligible = contribs
      .filter(c => !c.folded && c.totalBet >= level)
      .map(c => c.seatIndex);

    if (potAmount > 0) {
      if (eligible.length > 0) {
        pots.push({ amount: potAmount, eligibleSeats: eligible });
      } else {
        // All eligible players folded; add to previous pot
        if (pots.length > 0) {
          pots[pots.length - 1]!.amount += potAmount;
        } else {
          // Edge case: create a pot for the first non-folded player
          const nonFolded = contribs.filter(c => !c.folded);
          if (nonFolded.length > 0) {
            pots.push({ amount: potAmount, eligibleSeats: nonFolded.map(c => c.seatIndex) });
          }
        }
      }
    }

    prevLevel = level;
  }

  // Merge consecutive pots with identical eligible seats
  const merged: SidePot[] = [];
  for (const pot of pots) {
    const key = [...pot.eligibleSeats].sort().join(',');
    if (merged.length > 0) {
      const lastKey = [...merged[merged.length - 1]!.eligibleSeats].sort().join(',');
      if (lastKey === key) {
        merged[merged.length - 1]!.amount += pot.amount;
        continue;
      }
    }
    merged.push({ amount: pot.amount, eligibleSeats: [...pot.eligibleSeats] });
  }

  return merged;
}

/**
 * Award pots to winners based on hand evaluation.
 * Returns array of { seatIndex, amount } for each winner.
 */
export function awardPots(
  pots: SidePot[],
  playerHands: Map<number, EvaluatedHand>,
): { seatIndex: number; amount: number }[] {
  const awards = new Map<number, number>();

  for (const pot of pots) {
    // Find best hand among eligible seats
    let bestScore = -1;
    let bestSeats: number[] = [];

    for (const seat of pot.eligibleSeats) {
      const hand = playerHands.get(seat);
      if (!hand) continue;

      if (hand.score > bestScore) {
        bestScore = hand.score;
        bestSeats = [seat];
      } else if (hand.score === bestScore) {
        bestSeats.push(seat);
      }
    }

    if (bestSeats.length === 0) continue;

    // Split pot among winners (first gets remainder from integer division)
    const share = Math.floor(pot.amount / bestSeats.length);
    const remainder = pot.amount - share * bestSeats.length;

    for (let i = 0; i < bestSeats.length; i++) {
      const seat = bestSeats[i]!;
      const current = awards.get(seat) ?? 0;
      awards.set(seat, current + share + (i === 0 ? remainder : 0));
    }
  }

  return [...awards.entries()].map(([seatIndex, amount]) => ({ seatIndex, amount }));
}

/**
 * Get total pot amount from pots array.
 */
export function getTotalPot(pots: SidePot[]): number {
  return pots.reduce((sum, p) => sum + p.amount, 0);
}
