import React, { useState, useCallback } from 'react';
import type { Screen, GameConfig } from './engine/types.js';
import { TitleScreen } from './ui/TitleScreen.js';
import { GameTable } from './ui/GameTable.js';
import { MultiPlayerTable } from './ui/MultiPlayerTable.js';
import { GameOverScreen } from './ui/GameOverScreen.js';
import { TournamentResults } from './ui/TournamentResults.js';
import { useGameEngine } from './hooks/useGameEngine.js';

const DEFAULT_CONFIG: GameConfig = {
  mode: 'headsup',
  playerCount: 2,
  startingChips: 1500,
  smallBlind: 10,
};

export function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [gameKey, setGameKey] = useState(0);
  const { state, dispatch, resetGame } = useGameEngine(config);

  const handleStart = useCallback((newConfig: GameConfig) => {
    setConfig(newConfig);
    resetGame(newConfig);
    setGameKey(k => k + 1);
    setScreen('playing');
  }, [resetGame]);

  const handleGameOver = useCallback(() => {
    setScreen('gameover');
  }, []);

  const handlePlayAgain = useCallback(() => {
    resetGame(config);
    setGameKey(k => k + 1);
    setScreen('playing');
  }, [resetGame, config]);

  switch (screen) {
    case 'title':
      return <TitleScreen onStart={handleStart} />;
    case 'playing':
      if (config.mode === 'headsup') {
        return (
          <GameTable
            key={gameKey}
            state={state}
            dispatch={dispatch}
            onGameOver={handleGameOver}
            startingChips={config.startingChips}
          />
        );
      }
      return (
        <MultiPlayerTable
          key={gameKey}
          state={state}
          dispatch={dispatch}
          onGameOver={handleGameOver}
          config={config}
        />
      );
    case 'gameover':
      if (config.mode === 'tournament') {
        return (
          <TournamentResults
            state={state}
            onPlayAgain={handlePlayAgain}
          />
        );
      }
      return (
        <GameOverScreen
          state={state}
          onPlayAgain={handlePlayAgain}
        />
      );
  }
}
