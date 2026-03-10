import React, { useState, useCallback, useRef } from 'react';
import type { Screen, GameConfig } from './engine/types.js';
import { TitleScreen } from './ui/TitleScreen.js';
import { GameTable } from './ui/GameTable.js';
import { MultiPlayerTable } from './ui/MultiPlayerTable.js';
import { GameOverScreen } from './ui/GameOverScreen.js';
import { TournamentResults } from './ui/TournamentResults.js';
import { MultiplayerScreen } from './ui/MultiplayerScreen.js';
import { LANHostTable } from './ui/LANHostTable.js';
import { LANClientTable } from './ui/LANClientTable.js';
import { useGameEngine } from './hooks/useGameEngine.js';
import type { LANHost } from './net/host.js';
import type { LANClient } from './net/client.js';

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

  // LAN multiplayer state
  const [lanHost, setLanHost] = useState<LANHost | null>(null);
  const [lanClient, setLanClient] = useState<LANClient | null>(null);
  const [mySeat, setMySeat] = useState(0);
  const [lanPlayerName, setLanPlayerName] = useState('Player');

  const lanHostRef = useRef(lanHost);
  lanHostRef.current = lanHost;
  const lanClientRef = useRef(lanClient);
  lanClientRef.current = lanClient;

  const handleStart = useCallback((newConfig: GameConfig) => {
    if (newConfig.mode === 'lan') {
      setConfig(newConfig);
      setLanPlayerName(newConfig.lanPlayerName ?? 'Player');
      setScreen('multiplayer');
      return;
    }
    setConfig(newConfig);
    resetGame(newConfig);
    setGameKey(k => k + 1);
    setScreen('playing');
  }, [resetGame]);

  const handleGameReady = useCallback((
    newConfig: GameConfig,
    role: 'host' | 'client',
    host?: LANHost,
    client?: LANClient,
    seat?: number,
  ) => {
    setConfig(newConfig);
    setLanHost(host ?? null);
    setLanClient(client ?? null);
    setMySeat(seat ?? 0);
    setGameKey(k => k + 1);
    setScreen('playing');
  }, []);

  const handleGameOver = useCallback(() => {
    setScreen('gameover');
  }, []);

  const handleBackToTitle = useCallback(() => {
    lanHostRef.current?.stop();
    lanClientRef.current?.disconnect();
    setLanHost(null);
    setLanClient(null);
    setScreen('title');
  }, []);

  const handlePlayAgain = useCallback(() => {
    lanHostRef.current?.stop();
    lanClientRef.current?.disconnect();
    setLanHost(null);
    setLanClient(null);
    resetGame(config);
    setGameKey(k => k + 1);
    setScreen('playing');
  }, [resetGame, config]);

  switch (screen) {
    case 'title':
      return <TitleScreen onStart={handleStart} />;

    case 'multiplayer':
      return (
        <MultiplayerScreen
          playerName={lanPlayerName}
          onGameReady={handleGameReady}
          onBack={handleBackToTitle}
        />
      );

    case 'playing':
      if (config.mode === 'lan' && config.lanRole === 'host' && lanHost) {
        return (
          <LANHostTable
            key={gameKey}
            host={lanHost}
            config={config}
            onGameOver={handleGameOver}
          />
        );
      }
      if (config.mode === 'lan' && config.lanRole === 'client' && lanClient) {
        return (
          <LANClientTable
            key={gameKey}
            client={lanClient}
            mySeat={mySeat}
            config={config}
            onGameOver={handleBackToTitle}
          />
        );
      }
      if (config.mode === 'headsup') {
        return (
          <GameTable
            key={gameKey}
            state={state}
            dispatch={dispatch}
            onGameOver={handleGameOver}
            startingChips={config.startingChips}
            llmConfig={config.llmPlayer}
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
      if (config.mode === 'tournament' || config.lanMode === 'tournament') {
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
