import React from 'react';
import { Text, Box } from 'ink';
import chalk from 'chalk';
import type { Card } from '../engine/types.js';
import { SUIT_SYMBOLS, SUIT_COLORS, RANK_DISPLAY } from '../engine/constants.js';

interface CardDisplayProps {
  card?: Card | null;
  faceDown?: boolean;
  highlighted?: boolean;
}

export function CardDisplay({ card, faceDown, highlighted }: CardDisplayProps) {
  if (!card && !faceDown) {
    // Empty slot
    return (
      <Box flexDirection="column">
        <Text dimColor>┌─────┐</Text>
        <Text dimColor>│     │</Text>
        <Text dimColor>│     │</Text>
        <Text dimColor>│     │</Text>
        <Text dimColor>└─────┘</Text>
      </Box>
    );
  }

  if (faceDown || !card) {
    return (
      <Box flexDirection="column">
        <Text>┌─────┐</Text>
        <Text>│░░░░░│</Text>
        <Text>│░░░░░│</Text>
        <Text>│░░░░░│</Text>
        <Text>└─────┘</Text>
      </Box>
    );
  }

  const symbol = SUIT_SYMBOLS[card.suit];
  const color = SUIT_COLORS[card.suit];
  const rankStr = RANK_DISPLAY[card.rank];
  const padLeft = rankStr.length === 2 ? '' : ' ';
  const padRight = rankStr.length === 2 ? '' : ' ';

  const colorFn = color === 'red' ? chalk.red : chalk.white;
  const borderColor = highlighted ? chalk.yellow : chalk.white;

  const topRank = `${rankStr}${padLeft}   `;
  const bottomRank = `   ${padRight}${rankStr}`;
  const middle = `  ${symbol}  `;

  return (
    <Box flexDirection="column">
      <Text>{borderColor('┌─────┐')}</Text>
      <Text>{borderColor('│')}{colorFn(topRank)}{borderColor('│')}</Text>
      <Text>{borderColor('│')}{colorFn(middle)}{borderColor('│')}</Text>
      <Text>{borderColor('│')}{colorFn(bottomRank)}{borderColor('│')}</Text>
      <Text>{borderColor('└─────┘')}</Text>
    </Box>
  );
}
