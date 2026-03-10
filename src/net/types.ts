import type {
  GameMode,
  GameConfig,
  PlayerAction,
  AvailableAction,
  Card,
  SidePot,
  Street,
  ShowdownResult,
  BlindLevel,
} from '../engine/types.js';

// ── Host → Client messages ──────────────────────────────────────────

export interface SeatAssignedMessage {
  type: 'SEAT_ASSIGNED';
  seatIndex: number;
  gameConfig: {
    mode: GameMode;
    playerCount: number;
    startingChips: number;
    smallBlind: number;
  };
}

export interface PlayerJoinedMessage {
  type: 'PLAYER_JOINED';
  seatIndex: number;
  playerName: string;
  connectedPlayers: { seatIndex: number; name: string }[];
}

export interface PlayerLeftMessage {
  type: 'PLAYER_LEFT';
  seatIndex: number;
}

export interface GameStartedMessage {
  type: 'GAME_STARTED';
  players: { seatIndex: number; name: string }[];
}

export interface StateUpdateMessage {
  type: 'STATE_UPDATE';
  state: ClientGameState;
}

export interface YourTurnMessage {
  type: 'YOUR_TURN';
  availableActions: AvailableAction[];
}

export interface GameOverMessage {
  type: 'GAME_OVER';
  reason: string;
  finalChips: { seatIndex: number; name: string; chips: number }[];
}

export type HostMessage =
  | SeatAssignedMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | GameStartedMessage
  | StateUpdateMessage
  | YourTurnMessage
  | GameOverMessage;

// ── Client → Host messages ──────────────────────────────────────────

export interface JoinMessage {
  type: 'JOIN';
  playerName: string;
}

export interface PlayerActionMessage {
  type: 'PLAYER_ACTION';
  action: PlayerAction;
}

export interface LeaveMessage {
  type: 'LEAVE';
}

export type ClientMessage =
  | JoinMessage
  | PlayerActionMessage
  | LeaveMessage;

// ── Filtered game state for clients ─────────────────────────────────

export interface ClientPlayer {
  seatIndex: number;
  name: string;
  isHuman: boolean;
  isEliminated: boolean;
  chips: number;
  holeCards: Card[];  // empty unless self or showdown reveal
  currentBet: number;
  totalHandBet: number;
  hasFolded: boolean;
  hasActed: boolean;
  isAllIn: boolean;
  lastAction: string | null;
}

export interface ClientGameState {
  players: ClientPlayer[];
  playerCount: number;
  mode: GameMode;
  communityCards: Card[];
  pots: SidePot[];
  street: Street;
  currentPlayerIndex: number;
  dealerIndex: number;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  isHandComplete: boolean;
  winnerSeatIndices: number[] | null;
  showdownResults: ShowdownResult[] | null;
  showdownRequired: boolean;
  messageLog: string[];
  // Tournament fields
  eliminationOrder: number[];
  blindSchedule?: BlindLevel[];
  currentBlindLevel?: number;
  actionTimerSeconds?: number;
}

// ── Discovery ───────────────────────────────────────────────────────

export interface DiscoveredGame {
  hostName: string;
  hostId: string;
  address: string;
  port: number;
  mode: GameMode;
  playerCount: number;
  connectedCount: number;
  acceptingPlayers: boolean;
  lastSeen: number;
}

export interface DiscoveryPayload {
  type: 'GAME_AVAILABLE' | 'GAME_ENDED';
  hostName: string;
  hostId: string;
  port: number;
  mode: GameMode;
  playerCount: number;
  connectedCount: number;
  acceptingPlayers: boolean;
}
