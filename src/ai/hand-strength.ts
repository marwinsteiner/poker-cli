import type { Card, Rank } from '../engine/types.js';
import { HandRank } from '../engine/types.js';
import { evaluateBestHand } from '../engine/hand-evaluator.js';

/**
 * Chen formula for pre-flop hand strength.
 * Returns a value 0.0 - 1.0.
 */
export function evaluatePreflopStrength(holeCards: Card[]): number {
  const [c1, c2] = holeCards as [Card, Card];
  const r1 = c1.rank;
  const r2 = c2.rank;
  const high = Math.max(r1, r2) as Rank;
  const low = Math.min(r1, r2) as Rank;
  const suited = c1.suit === c2.suit;
  const pair = r1 === r2;
  const gap = high - low;

  // Chen score
  let score: number;

  // Base score from highest card
  if (high === 14) score = 10;
  else if (high === 13) score = 8;
  else if (high === 12) score = 7;
  else if (high === 11) score = 6;
  else score = high / 2;

  // Pair bonus
  if (pair) {
    score *= 2;
    if (score < 5) score = 5;
  }

  // Suited bonus
  if (suited) score += 2;

  // Gap penalty
  if (!pair) {
    if (gap === 1) score += 1; // connected
    else if (gap === 2) score -= 1;
    else if (gap === 3) score -= 2;
    else if (gap === 4) score -= 4;
    else score -= 5;
  }

  // Normalize to 0-1 range (Chen scores range roughly -1 to 20)
  const normalized = Math.max(0, Math.min(1, (score + 1) / 21));
  return normalized;
}

/**
 * Post-flop hand strength based on current evaluation + draw potential.
 * Returns 0.0 - 1.0.
 */
export function evaluatePostflopStrength(holeCards: Card[], communityCards: Card[]): number {
  const hand = evaluateBestHand(holeCards, communityCards);

  // Base strength from hand rank
  let strength: number;
  switch (hand.rank) {
    case HandRank.RoyalFlush:
      strength = 1.0;
      break;
    case HandRank.StraightFlush:
      strength = 0.97;
      break;
    case HandRank.FourOfAKind:
      strength = 0.94;
      break;
    case HandRank.FullHouse:
      strength = 0.88;
      break;
    case HandRank.Flush:
      strength = 0.82;
      break;
    case HandRank.Straight:
      strength = 0.76;
      break;
    case HandRank.ThreeOfAKind:
      strength = 0.68;
      break;
    case HandRank.TwoPair:
      strength = 0.58;
      break;
    case HandRank.Pair: {
      // Distinguish top pair, middle pair, bottom pair
      const pairRank = holeCards.find(c =>
        communityCards.some(cc => cc.rank === c.rank)
      )?.rank;
      const boardRanks = communityCards.map(c => c.rank).sort((a, b) => b - a);
      if (pairRank && pairRank >= (boardRanks[0] ?? 0)) {
        strength = 0.48; // top pair
      } else if (pairRank) {
        strength = 0.38; // lower pair
      } else {
        // Pocket pair
        strength = 0.44;
      }
      break;
    }
    case HandRank.HighCard:
    default: {
      // Scale by kicker
      const highCard = Math.max(holeCards[0]!.rank, holeCards[1]!.rank);
      strength = 0.15 + (highCard / 14) * 0.15;
      break;
    }
  }

  // Draw potential bonus (only if not on river)
  if (communityCards.length < 5) {
    const allCards = [...holeCards, ...communityCards];
    const drawBonus = estimateDrawPotential(allCards);
    strength = Math.min(1.0, strength + drawBonus);
  }

  return strength;
}

function estimateDrawPotential(cards: Card[]): number {
  let bonus = 0;

  // Flush draw: 4 cards of same suit
  const suitCounts = new Map<string, number>();
  for (const c of cards) {
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }
  for (const count of suitCounts.values()) {
    if (count === 4) bonus += 0.12; // flush draw
  }

  // Straight draw: check for 4 cards in a 5-card window
  const uniqueRanks = [...new Set(cards.map(c => c.rank))].sort((a, b) => a - b);
  for (let i = 0; i < uniqueRanks.length; i++) {
    let consecutive = 1;
    for (let j = i + 1; j < uniqueRanks.length && uniqueRanks[j]! - uniqueRanks[i]! <= 4; j++) {
      if (uniqueRanks[j]! === uniqueRanks[j - 1]! + 1) {
        consecutive++;
      }
    }
    if (consecutive >= 4) {
      bonus += 0.08; // open-ended straight draw
      break;
    }
  }

  return bonus;
}
