import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

interface ActionTimerDisplayProps {
  secondsRemaining: number;
}

export function ActionTimerDisplay({ secondsRemaining }: ActionTimerDisplayProps) {
  const minutes = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeStr = `${minutes}:${secs.toString().padStart(2, '0')}`;

  const color = secondsRemaining <= 10 ? chalk.red.bold : secondsRemaining <= 20 ? chalk.yellow : chalk.white;

  return (
    <Box>
      <Text>{color(`\u23F1 ${timeStr}`)}</Text>
    </Box>
  );
}
