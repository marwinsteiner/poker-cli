import type { GameState, GameAction, Player, Street, GameConfig, ShowdownResult } from './types.js';
import { createDeck, shuffle, deal } from './deck.js';
import { evaluateBestHand, compareHands } from './hand-evaluator.js';
import { DEFAULT_STARTING_CHIPS, DEFAULT_SMALL_BLIND } from './constants.js';
import { getNextActiveSeat, getNextNonEliminatedSeat, getSBSeat, getBBSeat, getFirstToActPreflop, getFirstToActPostflop } from './positions.js';
import { calculateSidePots, awardPots } from './side-pots.js';
import { assignPersonalities } from '../ai/personalities.js';

function createPlayer(
  seatIndex: number,
  name: string,
  chips: number,
  isHuman: boolean,
): Player {
  return {
    seatIndex,
    name,
    isHuman,
    isEliminated: false,
    chips,
    holeCards: [],
    currentBet: 0,
    totalHandBet: 0,
    hasFolded: false,
    hasActed: false,
    isAllIn: false,
    lastAction: null,
  };
}

export function createInitialState(config?: GameConfig): GameState {
  const mode = config?.mode ?? 'headsup';
  const playerCount = config?.playerCount ?? 2;
  const chips = config?.startingChips ?? DEFAULT_STARTING_CHIPS;
  const sb = config?.smallBlind ?? DEFAULT_SMALL_BLIND;

  // Create players: seat 0 = human, seats 1+ = AI with personalities
  const players: Player[] = [];
  players.push(createPlayer(0, 'You', chips, true));

  const aiCount = playerCount - 1;
  const personalities = assignPersonalities(aiCount);
  for (let i = 0; i < aiCount; i++) {
    const p = createPlayer(i + 1, personalities[i]!.name, chips, false);
    p.personality = personalities[i]!;
    players.push(p);
  }

  return {
    players,
    playerCount,
    mode,
    communityCards: [],
    deck: [],
    pots: [],
    street: 'preflop',
    currentPlayerIndex: 0,
    dealerIndex: 0,
    smallBlind: sb,
    bigBlind: sb * 2,
    lastRaiseSize: sb * 2,
    minRaise: sb * 2,
    handNumber: 0,
    isHandComplete: false,
    winnerSeatIndices: null,
    showdownResults: null,
    showdownRequired: false,
    messageLog: [],
    eliminationOrder: [],
    blindSchedule: config?.blindSchedule,
    currentBlindLevel: config?.blindSchedule ? 0 : undefined,
    actionTimerSeconds: config?.actionTimerSeconds,
  };
}

function addLog(state: GameState, message: string): string[] {
  const maxMessages = state.playerCount > 2 ? 8 : 5;
  const log = [...state.messageLog, message];
  return log.slice(-maxMessages);
}

function nextStreet(street: Street): Street | null {
  switch (street) {
    case 'preflop': return 'flop';
    case 'flop': return 'turn';
    case 'turn': return 'river';
    case 'river': return null;
  }
}

function cardsForStreet(street: Street): number {
  switch (street) {
    case 'flop': return 3;
    case 'turn': return 1;
    case 'river': return 1;
    default: return 0;
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_CONFIG': {
      return createInitialState(action.config);
    }

    case 'RESET_GAME': {
      return createInitialState(action.config);
    }

    case 'START_NEW_HAND': {
      // Rotate dealer: for first hand use seat 0, else advance to next non-eliminated
      const newDealerIndex = state.handNumber === 0
        ? 0
        : getNextNonEliminatedSeat(state.dealerIndex, state.players);

      const newDeck = shuffle(createDeck());

      // Reset all non-eliminated players for new hand
      const players = state.players.map(p => ({
        ...p,
        holeCards: [] as typeof p.holeCards,
        currentBet: 0,
        totalHandBet: 0,
        hasFolded: p.isEliminated, // eliminated players are considered folded
        hasActed: p.isEliminated,
        isAllIn: false,
        lastAction: null,
      }));

      return {
        ...state,
        players,
        communityCards: [],
        deck: newDeck,
        pots: [],
        street: 'preflop',
        dealerIndex: newDealerIndex,
        currentPlayerIndex: newDealerIndex,
        lastRaiseSize: state.bigBlind,
        minRaise: state.bigBlind,
        handNumber: state.handNumber + 1,
        isHandComplete: false,
        winnerSeatIndices: null,
        showdownResults: null,
        showdownRequired: false,
        messageLog: addLog(state, `--- Hand #${state.handNumber + 1} ---`),
      };
    }

    case 'POST_BLINDS': {
      const sbSeat = getSBSeat(state.dealerIndex, state.players);
      const bbSeat = getBBSeat(state.dealerIndex, state.players);
      const players = state.players.map(p => ({ ...p }));

      const sbPlayer = players[sbSeat]!;
      const bbPlayer = players[bbSeat]!;

      const sbAmount = Math.min(state.smallBlind, sbPlayer.chips);
      const bbAmount = Math.min(state.bigBlind, bbPlayer.chips);

      players[sbSeat] = {
        ...sbPlayer,
        chips: sbPlayer.chips - sbAmount,
        currentBet: sbAmount,
        totalHandBet: sbAmount,
        isAllIn: sbPlayer.chips - sbAmount === 0,
      };
      players[bbSeat] = {
        ...bbPlayer,
        chips: bbPlayer.chips - bbAmount,
        currentBet: bbAmount,
        totalHandBet: bbAmount,
        isAllIn: bbPlayer.chips - bbAmount === 0,
      };

      const totalPosted = sbAmount + bbAmount;
      const firstToAct = getFirstToActPreflop(state.dealerIndex, players);

      return {
        ...state,
        players,
        pots: [{ amount: totalPosted, eligibleSeats: [] }],
        currentPlayerIndex: firstToAct,
        messageLog: addLog(state, `${players[sbSeat]!.name} posts SB $${sbAmount}, ${players[bbSeat]!.name} posts BB $${bbAmount}`),
      };
    }

    case 'DEAL_HOLE_CARDS': {
      // Count active (non-eliminated) players
      const activePlayers = state.players.filter(p => !p.isEliminated);
      const totalCards = activePlayers.length * 2;
      const { dealt, remaining } = deal(state.deck, totalCards);

      // Deal clockwise from SB, alternating rounds
      const sbSeat = getSBSeat(state.dealerIndex, state.players);
      const dealOrder: number[] = [];
      let seat = sbSeat;
      for (let i = 0; i < activePlayers.length; i++) {
        // Skip to next non-eliminated seat in first pass
        if (i > 0) seat = getNextNonEliminatedSeat(seat, state.players);
        dealOrder.push(seat);
      }

      const players = state.players.map(p => ({ ...p }));
      // First card to each, then second card to each
      for (let round = 0; round < 2; round++) {
        for (let i = 0; i < dealOrder.length; i++) {
          const cardIdx = round * dealOrder.length + i;
          const playerSeat = dealOrder[i]!;
          players[playerSeat] = {
            ...players[playerSeat]!,
            holeCards: [...players[playerSeat]!.holeCards, dealt[cardIdx]!],
          };
        }
      }

      return {
        ...state,
        players,
        deck: remaining,
      };
    }

    case 'PLAYER_ACTION': {
      const { action: playerAction } = action;
      const playerIdx = state.currentPlayerIndex;
      const players = state.players.map(p => ({ ...p }));
      const player = players[playerIdx]!;
      let pots = state.pots.map(p => ({ ...p, eligibleSeats: [...p.eligibleSeats] }));
      let lastRaiseSize = state.lastRaiseSize;
      let minRaise = state.minRaise;
      let log = state.messageLog;

      // Max current bet among all non-eliminated players
      const maxBet = Math.max(...players.filter(p => !p.isEliminated).map(p => p.currentBet));

      switch (playerAction.type) {
        case 'fold': {
          player.hasFolded = true;
          player.hasActed = true;
          player.lastAction = 'Fold';
          log = addLog({ ...state, messageLog: log }, `${player.name} folds`);
          break;
        }
        case 'check': {
          player.hasActed = true;
          player.lastAction = 'Check';
          log = addLog({ ...state, messageLog: log }, `${player.name} checks`);
          break;
        }
        case 'call': {
          const callAmount = Math.min(maxBet - player.currentBet, player.chips);
          player.chips -= callAmount;
          player.currentBet += callAmount;
          player.totalHandBet += callAmount;
          player.hasActed = true;
          player.isAllIn = player.chips === 0;
          player.lastAction = player.isAllIn ? `Call All-In $${player.currentBet}` : `Call $${callAmount}`;
          if (pots.length > 0) pots[0]!.amount += callAmount;
          log = addLog({ ...state, messageLog: log }, `${player.name} calls $${callAmount}`);
          break;
        }
        case 'raise': {
          const amount = playerAction.amount!;
          const totalBet = player.currentBet + amount;
          const raiseBy = totalBet - maxBet;
          player.chips -= amount;
          player.currentBet = totalBet;
          player.totalHandBet += amount;
          player.hasActed = true;
          player.isAllIn = player.chips === 0;
          player.lastAction = `Raise to $${totalBet}`;
          if (pots.length > 0) pots[0]!.amount += amount;
          lastRaiseSize = raiseBy;
          minRaise = raiseBy;
          // Reset all other non-folded non-all-in non-eliminated players' hasActed
          for (const p of players) {
            if (p.seatIndex !== playerIdx && !p.hasFolded && !p.isAllIn && !p.isEliminated) {
              p.hasActed = false;
            }
          }
          log = addLog({ ...state, messageLog: log }, `${player.name} raises to $${totalBet}`);
          break;
        }
        case 'allin': {
          const allInAmount = player.chips;
          const totalBet = player.currentBet + allInAmount;
          const raiseBy = totalBet - maxBet;
          player.chips = 0;
          player.currentBet = totalBet;
          player.totalHandBet += allInAmount;
          player.hasActed = true;
          player.isAllIn = true;
          player.lastAction = `All-In $${totalBet}`;
          if (pots.length > 0) pots[0]!.amount += allInAmount;
          if (raiseBy > 0) {
            lastRaiseSize = Math.max(raiseBy, lastRaiseSize);
            minRaise = Math.max(raiseBy, minRaise);
            for (const p of players) {
              if (p.seatIndex !== playerIdx && !p.hasFolded && !p.isAllIn && !p.isEliminated) {
                p.hasActed = false;
              }
            }
          }
          log = addLog({ ...state, messageLog: log }, `${player.name} goes all-in for $${totalBet}`);
          break;
        }
      }

      players[playerIdx] = player;

      // Find next player who can act
      const nextToAct = getNextActiveSeat(playerIdx, players, true);

      return {
        ...state,
        players,
        pots,
        lastRaiseSize,
        minRaise,
        currentPlayerIndex: nextToAct,
        messageLog: log,
      };
    }

    case 'ADVANCE_STREET': {
      const next = nextStreet(state.street);
      if (!next) return state;

      const numCards = cardsForStreet(next);
      const { dealt, remaining } = deal(state.deck, numCards);

      const firstToAct = getFirstToActPostflop(state.dealerIndex, state.players);

      return {
        ...state,
        communityCards: [...state.communityCards, ...dealt],
        deck: remaining,
        street: next,
        currentPlayerIndex: firstToAct,
        lastRaiseSize: state.bigBlind,
        minRaise: state.bigBlind,
        players: state.players.map(p => ({
          ...p,
          currentBet: 0,
          hasActed: p.isEliminated || p.hasFolded || p.isAllIn,
          lastAction: (p.isEliminated || p.hasFolded || p.isAllIn) ? p.lastAction : null,
        })),
        messageLog: addLog(state, `--- ${next.charAt(0).toUpperCase() + next.slice(1)} ---`),
      };
    }

    case 'SHOWDOWN': {
      // Evaluate all non-folded, non-eliminated players' hands
      const playerHands = new Map<number, ReturnType<typeof evaluateBestHand>>();
      for (const p of state.players) {
        if (!p.isEliminated && !p.hasFolded && p.holeCards.length > 0) {
          playerHands.set(p.seatIndex, evaluateBestHand(p.holeCards, state.communityCards));
        }
      }

      // Calculate side pots
      const sidePots = calculateSidePots(state.players);

      // Award pots
      const awards = awardPots(sidePots, playerHands);

      // Build showdown results
      const showdownResults: ShowdownResult[] = [];
      for (const [seatIndex, hand] of playerHands) {
        const award = awards.find(a => a.seatIndex === seatIndex);
        showdownResults.push({
          seatIndex,
          hand,
          potWinnings: award?.amount ?? 0,
        });
      }

      const winnerSeatIndices = awards.filter(a => a.amount > 0).map(a => a.seatIndex);

      // Build winner message
      let winMessage: string;
      if (winnerSeatIndices.length === 1) {
        const winner = state.players[winnerSeatIndices[0]!]!;
        const hand = playerHands.get(winnerSeatIndices[0]!)!;
        winMessage = `${winner.name} wins with ${hand.name}`;
      } else if (winnerSeatIndices.length > 1) {
        const names = winnerSeatIndices.map(s => state.players[s]!.name).join(' & ');
        winMessage = `Split pot: ${names}`;
      } else {
        winMessage = 'No winner determined';
      }

      return {
        ...state,
        showdownRequired: true,
        winnerSeatIndices,
        showdownResults,
        pots: sidePots,
        messageLog: addLog(state, winMessage),
      };
    }

    case 'AWARD_POT': {
      const players = state.players.map(p => ({ ...p }));

      for (const { seatIndex, amount } of action.winners) {
        players[seatIndex] = {
          ...players[seatIndex]!,
          chips: players[seatIndex]!.chips + amount,
        };
      }

      // Build award message
      const awardMessages = action.winners
        .filter(w => w.amount > 0)
        .map(w => `${players[w.seatIndex]!.name} wins $${w.amount}`);

      return {
        ...state,
        players,
        pots: [],
        isHandComplete: true,
        showdownRequired: false,
        winnerSeatIndices: null,
        messageLog: addLog(state, awardMessages.join(', ')),
      };
    }

    case 'LOG_MESSAGE': {
      return {
        ...state,
        messageLog: addLog(state, action.message),
      };
    }

    case 'REBUY_PLAYER': {
      const players = state.players.map(p => ({ ...p }));
      players[action.seatIndex] = {
        ...players[action.seatIndex]!,
        chips: action.amount,
        isEliminated: false,
      };
      return {
        ...state,
        players,
        messageLog: addLog(state, `${players[action.seatIndex]!.name} rebuys for $${action.amount}`),
      };
    }

    case 'ELIMINATE_PLAYER': {
      const players = state.players.map(p => ({ ...p }));
      players[action.seatIndex] = {
        ...players[action.seatIndex]!,
        isEliminated: true,
      };
      return {
        ...state,
        players,
        eliminationOrder: [...state.eliminationOrder, action.seatIndex],
        messageLog: addLog(state, `${players[action.seatIndex]!.name} is eliminated!`),
      };
    }

    case 'UPDATE_BLINDS': {
      const currentLevel = state.currentBlindLevel !== undefined ? state.currentBlindLevel + 1 : 0;
      return {
        ...state,
        smallBlind: action.small,
        bigBlind: action.big,
        currentBlindLevel: currentLevel,
        messageLog: addLog(state, `Blinds increase to $${action.small}/$${action.big}`),
      };
    }

    default:
      return state;
  }
}
