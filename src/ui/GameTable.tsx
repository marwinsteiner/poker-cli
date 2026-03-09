import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import chalk from 'chalk';
import type { GameState, PlayerAction, AvailableAction, AnimationPhase } from '../engine/types.js';
import { getAvailableActions, isRoundComplete } from '../engine/betting.js';
import { getAIAction } from '../ai/ai-player.js';
import { getTotalPot } from '../engine/side-pots.js';
import { PlayerArea } from './PlayerArea.js';
import { CommunityCards } from './CommunityCards.js';
import { PotDisplay } from './PotDisplay.js';
import { MessageLog } from './MessageLog.js';
import { ActionMenu } from './ActionMenu.js';
import { BetSlider } from './BetSlider.js';

interface GameTableProps {
  state: GameState;
  dispatch: (action: any) => void;
  onGameOver: () => void;
  startingChips: number;
}

type InputMode = 'action' | 'bet' | 'waiting' | 'animating';

export function GameTable({ state, dispatch, onGameOver, startingChips }: GameTableProps) {
  const { exit } = useApp();
  const [inputMode, setInputMode] = useState<InputMode>('waiting');
  const [raiseAction, setRaiseAction] = useState<AvailableAction | null>(null);
  const [animPhase, setAnimPhase] = useState<AnimationPhase>('idle');
  const [revealCount, setRevealCount] = useState(0);
  const [showAICards, setShowAICards] = useState(false);
  const processingRef = useRef(false);
  const handStartedRef = useRef(false);
  const gameOverRef = useRef(false);

  // Start new hand
  useEffect(() => {
    if (!handStartedRef.current) {
      handStartedRef.current = true;
      setShowAICards(false);
      setRevealCount(0);
      dispatch({ type: 'START_NEW_HAND' });
    }
  }, []);

  // Auto-advance pipeline
  useEffect(() => {
    if (processingRef.current) return;

    const humanPlayer = state.players[0]!;
    const aiPlayer = state.players[1]!;

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
      setAnimPhase('dealing');
      setTimeout(() => {
        dispatch({ type: 'DEAL_HOLE_CARDS' });
        setAnimPhase('idle');
        processingRef.current = false;
      }, 500);
      return;
    }

    // Check if round is complete
    if (humanPlayer.holeCards.length > 0 && !state.isHandComplete && !state.showdownRequired) {
      if (isRoundComplete(state)) {
        // Someone folded?
        if (humanPlayer.hasFolded) {
          processingRef.current = true;
          const totalPot = getTotalPot(state.pots);
          setTimeout(() => {
            dispatch({ type: 'AWARD_POT', winners: [{ seatIndex: 1, amount: totalPot }] });
            processingRef.current = false;
          }, 500);
          return;
        }
        if (aiPlayer.hasFolded) {
          processingRef.current = true;
          const totalPot = getTotalPot(state.pots);
          setTimeout(() => {
            dispatch({ type: 'AWARD_POT', winners: [{ seatIndex: 0, amount: totalPot }] });
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

        // Both all-in → run out board
        if (humanPlayer.isAllIn && aiPlayer.isAllIn) {
          processingRef.current = true;
          setTimeout(() => {
            dispatch({ type: 'ADVANCE_STREET' });
            processingRef.current = false;
          }, 800);
          return;
        }

        // Advance street
        processingRef.current = true;
        const nextStreetName = state.street === 'preflop' ? 'flop' : state.street === 'flop' ? 'turn' : 'river';
        setAnimPhase(nextStreetName === 'flop' ? 'revealing-flop' : nextStreetName === 'turn' ? 'revealing-turn' : 'revealing-river');

        setTimeout(() => {
          dispatch({ type: 'ADVANCE_STREET' });
          setAnimPhase('idle');
          processingRef.current = false;
        }, 800);
        return;
      }

      // AI's turn
      if (state.currentPlayerIndex === 1 && !aiPlayer.hasFolded && !aiPlayer.isAllIn) {
        setInputMode('waiting');
        processingRef.current = true;
        const delay = 800 + Math.random() * 1200;
        setTimeout(() => {
          const aiAction = getAIAction(state, 1, aiPlayer.personality);
          dispatch({ type: 'PLAYER_ACTION', action: aiAction });
          processingRef.current = false;
        }, delay);
        return;
      }

      // Human's turn
      if (state.currentPlayerIndex === 0 && !humanPlayer.hasFolded && !humanPlayer.isAllIn) {
        setInputMode('action');
        return;
      }
    }

    // Showdown → award pot
    if (state.showdownRequired && state.showdownResults && !state.isHandComplete) {
      processingRef.current = true;
      setShowAICards(true);
      setAnimPhase('showdown');
      setTimeout(() => {
        setAnimPhase('awarding');
        setTimeout(() => {
          const winners = state.showdownResults!
            .filter(r => r.potWinnings > 0)
            .map(r => ({ seatIndex: r.seatIndex, amount: r.potWinnings }));
          dispatch({ type: 'AWARD_POT', winners });
          setAnimPhase('idle');
          processingRef.current = false;
        }, 1000);
      }, 2000);
      return;
    }

    // Hand complete → check game over, AI rebuy, or start next
    if (state.isHandComplete) {
      // Human busted → game over
      if (humanPlayer.chips === 0 && !gameOverRef.current) {
        gameOverRef.current = true;
        setTimeout(() => onGameOver(), 2000);
        return;
      }

      processingRef.current = true;
      setTimeout(() => {
        // AI busted → auto-rebuy
        if (aiPlayer.chips === 0) {
          dispatch({ type: 'REBUY_PLAYER', seatIndex: 1, amount: startingChips });
        }
        setShowAICards(false);
        setRevealCount(0);
        handStartedRef.current = true;
        dispatch({ type: 'START_NEW_HAND' });
        processingRef.current = false;
      }, 2500);
    }
  }, [state, dispatch, onGameOver]);

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
    setInputMode('waiting');
    dispatch({ type: 'PLAYER_ACTION', action });
  }, [dispatch]);

  const handleRaiseStart = useCallback((action: AvailableAction) => {
    setRaiseAction(action);
    setInputMode('bet');
  }, []);

  const handleBetConfirm = useCallback((amount: number) => {
    setInputMode('waiting');
    handleAction({ type: 'raise', amount });
    setRaiseAction(null);
  }, [handleAction]);

  const handleBetCancel = useCallback(() => {
    setInputMode('action');
    setRaiseAction(null);
  }, []);

  useInput((input) => {
    if (input === 'q') {
      exit();
    }
  });

  const humanPlayer = state.players[0]!;
  const aiPlayer = state.players[1]!;
  const availableActions = state.currentPlayerIndex === 0 ? getAvailableActions(state) : [];
  const isHumanTurn = inputMode === 'action';
  const totalPot = getTotalPot(state.pots);
  const isWinnerHuman = state.winnerSeatIndices?.includes(0) ?? false;
  const isWinnerAI = state.winnerSeatIndices?.includes(1) ?? false;

  // Find winning hand for display
  const winningResult = state.showdownResults?.find(r => r.potWinnings > 0);

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="green"
      paddingX={2}
      paddingY={1}
      width={55}
    >
      {/* AI Area */}
      <PlayerArea
        player={aiPlayer}
        isDealer={state.dealerIndex === 1}
        showCards={showAICards}
        isWinner={isWinnerAI}
      />

      <Box height={1} />

      {/* Community Cards */}
      <CommunityCards cards={state.communityCards} revealCount={revealCount} />

      {/* Pot */}
      <Box height={1} />
      <PotDisplay pots={state.pots} />
      <Box height={1} />

      {/* Winning hand name */}
      {winningResult && state.showdownRequired && (
        <Box justifyContent="center">
          <Text bold color="green">{winningResult.hand.name}</Text>
        </Box>
      )}

      {/* Human Area */}
      <PlayerArea
        player={humanPlayer}
        isDealer={state.dealerIndex === 0}
        showCards={true}
        isWinner={isWinnerHuman}
      />

      <Box height={1} />

      {/* Message Log */}
      <MessageLog messages={state.messageLog} />

      <Box height={1} />

      {/* Action Area */}
      {inputMode === 'action' && (
        <Box flexDirection="column" alignItems="center">
          <Text bold>Your action:</Text>
          <ActionMenu
            actions={availableActions}
            isActive={isHumanTurn}
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
          bigBlind={state.bigBlind}
          isActive={true}
          onConfirm={handleBetConfirm}
          onCancel={handleBetCancel}
        />
      )}

      {inputMode === 'waiting' && (
        <Box justifyContent="center">
          <Text dimColor>{state.currentPlayerIndex === 1 ? `${aiPlayer.name} is thinking...` : 'Waiting...'}</Text>
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
