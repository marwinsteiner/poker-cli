import type { GameState, GameAction, Player, Street } from './types.js';
import { createDeck, shuffle, deal } from './deck.js';
import { evaluateBestHand, compareHands } from './hand-evaluator.js';
import { DEFAULT_STARTING_CHIPS, DEFAULT_SMALL_BLIND, DEFAULT_BIG_BLIND } from './constants.js';

function createPlayer(id: 'human' | 'ai', name: string, chips: number): Player {
  return {
    id,
    name,
    chips,
    holeCards: [],
    currentBet: 0,
    hasFolded: false,
    hasActed: false,
    isAllIn: false,
    lastAction: null,
  };
}

export function createInitialState(startingChips?: number, smallBlind?: number): GameState {
  const chips = startingChips ?? DEFAULT_STARTING_CHIPS;
  const sb = smallBlind ?? DEFAULT_SMALL_BLIND;
  return {
    players: [
      createPlayer('human', 'You', chips),
      createPlayer('ai', 'Dealer', chips),
    ],
    communityCards: [],
    deck: [],
    pot: 0,
    street: 'preflop',
    currentPlayerIndex: 0,
    dealerIndex: 0, // alternates each hand
    smallBlind: sb,
    bigBlind: sb * 2,
    lastRaiseSize: sb * 2,
    minRaise: sb * 2,
    handNumber: 0,
    isHandComplete: false,
    winner: null,
    winningHand: null,
    losingHand: null,
    showdownRequired: false,
    messageLog: [],
  };
}

function addLog(state: GameState, message: string): string[] {
  const log = [...state.messageLog, message];
  return log.slice(-5); // keep last 5
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
      return {
        ...state,
        players: [
          { ...state.players[0], chips: action.startingChips },
          { ...state.players[1], chips: action.startingChips },
        ] as [Player, Player],
        smallBlind: action.smallBlind,
        bigBlind: action.smallBlind * 2,
      };
    }

    case 'RESET_GAME': {
      return createInitialState(action.startingChips, action.smallBlind);
    }

    case 'START_NEW_HAND': {
      const newDealerIndex = state.handNumber === 0 ? 0 : (1 - state.dealerIndex);
      const newDeck = shuffle(createDeck());

      return {
        ...state,
        players: [
          {
            ...state.players[0],
            holeCards: [],
            currentBet: 0,
            hasFolded: false,
            hasActed: false,
            isAllIn: false,
            lastAction: null,
          },
          {
            ...state.players[1],
            holeCards: [],
            currentBet: 0,
            hasFolded: false,
            hasActed: false,
            isAllIn: false,
            lastAction: null,
          },
        ] as [Player, Player],
        communityCards: [],
        deck: newDeck,
        pot: 0,
        street: 'preflop',
        dealerIndex: newDealerIndex,
        currentPlayerIndex: newDealerIndex, // dealer acts first preflop (is SB)
        lastRaiseSize: state.bigBlind,
        minRaise: state.bigBlind,
        handNumber: state.handNumber + 1,
        isHandComplete: false,
        winner: null,
        winningHand: null,
        losingHand: null,
        showdownRequired: false,
        messageLog: addLog(state, `--- Hand #${state.handNumber + 1} ---`),
      };
    }

    case 'POST_BLINDS': {
      const sbIndex = state.dealerIndex; // dealer = SB in heads-up
      const bbIndex = 1 - sbIndex;
      const players = [...state.players] as [Player, Player];

      const sbAmount = Math.min(state.smallBlind, players[sbIndex]!.chips);
      const bbAmount = Math.min(state.bigBlind, players[bbIndex]!.chips);

      players[sbIndex] = {
        ...players[sbIndex]!,
        chips: players[sbIndex]!.chips - sbAmount,
        currentBet: sbAmount,
        isAllIn: players[sbIndex]!.chips - sbAmount === 0,
      };
      players[bbIndex] = {
        ...players[bbIndex]!,
        chips: players[bbIndex]!.chips - bbAmount,
        currentBet: bbAmount,
        isAllIn: players[bbIndex]!.chips - bbAmount === 0,
      };

      return {
        ...state,
        players,
        pot: sbAmount + bbAmount,
        currentPlayerIndex: sbIndex, // SB (dealer) acts first preflop
        messageLog: addLog(state, `${players[sbIndex]!.name} posts SB $${sbAmount}, ${players[bbIndex]!.name} posts BB $${bbAmount}`),
      };
    }

    case 'DEAL_HOLE_CARDS': {
      const { dealt, remaining } = deal(state.deck, 4);
      const players = [...state.players] as [Player, Player];
      // Deal alternating starting with SB (dealer)
      const sbIndex = state.dealerIndex;
      const bbIndex = 1 - sbIndex;
      players[sbIndex] = { ...players[sbIndex]!, holeCards: [dealt[0]!, dealt[2]!] };
      players[bbIndex] = { ...players[bbIndex]!, holeCards: [dealt[1]!, dealt[3]!] };

      return {
        ...state,
        players,
        deck: remaining,
      };
    }

    case 'PLAYER_ACTION': {
      const { action: playerAction } = action;
      const playerIdx = state.currentPlayerIndex;
      const opponentIdx = 1 - playerIdx;
      const players = [...state.players] as [Player, Player];
      const player = { ...players[playerIdx]! };
      const opponent = players[opponentIdx]!;
      let pot = state.pot;
      let lastRaiseSize = state.lastRaiseSize;
      let minRaise = state.minRaise;
      let log = state.messageLog;

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
          const callAmount = Math.min(opponent.currentBet - player.currentBet, player.chips);
          player.chips -= callAmount;
          player.currentBet += callAmount;
          player.hasActed = true;
          player.isAllIn = player.chips === 0;
          player.lastAction = `Call $${callAmount}`;
          pot += callAmount;
          log = addLog({ ...state, messageLog: log }, `${player.name} calls $${callAmount}`);
          break;
        }
        case 'raise': {
          const amount = playerAction.amount!;
          const totalBet = player.currentBet + amount;
          const raiseBy = totalBet - opponent.currentBet;
          player.chips -= amount;
          player.currentBet = totalBet;
          player.hasActed = true;
          player.isAllIn = player.chips === 0;
          player.lastAction = `Raise to $${totalBet}`;
          pot += amount;
          lastRaiseSize = raiseBy;
          minRaise = raiseBy;
          // Reset opponent's hasActed so they get to respond
          players[opponentIdx] = { ...opponent, hasActed: false };
          log = addLog({ ...state, messageLog: log }, `${player.name} raises to $${totalBet}`);
          break;
        }
        case 'allin': {
          const allInAmount = player.chips;
          const totalBet = player.currentBet + allInAmount;
          const raiseBy = totalBet - opponent.currentBet;
          player.chips = 0;
          player.currentBet = totalBet;
          player.hasActed = true;
          player.isAllIn = true;
          player.lastAction = `All-In $${totalBet}`;
          pot += allInAmount;
          if (raiseBy > 0) {
            lastRaiseSize = Math.max(raiseBy, lastRaiseSize);
            minRaise = Math.max(raiseBy, minRaise);
            players[opponentIdx] = { ...opponent, hasActed: false };
          }
          log = addLog({ ...state, messageLog: log }, `${player.name} goes all-in for $${totalBet}`);
          break;
        }
      }

      players[playerIdx] = player;

      return {
        ...state,
        players,
        pot,
        lastRaiseSize,
        minRaise,
        currentPlayerIndex: opponentIdx,
        messageLog: log,
      };
    }

    case 'ADVANCE_STREET': {
      const next = nextStreet(state.street);
      if (!next) return state;

      const numCards = cardsForStreet(next);
      const { dealt, remaining } = deal(state.deck, numCards);

      // Post-flop: BB (non-dealer) acts first (index = 1 - dealerIndex)
      const firstToAct = 1 - state.dealerIndex;

      return {
        ...state,
        communityCards: [...state.communityCards, ...dealt],
        deck: remaining,
        street: next,
        currentPlayerIndex: firstToAct,
        lastRaiseSize: state.bigBlind,
        minRaise: state.bigBlind,
        players: [
          { ...state.players[0], currentBet: 0, hasActed: false, lastAction: null },
          { ...state.players[1], currentBet: 0, hasActed: false, lastAction: null },
        ] as [Player, Player],
        messageLog: addLog(state, `--- ${next.charAt(0).toUpperCase() + next.slice(1)} ---`),
      };
    }

    case 'SHOWDOWN': {
      const humanHand = evaluateBestHand(state.players[0].holeCards, state.communityCards);
      const aiHand = evaluateBestHand(state.players[1].holeCards, state.communityCards);
      const cmp = compareHands(humanHand, aiHand);

      let winner: 'human' | 'ai' | 'tie';
      let winningHand: typeof humanHand;
      let losingHand: typeof aiHand;

      if (cmp > 0) {
        winner = 'human';
        winningHand = humanHand;
        losingHand = aiHand;
      } else if (cmp < 0) {
        winner = 'ai';
        winningHand = aiHand;
        losingHand = humanHand;
      } else {
        winner = 'tie';
        winningHand = humanHand;
        losingHand = aiHand;
      }

      return {
        ...state,
        showdownRequired: true,
        winner,
        winningHand,
        losingHand,
        messageLog: addLog(state, winner === 'tie'
          ? `Split pot! Both have ${winningHand.name}`
          : `${winner === 'human' ? 'You' : 'Dealer'} wins with ${winningHand.name}`),
      };
    }

    case 'AWARD_POT': {
      const players = [...state.players] as [Player, Player];
      const pot = state.pot;

      if (action.winner === 'tie') {
        const half = Math.floor(pot / 2);
        players[0] = { ...players[0], chips: players[0].chips + half };
        players[1] = { ...players[1], chips: players[1].chips + (pot - half) };
      } else {
        const winnerIdx = action.winner === 'human' ? 0 : 1;
        players[winnerIdx] = {
          ...players[winnerIdx]!,
          chips: players[winnerIdx]!.chips + pot,
        };
      }

      const isGameOver = players[0].chips === 0 || players[1].chips === 0;

      return {
        ...state,
        players,
        pot: 0,
        isHandComplete: true,
        messageLog: addLog(state, action.winner === 'tie'
          ? `Pot split: $${Math.floor(pot / 2)} each`
          : `${action.winner === 'human' ? 'You' : 'Dealer'} wins $${pot}`),
      };
    }

    case 'LOG_MESSAGE': {
      return {
        ...state,
        messageLog: addLog(state, action.message),
      };
    }

    default:
      return state;
  }
}
