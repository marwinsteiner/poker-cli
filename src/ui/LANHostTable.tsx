import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import chalk from 'chalk';
import type { GameState, PlayerAction, AvailableAction, GameConfig } from '../engine/types.js';
import { getAvailableActions, isRoundComplete } from '../engine/betting.js';
import { getAIAction } from '../ai/ai-player.js';
import { getPositionLabel } from '../engine/positions.js';
import { getTotalPot } from '../engine/side-pots.js';
import { createLANState, gameReducer } from '../engine/game-state.js';
import { formatChips } from '../engine/chip-format.js';
import { useBlindClock } from '../hooks/useBlindClock.js';
import { useActionClock } from '../hooks/useActionClock.js';
import { MiniPlayerArea } from './MiniPlayerArea.js';
import { PlayerArea } from './PlayerArea.js';
import { CommunityCards } from './CommunityCards.js';
import { PotDisplay } from './PotDisplay.js';
import { MessageLog } from './MessageLog.js';
import { ActionMenu } from './ActionMenu.js';
import { BetSlider } from './BetSlider.js';
import { BlindClockDisplay } from './BlindClockDisplay.js';
import { ActionTimerDisplay } from './ActionTimerDisplay.js';
import type { LANHost } from '../net/host.js';

interface LANHostTableProps {
  host: LANHost;
  config: GameConfig;
  onGameOver: () => void;
}

type InputMode = 'action' | 'bet' | 'waiting';

export function LANHostTable({ host, config, onGameOver }: LANHostTableProps) {
  const { exit } = useApp();
  const lanMode = config.lanMode ?? 'headsup';
  const isTournament = lanMode === 'tournament';
  const isCash = lanMode === 'cash';
  const hostName = config.lanPlayerName ?? 'Host';

  // Build initial state from host + connected players
  const [initialState] = useState(() => {
    return createLANState(config, hostName, host.getPlayerNames());
  });

  const [gameState, setGameState] = useState<GameState>(initialState);
  const [remoteSeats, setRemoteSeats] = useState<Set<number>>(() => host.getRemoteSeats());
  const [inputMode, setInputMode] = useState<InputMode>('waiting');
  const [raiseAction, setRaiseAction] = useState<AvailableAction | null>(null);
  const [revealCount, setRevealCount] = useState(0);
  const [showdownRevealed, setShowdownRevealed] = useState(false);
  const processingRef = useRef(false);
  const handStartedRef = useRef(false);
  const gameOverRef = useRef(false);
  const inputModeRef = useRef<InputMode>('waiting');
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  // Use the game reducer for state management
  const dispatch = useCallback((action: any) => {
    setGameState(prev => gameReducer(prev, action));
  }, []);

  const setInputModeTracked = useCallback((mode: InputMode) => {
    inputModeRef.current = mode;
    setInputMode(mode);
  }, []);

  // Blind clock
  const blindClock = useBlindClock(
    isTournament ? gameState.blindSchedule : undefined,
    isTournament,
  );
  const blindClockRef = useRef(blindClock);
  blindClockRef.current = blindClock;

  // Action timer
  const isHostTurn = !gameState.isHandComplete && !gameState.showdownRequired &&
    gameState.currentPlayerIndex === 0 &&
    gameState.players[0]!.holeCards.length > 0 &&
    inputMode === 'action';

  const handleActionTimeout = useCallback(() => {
    if (inputModeRef.current === 'action') {
      setInputModeTracked('waiting');
      dispatch({ type: 'PLAYER_ACTION', action: { type: 'fold' } });
    }
  }, [dispatch, setInputModeTracked]);

  const actionClock = useActionClock(
    gameState.actionTimerSeconds,
    isHostTurn,
    handleActionTimeout,
  );

  // Send state to clients whenever it changes
  useEffect(() => {
    host.sendStateUpdate(gameState);
  }, [gameState, host]);

  // Handle player events from host
  useEffect(() => {
    const onPlayerJoined = (seat: number, name: string) => {
      setRemoteSeats(prev => new Set(prev).add(seat));
    };

    const onPlayerDisconnected = (seat: number) => {
      setRemoteSeats(prev => {
        const next = new Set(prev);
        next.delete(seat);
        return next;
      });

      // In tournament/headsup, disconnected player forfeits
      if (isTournament || lanMode === 'headsup') {
        dispatch({ type: 'LOG_MESSAGE', message: `${stateRef.current.players[seat]?.name ?? 'Player'} disconnected - forfeit` });
        if (!stateRef.current.players[seat]?.isEliminated) {
          dispatch({ type: 'ELIMINATE_PLAYER', seatIndex: seat });
        }
      } else if (isCash) {
        dispatch({ type: 'LOG_MESSAGE', message: `${stateRef.current.players[seat]?.name ?? 'Player'} disconnected - replaced by AI` });
      }
    };

    const onLateJoinRequest = (ws: any, playerName: string) => {
      if (!isCash) return;
      // Find an AI seat to assign
      const aiSeatIndices = stateRef.current.players
        .filter(p => !p.isHuman && !p.isEliminated)
        .map(p => p.seatIndex);
      const assignedSeat = host.assignToAISeat(ws, playerName, aiSeatIndices);
      if (assignedSeat >= 0) {
        setRemoteSeats(prev => new Set(prev).add(assignedSeat));
        dispatch({ type: 'LOG_MESSAGE', message: `${playerName} joined at seat ${assignedSeat}` });
      }
    };

    host.on('player-joined', onPlayerJoined);
    host.on('player-disconnected', onPlayerDisconnected);
    host.on('late-join-request', onLateJoinRequest);

    return () => {
      host.off('player-joined', onPlayerJoined);
      host.off('player-disconnected', onPlayerDisconnected);
      host.off('late-join-request', onLateJoinRequest);
    };
  }, [host, dispatch, isTournament, isCash, lanMode]);

  // Start first hand
  useEffect(() => {
    if (!handStartedRef.current) {
      handStartedRef.current = true;
      setShowdownRevealed(false);
      setRevealCount(0);
      dispatch({ type: 'START_NEW_HAND' });
    }
  }, [dispatch]);

  // Auto-advance pipeline (mirrors MultiPlayerTable logic)
  useEffect(() => {
    if (processingRef.current) return;
    if (inputModeRef.current === 'action' || inputModeRef.current === 'bet') return;

    const state = gameState;
    const hostPlayer = state.players[0]!;

    // After START_NEW_HAND, post blinds
    if (state.handNumber > 0 && hostPlayer.holeCards.length === 0 &&
        state.pots.length === 0 && !state.isHandComplete) {
      processingRef.current = true;
      setTimeout(() => {
        dispatch({ type: 'POST_BLINDS' });
        processingRef.current = false;
      }, 300);
      return;
    }

    // After POST_BLINDS, deal hole cards
    if (state.pots.length > 0 && hostPlayer.holeCards.length === 0 && !state.isHandComplete) {
      processingRef.current = true;
      setTimeout(() => {
        dispatch({ type: 'DEAL_HOLE_CARDS' });
        processingRef.current = false;
      }, 500);
      return;
    }

    // Check if round is complete
    if (hostPlayer.holeCards.length > 0 && !state.isHandComplete && !state.showdownRequired) {
      if (isRoundComplete(state)) {
        const nonFolded = state.players.filter(p => !p.isEliminated && !p.hasFolded);

        if (nonFolded.length <= 1) {
          processingRef.current = true;
          const totalPot = getTotalPot(state.pots);
          const winnerSeat = nonFolded[0]?.seatIndex ?? 0;
          setTimeout(() => {
            dispatch({ type: 'AWARD_POT', winners: [{ seatIndex: winnerSeat, amount: totalPot }] });
            processingRef.current = false;
          }, 500);
          return;
        }

        if (state.street === 'river') {
          processingRef.current = true;
          setTimeout(() => {
            dispatch({ type: 'SHOWDOWN' });
            processingRef.current = false;
          }, 500);
          return;
        }

        processingRef.current = true;
        setTimeout(() => {
          dispatch({ type: 'ADVANCE_STREET' });
          processingRef.current = false;
        }, 800);
        return;
      }

      // Current player's turn
      const currentPlayer = state.players[state.currentPlayerIndex]!;
      const currentSeat = state.currentPlayerIndex;

      if (currentPlayer.hasFolded || currentPlayer.isAllIn || currentPlayer.isEliminated) return;

      // Remote player's turn
      if (remoteSeats.has(currentSeat)) {
        setInputModeTracked('waiting');
        processingRef.current = true;
        host.requestAction(state, currentSeat).then(action => {
          dispatch({ type: 'PLAYER_ACTION', action });
          processingRef.current = false;
        });
        return;
      }

      // AI's turn (not host, not remote)
      if (currentSeat !== 0 && !remoteSeats.has(currentSeat)) {
        setInputModeTracked('waiting');
        processingRef.current = true;
        const delay = 500 + Math.random() * 1000;
        setTimeout(() => {
          const aiAction = getAIAction(state, currentSeat, currentPlayer.personality);
          dispatch({ type: 'PLAYER_ACTION', action: aiAction });
          processingRef.current = false;
        }, delay);
        return;
      }

      // Host's turn (seat 0)
      if (currentSeat === 0) {
        setInputModeTracked('action');
        return;
      }
    }

    // Showdown → award pot
    if (state.showdownRequired && state.showdownResults && !state.isHandComplete) {
      processingRef.current = true;
      setShowdownRevealed(true);
      setTimeout(() => {
        const winners = state.showdownResults!
          .filter(r => r.potWinnings > 0)
          .map(r => ({ seatIndex: r.seatIndex, amount: r.potWinnings }));
        dispatch({ type: 'AWARD_POT', winners });
        processingRef.current = false;
      }, 3000);
      return;
    }

    // Hand complete
    if (state.isHandComplete) {
      if (isTournament) {
        const bustedPlayers = state.players.filter(p => p.chips === 0 && !p.isEliminated);
        if (bustedPlayers.length > 0) {
          processingRef.current = true;
          setTimeout(() => {
            for (const p of bustedPlayers) {
              dispatch({ type: 'ELIMINATE_PLAYER', seatIndex: p.seatIndex });
            }
            processingRef.current = false;
          }, 500);
          return;
        }

        const remaining = state.players.filter(p => !p.isEliminated);
        if (remaining.length <= 1 && !gameOverRef.current) {
          gameOverRef.current = true;
          host.sendGameOver('Tournament complete', state.players.map(p => ({
            seatIndex: p.seatIndex, name: p.name, chips: p.chips,
          })));
          setTimeout(() => onGameOver(), 2000);
          return;
        }

        if (hostPlayer.isEliminated && !gameOverRef.current) {
          gameOverRef.current = true;
          host.sendGameOver('Host eliminated', state.players.map(p => ({
            seatIndex: p.seatIndex, name: p.name, chips: p.chips,
          })));
          setTimeout(() => onGameOver(), 2000);
          return;
        }
      }

      // Cash game: rebuy busted AIs
      if (isCash) {
        const bustedAIs = state.players.filter(p => !p.isHuman && p.chips === 0 && !remoteSeats.has(p.seatIndex));
        if (bustedAIs.length > 0) {
          processingRef.current = true;
          setTimeout(() => {
            for (const p of bustedAIs) {
              dispatch({ type: 'REBUY_PLAYER', seatIndex: p.seatIndex, amount: config.startingChips });
            }
            processingRef.current = false;
          }, 500);
          return;
        }
      }

      // Host busted (cash/headsup)
      if (hostPlayer.chips === 0 && !gameOverRef.current) {
        gameOverRef.current = true;
        host.sendGameOver('Game over', state.players.map(p => ({
          seatIndex: p.seatIndex, name: p.name, chips: p.chips,
        })));
        setTimeout(() => onGameOver(), 2000);
        return;
      }

      // Blind increase (tournament)
      const bc = blindClockRef.current;
      if (isTournament && bc.pendingIncrease) {
        dispatch({ type: 'UPDATE_BLINDS', small: bc.currentBlinds.small, big: bc.currentBlinds.big });
        bc.clearPending();
      }

      // Start next hand
      processingRef.current = true;
      setTimeout(() => {
        setShowdownRevealed(false);
        setRevealCount(0);
        handStartedRef.current = true;
        dispatch({ type: 'START_NEW_HAND' });
        processingRef.current = false;
      }, 2500);
    }
  }, [gameState, dispatch, onGameOver, config, isTournament, isCash, host, remoteSeats, setInputModeTracked]);

  // Card reveal animation
  useEffect(() => {
    if (gameState.communityCards.length > revealCount) {
      let i = revealCount;
      const timer = setInterval(() => {
        i++;
        setRevealCount(i);
        if (i >= gameState.communityCards.length) {
          clearInterval(timer);
        }
      }, 200);
      return () => clearInterval(timer);
    }
  }, [gameState.communityCards.length]);

  const handleAction = useCallback((action: PlayerAction) => {
    setInputModeTracked('waiting');
    dispatch({ type: 'PLAYER_ACTION', action });
  }, [dispatch, setInputModeTracked]);

  const handleRaiseStart = useCallback((action: AvailableAction) => {
    setRaiseAction(action);
    setInputModeTracked('bet');
  }, [setInputModeTracked]);

  const handleBetConfirm = useCallback((amount: number) => {
    setInputModeTracked('waiting');
    dispatch({ type: 'PLAYER_ACTION', action: { type: 'raise', amount } });
    setRaiseAction(null);
  }, [dispatch, setInputModeTracked]);

  const handleBetCancel = useCallback(() => {
    setInputModeTracked('action');
    setRaiseAction(null);
  }, [setInputModeTracked]);

  useInput((input) => {
    if (input === 'q') exit();
  });

  const hostPlayer = gameState.players[0]!;
  const otherPlayers = gameState.players.filter(p => p.seatIndex !== 0);
  const availableActions = gameState.currentPlayerIndex === 0 && hostPlayer.holeCards.length > 0
    ? getAvailableActions(gameState) : [];
  const totalPot = getTotalPot(gameState.pots);
  const connectedCount = remoteSeats.size;

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
          [LAN Host - {lanMode.charAt(0).toUpperCase() + lanMode.slice(1)}]
          {' '}<Text dimColor>({connectedCount + 1}/{config.playerCount} players)</Text>
        </Text>
      </Box>

      {/* Blind Clock (tournament) */}
      {isTournament && gameState.blindSchedule && (
        <>
          <BlindClockDisplay
            level={blindClock.currentLevel}
            small={blindClock.currentBlinds.small}
            big={blindClock.currentBlinds.big}
            timeRemaining={blindClock.timeRemaining}
            nextSmall={blindClock.nextBlinds?.small}
            nextBig={blindClock.nextBlinds?.big}
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
          const isRemote = remoteSeats.has(p.seatIndex);
          const namePrefix = isRemote ? '' : '[AI] ';
          return (
            <MiniPlayerArea
              key={p.seatIndex}
              player={{ ...p, name: namePrefix + p.name }}
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

      {/* Host Player Area */}
      <PlayerArea
        player={hostPlayer}
        isDealer={gameState.dealerIndex === 0}
        showCards={true}
        isWinner={gameState.winnerSeatIndices?.includes(0) ?? false}
        positionBadge={getPositionLabel(0, gameState.dealerIndex, gameState.players)}
      />

      <Box height={1} />

      {/* Message Log */}
      <MessageLog messages={gameState.messageLog} />

      <Box height={1} />

      {/* Action Area */}
      <Box alignItems="center" gap={2}>
        <Box flexGrow={1}>
          {inputMode === 'action' && (
            <Box flexDirection="column" alignItems="center" width="100%">
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
            <Box justifyContent="center" width="100%">
              <Text dimColor>
                {gameState.players[gameState.currentPlayerIndex] && gameState.currentPlayerIndex !== 0
                  ? `${gameState.players[gameState.currentPlayerIndex]!.name} is thinking...`
                  : 'Waiting...'}
              </Text>
            </Box>
          )}
        </Box>

        {gameState.actionTimerSeconds && isHostTurn && (
          <ActionTimerDisplay secondsRemaining={actionClock.secondsRemaining} />
        )}
      </Box>

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
