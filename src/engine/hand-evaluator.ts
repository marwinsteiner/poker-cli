import type { Card, EvaluatedHand, Rank } from './types.js';
import { HandRank } from './types.js';
import { HAND_RANK_NAMES, RANK_DISPLAY } from './constants.js';

function combinations(cards: Card[], k: number): Card[][] {
  if (k === 0) return [[]];
  if (cards.length < k) return [];
  const result: Card[][] = [];
  const first = cards[0]!;
  const rest = cards.slice(1);
  // combos that include first
  for (const combo of combinations(rest, k - 1)) {
    result.push([first, ...combo]);
  }
  // combos that exclude first
  for (const combo of combinations(rest, k)) {
    result.push(combo);
  }
  return result;
}

function evaluateFiveCards(cards: Card[]): EvaluatedHand {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a) as Rank[];
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight
  let isStraight = false;
  let straightHighCard = ranks[0]!;

  // Normal straight check
  if (ranks[0]! - ranks[4]! === 4 && new Set(ranks).size === 5) {
    isStraight = true;
    straightHighCard = ranks[0]!;
  }
  // Wheel: A-2-3-4-5
  if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
    isStraight = true;
    straightHighCard = 5 as Rank; // 5-high straight
  }

  // Count rank occurrences
  const rankCounts = new Map<Rank, number>();
  for (const r of ranks) {
    rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  }

  const groups = [...rankCounts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // by count desc
    return b[0] - a[0]; // by rank desc
  });

  const counts = groups.map(g => g[1]);
  const groupRanks = groups.map(g => g[0]);

  let handRank: HandRank;
  let kickers: number[];

  if (isStraight && isFlush) {
    if (straightHighCard === 14) {
      handRank = HandRank.RoyalFlush;
    } else {
      handRank = HandRank.StraightFlush;
    }
    kickers = [straightHighCard];
  } else if (counts[0] === 4) {
    handRank = HandRank.FourOfAKind;
    kickers = [groupRanks[0]!, groupRanks[1]!];
  } else if (counts[0] === 3 && counts[1] === 2) {
    handRank = HandRank.FullHouse;
    kickers = [groupRanks[0]!, groupRanks[1]!];
  } else if (isFlush) {
    handRank = HandRank.Flush;
    kickers = [...ranks];
  } else if (isStraight) {
    handRank = HandRank.Straight;
    kickers = [straightHighCard];
  } else if (counts[0] === 3) {
    handRank = HandRank.ThreeOfAKind;
    kickers = [groupRanks[0]!, groupRanks[1]!, groupRanks[2]!];
  } else if (counts[0] === 2 && counts[1] === 2) {
    handRank = HandRank.TwoPair;
    kickers = [groupRanks[0]!, groupRanks[1]!, groupRanks[2]!];
  } else if (counts[0] === 2) {
    handRank = HandRank.Pair;
    kickers = [groupRanks[0]!, groupRanks[1]!, groupRanks[2]!, groupRanks[3]!];
  } else {
    handRank = HandRank.HighCard;
    kickers = [...ranks];
  }

  // Score: handRank * 10^10 + kickers weighted by position
  let score = handRank * 1e10;
  for (let i = 0; i < kickers.length; i++) {
    score += kickers[i]! * Math.pow(15, 4 - i);
  }

  const name = getHandName(handRank, groupRanks, straightHighCard);

  return { rank: handRank, score, cards, name };
}

function getHandName(handRank: HandRank, groupRanks: Rank[], straightHigh: Rank): string {
  const rd = (r: Rank) => RANK_DISPLAY[r];
  const plural = (r: Rank) => (r === 6 ? 'Sixes' : `${rd(r)}s`);

  switch (handRank) {
    case HandRank.RoyalFlush:
      return 'Royal Flush';
    case HandRank.StraightFlush:
      return `Straight Flush, ${rd(straightHigh)} high`;
    case HandRank.FourOfAKind:
      return `Four ${plural(groupRanks[0]!)}`;
    case HandRank.FullHouse:
      return `Full House, ${plural(groupRanks[0]!)} over ${plural(groupRanks[1]!)}`;
    case HandRank.Flush:
      return `Flush, ${rd(groupRanks[0]!)} high`;
    case HandRank.Straight:
      return `Straight, ${rd(straightHigh)} high`;
    case HandRank.ThreeOfAKind:
      return `Three ${plural(groupRanks[0]!)}`;
    case HandRank.TwoPair:
      return `Two Pair, ${plural(groupRanks[0]!)} and ${plural(groupRanks[1]!)}`;
    case HandRank.Pair:
      return `Pair of ${plural(groupRanks[0]!)}`;
    case HandRank.HighCard:
      return `${rd(groupRanks[0]!)} High`;
    default:
      return HAND_RANK_NAMES[handRank];
  }
}

export function evaluateBestHand(holeCards: Card[], communityCards: Card[]): EvaluatedHand {
  const allCards = [...holeCards, ...communityCards];

  if (allCards.length < 5) {
    // Not enough cards yet, evaluate what we have
    const padded = [...allCards];
    while (padded.length < 5) {
      padded.push({ suit: 'spades', rank: 2 as Rank }); // dummy
    }
    return evaluateFiveCards(padded);
  }

  const allCombos = combinations(allCards, 5);
  let best: EvaluatedHand | null = null;

  for (const combo of allCombos) {
    const evaluated = evaluateFiveCards(combo);
    if (!best || evaluated.score > best.score) {
      best = evaluated;
    }
  }

  return best!;
}

export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  return a.score - b.score; // positive = a wins, negative = b wins, 0 = tie
}
