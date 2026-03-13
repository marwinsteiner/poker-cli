import type { Suit, Rank, HandRank } from './types.js';

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

export const SUIT_COLORS: Record<Suit, 'red' | 'white'> = {
  hearts: 'red',
  diamonds: 'red',
  clubs: 'white',
  spades: 'white',
};

export const RANK_DISPLAY: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export const HAND_RANK_NAMES: Record<HandRank, string> = {
  0: 'High Card',
  1: 'Pair',
  2: 'Two Pair',
  3: 'Three of a Kind',
  4: 'Straight',
  5: 'Flush',
  6: 'Full House',
  7: 'Four of a Kind',
  8: 'Straight Flush',
  9: 'Royal Flush',
};

export const ALL_SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const ALL_RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const DEFAULT_STARTING_CHIPS = 2000;  // $20 in cents
export const DEFAULT_SMALL_BLIND = 10;       // $0.10 in cents
export const DEFAULT_BIG_BLIND = 20;         // $0.20 in cents

export const BLIND_PRESETS = [
  { small: 10,   big: 20 },    // $0.10/$0.20
  { small: 25,   big: 50 },    // $0.25/$0.50
  { small: 50,   big: 75 },    // $0.50/$0.75
  { small: 100,  big: 100 },   // $1/$1
  { small: 100,  big: 200 },   // $1/$2
  { small: 200,  big: 500 },   // $2/$5
  { small: 1000, big: 2000 },  // $10/$20
];

export const STACK_PRESETS = [500, 1000, 2000, 5000, 10000, 20000];
// $5, $10, $20, $50, $100, $200 in cents
