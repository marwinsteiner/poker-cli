export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
// 11=J, 12=Q, 13=K, 14=A

export interface Card {
  suit: Suit;
  rank: Rank;
}

export enum HandRank {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
  RoyalFlush = 9,
}

export interface EvaluatedHand {
  rank: HandRank;
  score: number; // numeric score for comparison
  cards: Card[]; // the best 5 cards
  name: string; // human-readable name
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export interface Player {
  id: 'human' | 'ai';
  name: string;
  chips: number;
  holeCards: Card[];
  currentBet: number;
  hasFolded: boolean;
  hasActed: boolean;
  isAllIn: boolean;
  lastAction: string | null;
}

export interface GameState {
  players: [Player, Player]; // [human, ai]
  communityCards: Card[];
  deck: Card[];
  pot: number;
  street: Street;
  currentPlayerIndex: number; // 0 = human, 1 = ai
  dealerIndex: number; // who is dealer/SB
  smallBlind: number;
  bigBlind: number;
  lastRaiseSize: number;
  minRaise: number;
  handNumber: number;
  isHandComplete: boolean;
  winner: 'human' | 'ai' | 'tie' | null;
  winningHand: EvaluatedHand | null;
  losingHand: EvaluatedHand | null;
  showdownRequired: boolean;
  messageLog: string[];
}

export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin';

export interface PlayerAction {
  type: ActionType;
  amount?: number;
}

export interface AvailableAction {
  type: ActionType;
  label: string;
  callAmount?: number;
  minRaise?: number;
  maxRaise?: number;
}

export type GameAction =
  | { type: 'START_NEW_HAND' }
  | { type: 'POST_BLINDS' }
  | { type: 'DEAL_HOLE_CARDS' }
  | { type: 'PLAYER_ACTION'; action: PlayerAction }
  | { type: 'ADVANCE_STREET' }
  | { type: 'SHOWDOWN' }
  | { type: 'AWARD_POT'; winner: 'human' | 'ai' | 'tie' }
  | { type: 'LOG_MESSAGE'; message: string }
  | { type: 'SET_CONFIG'; startingChips: number; smallBlind: number }
  | { type: 'RESET_GAME'; startingChips: number; smallBlind: number }
  | { type: 'REBUY_AI'; amount: number };

export type AnimationPhase =
  | 'idle'
  | 'dealing'
  | 'revealing-flop'
  | 'revealing-turn'
  | 'revealing-river'
  | 'showdown'
  | 'awarding';

export type Screen = 'title' | 'playing' | 'gameover';
