import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import chalk from 'chalk';
import type { GameState, PlayerAction, AvailableAction, AnimationPhase, GameConfig } from '../engine/types.js';
import { getAvailableActions, isRoundComplete } from '../engine/betting.js';
import { getAIAction } from '../ai/ai-player.js';
import { getPositionLabel } from '../engine/positions.js';
import { getTotalPot } from '../engine/side-pots.js';
import { getLLMDecision } from '../llm/claude.js';
import { formatChips } from '../engine/chip-format.js';
import { MiniPlayerArea } from './MiniPlayerArea.js';
import { PlayerArea } from './PlayerArea.js';
import { CommunityCards } from './CommunityCards.js';
import { PotDisplay } from './PotDisplay.js';
import { MessageLog } from './MessageLog.js';
import { ActionMenu } from './ActionMenu.js';
import { BetSlider } from './BetSlider.js';
import { BlindClockDisplay } from './BlindClockDisplay.js';
import { ActionTimerDisplay } from './ActionTimerDisplay.js';
import { useBlindClock } from '../hooks/useBlindClock.js';
import { useActionClock } from '../hooks/useActionClock.js';

interface MultiPlayerTableProps {
  state: GameState;
  dispatch: (action: any) => void;
  onGameOver: () => void;
  config: GameConfig;
}

type InputMode = 'action' | 'bet' | 'waiting';

export function MultiPlayerTable({ state, dispatch, onGameOver, config }: MultiPlayerTableProps) {
  const { exit } = useApp();
  const [inputMode, setInputMode] = useState<InputMode>('waiting');
  const [raiseAction, setRaiseAction] = useState<AvailableAction | null>(null);
  const [revealCount, setRevealCount] = useState(0);
  const [showdownRevealed, setShowdownRevealed] = useState(false);
  const [llmThinking, setLlmThinking] = useState(false);
  const [llmReasoning, setLlmReasoning] = useState<string | null>(null);
  const processingRef = useRef(false);
  const handStartedRef = useRef(false);
  const gameOverRef = useRef(false);
  const inputModeRef = useRef<InputMode>('waiting');

  const isTournament = state.mode === 'tournament';
  const isLLMMode = config.llmPlayer?.enabled ?? false;
  const llmConfig = config.llmPlayer;

  // Blind clock (tournament only)
  const blindClock = useBlindClock(
    isTournament ? state.blindSchedule : undefined,
    isTournament,
  );

  // Keep a ref to avoid stale closures in the effect
  const blindClockRef = useRef(blindClock);
  blindClockRef.current = blindClock;

  // Track inputMode in ref for the effect to read without it being a dependency
  const setInputModeTracked = useCallback((mode: InputMode) => {
    inputModeRef.current = mode;
    setInputMode(mode);
  }, []);

  // Action timer (only for manual human play, not LLM)
  const isHumanTurn = !isLLMMode && !state.isHandComplete && !state.showdownRequired &&
    state.players[state.currentPlayerIndex]?.isHuman &&
    state.players[0]!.holeCards.length > 0 &&
    inputMode === 'action';

  const handleActionTimeout = useCallback(() => {
    if (inputModeRef.current === 'action') {
      setInputModeTracked('waiting');
      dispatch({ type: 'PLAYER_ACTION', action: { type: 'fold' } });
    }
  }, [dispatch, setInputModeTracked]);

  const actionClock = useActionClock(
    state.actionTimerSeconds,
    isHumanTurn,
    handleActionTimeout,
  );

  // Start new hand
  useEffect(() => {
    if (!handStartedRef.current) {
      handStartedRef.current = true;
      setShowdownRevealed(false);
      setRevealCount(0);
      dispatch({ type: 'START_NEW_HAND' });
    }
  }, []);

  // Auto-advance pipeline
  useEffect(() => {
    if (processingRef.current) return;

    // Don't re-run pipeline while human is choosing an action or sizing a bet (manual mode only)
    if (!isLLMMode && (inputModeRef.current === 'action' || inputModeRef.current === 'bet')) return;

    const humanPlayer = state.players[0]!;

    // After START_NEW_HAND, post blinds
    if (state.handNumber > 0 && humanPlayer.holeCards.length === 0 &&
        state.pots.length === 0 && !state.isHandComplete) {
      processingRef.current = true;
      setTimeout(() => {
        dispatch({ type: 'POST_BLINDS' });
        processingRef.current = false;
      }, 300);
      return;
    }

    // After POST_BLINDS, deal hole cards
    if (state.pots.length > 0 && humanPlayer.holeCards.length === 0 && !state.isHandComplete) {
      processingRef.current = true;
      setTimeout(() => {
        dispatch({ type: 'DEAL_HOLE_CARDS' });
        processingRef.current = false;
      }, 500);
      return;
    }

    // Check if round is complete
    if (humanPlayer.holeCards.length > 0 && !state.isHandComplete && !state.showdownRequired) {
      if (isRoundComplete(state)) {
        const nonFolded = state.players.filter(p => !p.isEliminated && !p.hasFolded);

        // Everyone folded except one?
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
          // Showdown
          processingRef.current = true;
          setTimeout(() => {
            dispatch({ type: 'SHOWDOWN' });
            processingRef.current = false;
          }, 500);
          return;
        }

        // Advance street
        processingRef.current = true;
        setTimeout(() => {
          dispatch({ type: 'ADVANCE_STREET' });
          processingRef.current = false;
        }, 800);
        return;
      }

      // Current player's turn
      const currentPlayer = state.players[state.currentPlayerIndex]!;

      // AI's turn
      if (!currentPlayer.isHuman && !currentPlayer.hasFolded && !currentPlayer.isAllIn && !currentPlayer.isEliminated) {
        setInputModeTracked('waiting');
        processingRef.current = true;
        const delay = 500 + Math.random() * 1000;
        setTimeout(() => {
          const aiAction = getAIAction(state, state.currentPlayerIndex, currentPlayer.personality);
          dispatch({ type: 'PLAYER_ACTION', action: aiAction });
          processingRef.current = false;
        }, delay);
        return;
      }

      // Human's turn
      if (currentPlayer.isHuman && !currentPlayer.hasFolded && !currentPlayer.isAllIn) {
        if (isLLMMode) {
          // LLM plays instead of human
          processingRef.current = true;
          setLlmThinking(true);
          setLlmReasoning(null);
          getLLMDecision(state, llmConfig!).then(decision => {
            setLlmThinking(false);
            setLlmReasoning(decision.reasoning);
            dispatch({ type: 'LOG_MESSAGE', message: `[${llmConfig!.displayName}] ${decision.reasoning.slice(0, 120)}` });
            dispatch({ type: 'PLAYER_ACTION', action: decision.action });
            processingRef.current = false;
          }).catch(err => {
            setLlmThinking(false);
            setLlmReasoning(`Error: ${err.message}`);
            const actions = getAvailableActions(state);
            const check = actions.find(a => a.type === 'check');
            dispatch({ type: 'PLAYER_ACTION', action: check ? { type: 'check' } : { type: 'fold' } });
            processingRef.current = false;
          });
          return;
        }
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
      // Check for eliminated players (tournament)
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

        // Check if game over (only 1 player left)
        const remaining = state.players.filter(p => !p.isEliminated);
        if (remaining.length <= 1 && !gameOverRef.current) {
          gameOverRef.current = true;
          setTimeout(() => onGameOver(), 2000);
          return;
        }

        // Human eliminated
        if (humanPlayer.isEliminated && !gameOverRef.current) {
          gameOverRef.current = true;
          setTimeout(() => onGameOver(), 2000);
          return;
        }
      }

      // Cash game: rebuy busted AIs
      if (state.mode === 'cash') {
        const bustedAIs = state.players.filter(p => !p.isHuman && p.chips === 0);
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

      // Human busted (cash game) → game over
      if (humanPlayer.chips === 0 && !gameOverRef.current) {
        gameOverRef.current = true;
        setTimeout(() => onGameOver(), 2000);
        return;
      }

      // Check for blind increase (tournament)
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
        setLlmReasoning(null);
        handStartedRef.current = true;
        dispatch({ type: 'START_NEW_HAND' });
        processingRef.current = false;
      }, 2500);
    }
  }, [state, dispatch, onGameOver, config, isTournament, isLLMMode, llmConfig, setInputModeTracked]);

  // Update reveal count based on community cards
  useEffect(() => {
    if (state.communityCards.length > revealCount) {
      let i = revealCount;
      const timer = setInterval(() => {
        i++;
        setRevealCount(i);
        if (i >= state.communityCards.length) {
          clearInterval(timer);
        }
      }, 200);
      return () => clearInterval(timer);
    }
  }, [state.communityCards.length]);

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

  const humanPlayer = state.players[0]!;
  const aiPlayers = state.players.filter(p => !p.isHuman);
  const availableActions = state.currentPlayerIndex === 0 && humanPlayer.holeCards.length > 0
    ? getAvailableActions(state) : [];
  const totalPot = getTotalPot(state.pots);

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="green"
      paddingX={2}
      paddingY={1}
      width={85}
    >
      {/* LLM mode indicator */}
      {isLLMMode && (
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="magenta">[LLM Mode: {llmConfig!.displayName}]</Text>
        </Box>
      )}

      {/* Blind Clock (tournament) */}
      {isTournament && state.blindSchedule && (
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

      {/* AI Opponents */}
      <Box flexDirection="column">
        {aiPlayers.map(p => {
          const posLabel = getPositionLabel(p.seatIndex, state.dealerIndex, state.players);
          const isWinner = state.winnerSeatIndices?.includes(p.seatIndex) ?? false;
          const showdownResult = showdownRevealed
            ? state.showdownResults?.find(r => r.seatIndex === p.seatIndex)
            : undefined;
          return (
            <MiniPlayerArea
              key={p.seatIndex}
              player={p}
              positionLabel={posLabel}
              isCurrent={state.currentPlayerIndex === p.seatIndex && !state.isHandComplete}
              isWinner={isWinner}
              showdownResult={showdownResult}
            />
          );
        })}
      </Box>

      <Box height={1} />

      {/* Community Cards */}
      <CommunityCards cards={state.communityCards} revealCount={revealCount} />

      {/* Pot */}
      <Box height={1} />
      <PotDisplay pots={state.pots} />
      <Box height={1} />

      {/* Showdown results */}
      {showdownRevealed && state.showdownResults && (
        <Box justifyContent="center" flexDirection="column" alignItems="center">
          {state.showdownResults.filter(r => r.potWinnings > 0).map(r => (
            <Text key={r.seatIndex} bold color="green">
              {state.players[r.seatIndex]!.name}: {r.hand.name}
              {r.potWinnings > 0 ? ` (+${formatChips(r.potWinnings)})` : ''}
            </Text>
          ))}
        </Box>
      )}

      {/* Human/LLM Player Area */}
      <PlayerArea
        player={humanPlayer}
        isDealer={state.dealerIndex === 0}
        showCards={true}
        isWinner={state.winnerSeatIndices?.includes(0) ?? false}
        positionBadge={isLLMMode ? llmConfig!.displayName : getPositionLabel(0, state.dealerIndex, state.players)}
      />

      <Box height={1} />

      {/* LLM Reasoning */}
      {isLLMMode && llmReasoning && (
        <Box paddingX={1} marginBottom={1}>
          <Text color="magenta" wrap="wrap">
            {`[${llmConfig!.displayName}] ${llmReasoning.length > 200 ? llmReasoning.slice(0, 200) + '...' : llmReasoning}`}
          </Text>
        </Box>
      )}

      {/* Message Log */}
      <MessageLog messages={state.messageLog} />

      <Box height={1} />

      {/* Action Area */}
      <Box alignItems="center" gap={2}>
        <Box flexGrow={1}>
          {!isLLMMode && inputMode === 'action' && (
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

          {!isLLMMode && inputMode === 'bet' && raiseAction && (
            <BetSlider
              minBet={raiseAction.minRaise!}
              maxBet={raiseAction.maxRaise!}
              pot={totalPot}
              bigBlind={state.bigBlind}
              isActive={true}
              onConfirm={handleBetConfirm}
              onCancel={handleBetCancel}
            />
          )}

          {(inputMode === 'waiting' || isLLMMode) && (
            <Box justifyContent="center" width="100%">
              <Text dimColor>
                {llmThinking
                  ? `${llmConfig!.displayName} is thinking...`
                  : state.players[state.currentPlayerIndex] && !state.players[state.currentPlayerIndex]!.isHuman
                  ? `${state.players[state.currentPlayerIndex]!.name} is thinking...`
                  : 'Waiting...'}
              </Text>
            </Box>
          )}
        </Box>

        {/* Action Timer (manual mode only) */}
        {!isLLMMode && state.actionTimerSeconds && isHumanTurn && (
          <ActionTimerDisplay secondsRemaining={actionClock.secondsRemaining} />
        )}
      </Box>

      {/* Keyboard hints */}
      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>
          {!isLLMMode && inputMode === 'action' && '[Left/Right Select]  [Enter Confirm]  [Q Quit]'}
          {!isLLMMode && inputMode === 'bet' && '[Up/Down Amount]  [1-4 Presets]  [Enter Confirm]  [Esc Back]'}
          {(inputMode === 'waiting' || isLLMMode) && '[Q Quit]'}
        </Text>
      </Box>
    </Box>
  );
}
