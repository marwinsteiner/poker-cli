import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

interface BlindClockDisplayProps {
  level: number;
  small: number;
  big: number;
  timeRemaining: number;
  nextSmall?: number;
  nextBig?: number;
}

export function BlindClockDisplay({ level, small, big, timeRemaining, nextSmall, nextBig }: BlindClockDisplayProps) {
  const minutes = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  const timeStr = `${minutes}:${secs.toString().padStart(2, '0')}`;

  const timeColor = timeRemaining <= 30 ? chalk.red.bold : timeRemaining <= 60 ? chalk.yellow : chalk.white;
  const nextStr = nextSmall && nextBig ? chalk.dim(` Next: $${nextSmall}/$${nextBig}`) : '';

  return (
    <Box justifyContent="center">
      <Text>
        {chalk.cyan(`Level ${level + 1}:`)} {chalk.yellow.bold(`$${small}/$${big}`)}
        {' | '}
        {timeColor(timeStr)}
        {nextStr}
      </Text>
    </Box>
  );
}
