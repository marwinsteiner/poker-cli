import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import type { SidePot } from '../engine/types.js';
import { formatChips } from '../engine/chip-format.js';

interface PotDisplayProps {
  pots: SidePot[];
}

export function PotDisplay({ pots }: PotDisplayProps) {
  if (pots.length === 0) {
    return (
      <Box justifyContent="center">
        <Text>{chalk.yellow.bold(`POT: ${formatChips(0)}`)}</Text>
      </Box>
    );
  }

  if (pots.length === 1) {
    return (
      <Box justifyContent="center">
        <Text>{chalk.yellow.bold(`POT: ${formatChips(pots[0]!.amount)}`)}</Text>
      </Box>
    );
  }

  // Multiple pots - show main pot and side pots
  return (
    <Box justifyContent="center" gap={2}>
      <Text>{chalk.yellow.bold(`Main Pot: ${formatChips(pots[0]!.amount)}`)}</Text>
      {pots.slice(1).map((pot, i) => (
        <Text key={i}>{chalk.cyan(`Side Pot ${i + 1}: ${formatChips(pot.amount)}`)}</Text>
      ))}
    </Box>
  );
}
