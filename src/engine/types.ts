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

export interface AIPersonality {
  name: string;
  tightness: number;   // positive = tighter, negative = looser
  aggression: number;   // positive = more aggressive, negative = more passive
  bluffFreq: number;    // extra bluff frequency modifier
}

export interface Player {
  seatIndex: number;
  name: string;
  isHuman: boolean;
  isEliminated: boolean;
  chips: number;
  holeCards: Card[];
  currentBet: number;
  totalHandBet: number;  // tracks total contributed this hand (for side pots)
  hasFolded: boolean;
  hasActed: boolean;
  isAllIn: boolean;
  lastAction: string | null;
  personality?: AIPersonality;
}

export interface SidePot {
  amount: number;
  eligibleSeats: number[];
}

export interface BlindLevel {
  small: number;
  big: number;
  durationSeconds: number;
}

export interface ShowdownResult {
  seatIndex: number;
  hand: EvaluatedHand;
  potWinnings: number;
}

export type GameMode = 'headsup' | 'cash' | 'tournament' | 'lan';

export type LLMProvider = 'api' | 'external';

export interface LLMPlayerConfig {
  enabled: boolean;
  provider: LLMProvider;
  model: string;
  displayName: string;
}

export interface GameConfig {
  mode: GameMode;
  playerCount: number;
  startingChips: number;
  smallBlind: number;
  blindSchedule?: BlindLevel[];
  actionTimerSeconds?: number;
  llmPlayer?: LLMPlayerConfig;
  // LAN multiplayer fields
  lanRole?: 'host' | 'client';
  lanPlayerName?: string;
  lanMode?: 'headsup' | 'cash' | 'tournament';
}

export interface GameState {
  players: Player[];
  playerCount: number;
  mode: GameMode;
  communityCards: Card[];
  deck: Card[];
  pots: SidePot[];
  street: Street;
  currentPlayerIndex: number;
  dealerIndex: number;
  smallBlind: number;
  bigBlind: number;
  lastRaiseSize: number;
  minRaise: number;
  handNumber: number;
  isHandComplete: boolean;
  winnerSeatIndices: number[] | null;
  showdownResults: ShowdownResult[] | null;
  showdownRequired: boolean;
  messageLog: string[];
  // Tournament-specific:
  eliminationOrder: number[];
  blindSchedule?: BlindLevel[];
  currentBlindLevel?: number;
  actionTimerSeconds?: number;
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
  | { type: 'AWARD_POT'; winners: { seatIndex: number; amount: number }[] }
  | { type: 'LOG_MESSAGE'; message: string }
  | { type: 'SET_CONFIG'; config: GameConfig }
  | { type: 'RESET_GAME'; config: GameConfig }
  | { type: 'REBUY_PLAYER'; seatIndex: number; amount: number }
  | { type: 'ELIMINATE_PLAYER'; seatIndex: number }
  | { type: 'UPDATE_BLINDS'; small: number; big: number };

export type AnimationPhase =
  | 'idle'
  | 'dealing'
  | 'revealing-flop'
  | 'revealing-turn'
  | 'revealing-river'
  | 'showdown'
  | 'awarding';

export type Screen = 'title' | 'multiplayer' | 'playing' | 'gameover';
