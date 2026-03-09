import React, { useState, useCallback } from 'react';
import type { Screen } from './engine/types.js';
import { TitleScreen } from './ui/TitleScreen.js';
import { GameTable } from './ui/GameTable.js';
import { GameOverScreen } from './ui/GameOverScreen.js';
import { useGameEngine } from './hooks/useGameEngine.js';

export function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [config, setConfig] = useState({ chips: 1500, blind: 10 });
  const [gameKey, setGameKey] = useState(0);
  const { state, dispatch, resetGame } = useGameEngine(config.chips, config.blind);

  const handleStart = useCallback((chips: number, blind: number) => {
    setConfig({ chips, blind });
    resetGame(chips, blind);
    setGameKey(k => k + 1);
    setScreen('playing');
  }, [resetGame]);

  const handleGameOver = useCallback(() => {
    setScreen('gameover');
  }, []);

  const handlePlayAgain = useCallback(() => {
    resetGame(config.chips, config.blind);
    setGameKey(k => k + 1);
    setScreen('playing');
  }, [resetGame, config]);

  switch (screen) {
    case 'title':
      return <TitleScreen onStart={handleStart} />;
    case 'playing':
      return (
        <GameTable
          key={gameKey}
          state={state}
          dispatch={dispatch}
          onGameOver={handleGameOver}
          startingChips={config.chips}
        />
      );
    case 'gameover':
      return (
        <GameOverScreen
          state={state}
          onPlayAgain={handlePlayAgain}
        />
      );
  }
}
