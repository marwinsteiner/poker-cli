import { useReducer, useCallback } from 'react';
import type { GameState, GameAction, GameConfig } from '../engine/types.js';
import { gameReducer, createInitialState } from '../engine/game-state.js';

export function useGameEngine(config: GameConfig) {
  const [state, dispatch] = useReducer(gameReducer, createInitialState(config));

  const resetGame = useCallback((newConfig?: GameConfig) => {
    dispatch({
      type: 'RESET_GAME',
      config: newConfig ?? config,
    });
  }, [config]);

  return { state, dispatch, resetGame };
}
