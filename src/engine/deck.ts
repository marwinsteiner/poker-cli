import type { Card, Suit, Rank } from './types.js';
import { ALL_SUITS, ALL_RANKS } from './constants.js';

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffle(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i]!, shuffled[j]!] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

export function deal(deck: Card[], n: number): { dealt: Card[]; remaining: Card[] } {
  return {
    dealt: deck.slice(0, n),
    remaining: deck.slice(n),
  };
}
