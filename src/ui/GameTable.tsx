import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import chalk from 'chalk';
import type { GameState, PlayerAction, AvailableAction, AnimationPhase } from '../engine/types.js';
import { getAvailableActions, isRoundComplete } from '../engine/betting.js';
import { getAIAction } from '../ai/ai-player.js';
import { gameReducer } from '../engine/game-state.js';
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
}

type InputMode = 'action' | 'bet' | 'waiting' | 'animating';

export function GameTable({ state, dispatch, onGameOver }: GameTableProps) {
  const { exit } = useApp();
  const [inputMode, setInputMode] = useState<InputMode>('waiting');
  const [raiseAction, setRaiseAction] = useState<AvailableAction | null>(null);
  const [animPhase, setAnimPhase] = useState<AnimationPhase>('idle');
  const [revealCount, setRevealCount] = useState(0);
  const [showAICards, setShowAICards] = useState(false);
  const [displayPot, setDisplayPot] = useState(state.pot);
  const processingRef = useRef(false);
  const handStartedRef = useRef(false);

  // Sync display pot
  useEffect(() => {
    setDisplayPot(state.pot);
  }, [state.pot]);

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

    // After START_NEW_HAND, post blinds
    if (state.handNumber > 0 && state.players[0].holeCards.length === 0 && state.pot === 0 && !state.isHandComplete) {
      processingRef.current = true;
      setTimeout(() => {
        dispatch({ type: 'POST_BLINDS' });
        processingRef.current = false;
      }, 300);
      return;
    }

    // After POST_BLINDS, deal hole cards
    if (state.pot > 0 && state.players[0].holeCards.length === 0 && !state.isHandComplete) {
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
    if (state.players[0].holeCards.length > 0 && !state.isHandComplete && !state.showdownRequired) {
      if (isRoundComplete(state)) {
        // Someone folded?
        if (state.players[0].hasFolded) {
          processingRef.current = true;
          setTimeout(() => {
            dispatch({ type: 'AWARD_POT', winner: 'ai' });
            processingRef.current = false;
          }, 500);
          return;
        }
        if (state.players[1].hasFolded) {
          processingRef.current = true;
          setTimeout(() => {
            dispatch({ type: 'AWARD_POT', winner: 'human' });
            processingRef.current = false;
          }, 500);
          return;
        }

        // Both all-in? Run out remaining cards
        const bothAllIn = state.players[0].isAllIn && state.players[1].isAllIn;
        const oneAllIn = state.players[0].isAllIn || state.players[1].isAllIn;

        if (state.street === 'river' || (bothAllIn && state.street === 'river')) {
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
      if (state.currentPlayerIndex === 1 && !state.players[1].hasFolded && !state.players[1].isAllIn) {
        setInputMode('waiting');
        processingRef.current = true;
        const delay = 800 + Math.random() * 1200;
        setTimeout(() => {
          const aiAction = getAIAction(state);
          dispatch({ type: 'PLAYER_ACTION', action: aiAction });
          processingRef.current = false;
        }, delay);
        return;
      }

      // Human's turn
      if (state.currentPlayerIndex === 0 && !state.players[0].hasFolded && !state.players[0].isAllIn) {
        setInputMode('action');
        return;
      }
    }

    // Showdown → award pot
    if (state.showdownRequired && state.winner) {
      processingRef.current = true;
      setShowAICards(true);
      setAnimPhase('showdown');
      setTimeout(() => {
        setAnimPhase('awarding');
        setTimeout(() => {
          dispatch({ type: 'AWARD_POT', winner: state.winner! });
          setAnimPhase('idle');
          processingRef.current = false;
        }, 1000);
      }, 2000);
      return;
    }

    // Hand complete → check game over or start next
    if (state.isHandComplete) {
      if (state.players[0].chips === 0 || state.players[1].chips === 0) {
        setTimeout(() => onGameOver(), 2000);
        return;
      }
      // Start next hand
      processingRef.current = true;
      setTimeout(() => {
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
      // Animate cards appearing one by one
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

  const availableActions = state.currentPlayerIndex === 0 ? getAvailableActions(state) : [];
  const isHumanTurn = inputMode === 'action';

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
        player={state.players[1]}
        isDealer={state.dealerIndex === 1}
        showCards={showAICards}
        isWinner={state.winner === 'ai'}
      />

      <Box height={1} />

      {/* Community Cards */}
      <CommunityCards cards={state.communityCards} revealCount={revealCount} />

      {/* Pot */}
      <Box height={1} />
      <PotDisplay amount={displayPot} />
      <Box height={1} />

      {/* Winning hand name */}
      {state.winningHand && state.showdownRequired && (
        <Box justifyContent="center">
          <Text bold color="green">{state.winningHand.name}</Text>
        </Box>
      )}

      {/* Human Area */}
      <PlayerArea
        player={state.players[0]}
        isDealer={state.dealerIndex === 0}
        showCards={true}
        isWinner={state.winner === 'human'}
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
          pot={state.pot}
          bigBlind={state.bigBlind}
          isActive={true}
          onConfirm={handleBetConfirm}
          onCancel={handleBetCancel}
        />
      )}

      {inputMode === 'waiting' && (
        <Box justifyContent="center">
          <Text dimColor>{state.currentPlayerIndex === 1 ? 'Dealer is thinking...' : 'Waiting...'}</Text>
        </Box>
      )}

      {/* Keyboard hints */}
      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>
          {inputMode === 'action' && '[←/→ Select]  [Enter Confirm]  [Q Quit]'}
          {inputMode === 'bet' && '[↑/↓ Amount]  [1-4 Presets]  [Enter Confirm]  [Esc Back]'}
          {inputMode === 'waiting' && '[Q Quit]'}
        </Text>
      </Box>
    </Box>
  );
}
