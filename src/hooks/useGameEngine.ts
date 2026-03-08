import { useReducer, useCallback } from 'react';
import type { GameState, GameAction } from '../engine/types.js';
import { gameReducer, createInitialState } from '../engine/game-state.js';

export function useGameEngine(startingChips: number, smallBlind: number) {
  const [state, dispatch] = useReducer(gameReducer, createInitialState(startingChips, smallBlind));

  const resetGame = useCallback((newChips?: number, newBlind?: number) => {
    dispatch({
      type: 'SET_CONFIG',
      startingChips: newChips ?? startingChips,
      smallBlind: newBlind ?? smallBlind,
    });
  }, [startingChips, smallBlind]);

  return { state, dispatch, resetGame };
}
