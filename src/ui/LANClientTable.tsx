import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import chalk from 'chalk';
import type { PlayerAction, AvailableAction, GameConfig } from '../engine/types.js';
import { getPositionLabel } from '../engine/positions.js';
import { getTotalPot } from '../engine/side-pots.js';
import { formatChips } from '../engine/chip-format.js';
import { MiniPlayerArea } from './MiniPlayerArea.js';
import { PlayerArea } from './PlayerArea.js';
import { CommunityCards } from './CommunityCards.js';
import { PotDisplay } from './PotDisplay.js';
import { MessageLog } from './MessageLog.js';
import { ActionMenu } from './ActionMenu.js';
import { BetSlider } from './BetSlider.js';
import { BlindClockDisplay } from './BlindClockDisplay.js';
import type { LANClient } from '../net/client.js';
import type { ClientGameState } from '../net/types.js';

interface LANClientTableProps {
  client: LANClient;
  mySeat: number;
  config: GameConfig;
  onGameOver: () => void;
}

type InputMode = 'action' | 'bet' | 'waiting';

export function LANClientTable({ client, mySeat, config, onGameOver }: LANClientTableProps) {
  const { exit } = useApp();
  const lanMode = config.lanMode ?? 'headsup';
  const isTournament = lanMode === 'tournament';

  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('waiting');
  const [availableActions, setAvailableActions] = useState<AvailableAction[]>([]);
  const [raiseAction, setRaiseAction] = useState<AvailableAction | null>(null);
  const [revealCount, setRevealCount] = useState(0);
  const [disconnected, setDisconnected] = useState(false);
  const [gameOverReason, setGameOverReason] = useState<string | null>(null);

  // Listen to client events
  useEffect(() => {
    const onStateUpdate = (state: ClientGameState) => {
      setGameState(state);
    };

    const onYourTurn = (actions: AvailableAction[]) => {
      setAvailableActions(actions);
      setInputMode('action');
    };

    const onGameOverEvent = (reason: string) => {
      setGameOverReason(reason);
      setTimeout(() => onGameOver(), 3000);
    };

    const onDisconnected = () => {
      setDisconnected(true);
      setTimeout(() => onGameOver(), 3000);
    };

    client.on('state-update', onStateUpdate);
    client.on('your-turn', onYourTurn);
    client.on('game-over', onGameOverEvent);
    client.on('disconnected', onDisconnected);

    return () => {
      client.off('state-update', onStateUpdate);
      client.off('your-turn', onYourTurn);
      client.off('game-over', onGameOverEvent);
      client.off('disconnected', onDisconnected);
    };
  }, [client, onGameOver]);

  // Card reveal animation
  useEffect(() => {
    if (gameState && gameState.communityCards.length > revealCount) {
      let i = revealCount;
      const timer = setInterval(() => {
        i++;
        setRevealCount(i);
        if (gameState && i >= gameState.communityCards.length) {
          clearInterval(timer);
        }
      }, 200);
      return () => clearInterval(timer);
    }
  }, [gameState?.communityCards.length]);

  const handleAction = useCallback((action: PlayerAction) => {
    setInputMode('waiting');
    setAvailableActions([]);
    client.sendAction(action);
  }, [client]);

  const handleRaiseStart = useCallback((action: AvailableAction) => {
    setRaiseAction(action);
    setInputMode('bet');
  }, []);

  const handleBetConfirm = useCallback((amount: number) => {
    setInputMode('waiting');
    setAvailableActions([]);
    client.sendAction({ type: 'raise', amount });
    setRaiseAction(null);
  }, [client]);

  const handleBetCancel = useCallback(() => {
    setInputMode('action');
    setRaiseAction(null);
  }, []);

  useInput((input) => {
    if (input === 'q') exit();
  });

  // Waiting for first state
  if (!gameState) {
    return (
      <Box flexDirection="column" alignItems="center" paddingY={2}>
        <Text bold color="cyan">[LAN Client - Seat #{mySeat}]</Text>
        <Box height={1} />
        {disconnected ? (
          <Text color="red">Disconnected from host.</Text>
        ) : (
          <Text dimColor>Waiting for game state...</Text>
        )}
      </Box>
    );
  }

  if (disconnected) {
    return (
      <Box flexDirection="column" alignItems="center" paddingY={2}>
        <Text bold color="red">Disconnected from host</Text>
        <Text dimColor>Returning to title screen...</Text>
      </Box>
    );
  }

  if (gameOverReason) {
    return (
      <Box flexDirection="column" alignItems="center" paddingY={2}>
        <Text bold color="yellow">Game Over: {gameOverReason}</Text>
        <Text dimColor>Returning to title screen...</Text>
      </Box>
    );
  }

  const myPlayer = gameState.players[mySeat];
  const otherPlayers = gameState.players.filter(p => p.seatIndex !== mySeat);
  const totalPot = getTotalPot(gameState.pots);
  const showdownRevealed = gameState.showdownRequired;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="green"
      paddingX={2}
      paddingY={1}
      width={85}
    >
      {/* LAN indicator */}
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">
          [LAN Client - Seat #{mySeat}]
          {' '}<Text dimColor>({lanMode})</Text>
        </Text>
      </Box>

      {/* Blind Clock (tournament) */}
      {isTournament && gameState.blindSchedule && (
        <>
          <BlindClockDisplay
            level={gameState.currentBlindLevel ?? 0}
            small={gameState.smallBlind}
            big={gameState.bigBlind}
            timeRemaining={0}
            nextSmall={undefined}
            nextBig={undefined}
          />
          <Box height={1} />
        </>
      )}

      {/* Other Players */}
      <Box flexDirection="column">
        {otherPlayers.map(p => {
          const posLabel = getPositionLabel(p.seatIndex, gameState.dealerIndex, gameState.players);
          const isWinner = gameState.winnerSeatIndices?.includes(p.seatIndex) ?? false;
          const showdownResult = showdownRevealed
            ? gameState.showdownResults?.find(r => r.seatIndex === p.seatIndex)
            : undefined;
          return (
            <MiniPlayerArea
              key={p.seatIndex}
              player={p}
              positionLabel={posLabel}
              isCurrent={gameState.currentPlayerIndex === p.seatIndex && !gameState.isHandComplete}
              isWinner={isWinner}
              showdownResult={showdownResult}
            />
          );
        })}
      </Box>

      <Box height={1} />

      {/* Community Cards */}
      <CommunityCards cards={gameState.communityCards} revealCount={revealCount} />

      <Box height={1} />
      <PotDisplay pots={gameState.pots} />
      <Box height={1} />

      {/* Showdown results */}
      {showdownRevealed && gameState.showdownResults && (
        <Box justifyContent="center" flexDirection="column" alignItems="center">
          {gameState.showdownResults.filter(r => r.potWinnings > 0).map(r => (
            <Text key={r.seatIndex} bold color="green">
              {gameState.players[r.seatIndex]!.name}: {r.hand.name}
              {r.potWinnings > 0 ? ` (+${formatChips(r.potWinnings)})` : ''}
            </Text>
          ))}
        </Box>
      )}

      {/* My Player Area */}
      {myPlayer && (
        <PlayerArea
          player={myPlayer}
          isDealer={gameState.dealerIndex === mySeat}
          showCards={true}
          isWinner={gameState.winnerSeatIndices?.includes(mySeat) ?? false}
          positionBadge={getPositionLabel(mySeat, gameState.dealerIndex, gameState.players)}
        />
      )}

      <Box height={1} />

      {/* Message Log */}
      <MessageLog messages={gameState.messageLog} />

      <Box height={1} />

      {/* Action Area */}
      {inputMode === 'action' && availableActions.length > 0 && (
        <Box flexDirection="column" alignItems="center">
          <Text bold>Your action:</Text>
          <ActionMenu
            actions={availableActions}
            isActive={true}
            onSelect={handleAction}
            onRaiseStart={handleRaiseStart}
          />
        </Box>
      )}

      {inputMode === 'bet' && raiseAction && (
        <BetSlider
          minBet={raiseAction.minRaise!}
          maxBet={raiseAction.maxRaise!}
          pot={totalPot}
          bigBlind={gameState.bigBlind}
          isActive={true}
          onConfirm={handleBetConfirm}
          onCancel={handleBetCancel}
        />
      )}

      {inputMode === 'waiting' && (
        <Box justifyContent="center">
          <Text dimColor>
            {gameState.currentPlayerIndex === mySeat
              ? 'Waiting...'
              : gameState.players[gameState.currentPlayerIndex]
                ? `${gameState.players[gameState.currentPlayerIndex]!.name} is thinking...`
                : 'Waiting...'}
          </Text>
        </Box>
      )}

      {/* Keyboard hints */}
      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>
          {inputMode === 'action' && '[Left/Right Select]  [Enter Confirm]  [Q Quit]'}
          {inputMode === 'bet' && '[Up/Down Amount]  [1-4 Presets]  [Enter Confirm]  [Esc Back]'}
          {inputMode === 'waiting' && '[Q Quit]'}
        </Text>
      </Box>
    </Box>
  );
}
