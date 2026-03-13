import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import type { Player, ShowdownResult } from '../engine/types.js';
import { formatChips } from '../engine/chip-format.js';

interface MiniPlayerAreaProps {
  player: Player;
  positionLabel: string;
  isCurrent: boolean;
  isWinner: boolean;
  showdownResult?: ShowdownResult;
}

export function MiniPlayerArea({ player, positionLabel, isCurrent, isWinner, showdownResult }: MiniPlayerAreaProps) {
  if (player.isEliminated) {
    return (
      <Box>
        <Text strikethrough dimColor>
          {player.name} {formatChips(0)} [OUT]
        </Text>
      </Box>
    );
  }

  const nameColor = isWinner ? chalk.green.bold : isCurrent ? chalk.cyan.bold : chalk.white;
  const chipColor = player.chips > 0 ? chalk.yellow : chalk.red;
  const posTag = positionLabel ? chalk.cyan(`[${positionLabel}]`) : '';

  let statusText = '';
  if (player.hasFolded) {
    statusText = chalk.dim('Fold');
  } else if (player.isAllIn) {
    statusText = chalk.red.bold('ALL-IN');
  } else if (player.lastAction) {
    statusText = chalk.dim(player.lastAction);
  }

  let handText = '';
  if (showdownResult) {
    handText = chalk.green(` ${showdownResult.hand.name}`);
    if (showdownResult.potWinnings > 0) {
      handText += chalk.yellow(` +${formatChips(showdownResult.potWinnings)}`);
    }
  }

  const indicator = isCurrent ? chalk.cyan('> ') : '  ';

  return (
    <Box>
      <Text>
        {indicator}
        {nameColor(player.name)} {chipColor(formatChips(player.chips))} {posTag}
        {statusText ? ` ${statusText}` : ''}
        {handText}
      </Text>
    </Box>
  );
}
