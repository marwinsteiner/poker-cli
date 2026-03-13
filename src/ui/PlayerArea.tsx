import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import type { Player } from '../engine/types.js';
import { formatChips } from '../engine/chip-format.js';
import { HandDisplay } from './HandDisplay.js';

interface PlayerAreaProps {
  player: Player;
  isDealer: boolean;
  showCards: boolean;
  isWinner?: boolean;
  positionBadge?: string;
}

export function PlayerArea({ player, isDealer, showCards, isWinner, positionBadge }: PlayerAreaProps) {
  const badge = positionBadge
    ? chalk.cyan(` [${positionBadge}]`)
    : isDealer ? chalk.cyan(' [D]') : '';
  const nameColor = isWinner ? chalk.green.bold : player.isHuman ? chalk.white.bold : chalk.gray;
  const chipColor = player.chips > 0 ? chalk.yellow : chalk.red;

  return (
    <Box flexDirection="column" alignItems="center" gap={0}>
      <Text>{nameColor(player.name)}{badge}</Text>
      <Text>{chipColor(`Chips: ${formatChips(player.chips)}`)}</Text>
      {player.holeCards.length > 0 && (
        <Box marginTop={0}>
          <HandDisplay
            cards={player.holeCards}
            faceDown={!showCards}
            highlighted={isWinner}
          />
        </Box>
      )}
      {player.lastAction && (
        <Text dimColor>{player.lastAction}</Text>
      )}
    </Box>
  );
}
