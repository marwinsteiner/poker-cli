import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

interface PotDisplayProps {
  amount: number;
}

export function PotDisplay({ amount }: PotDisplayProps) {
  return (
    <Box justifyContent="center">
      <Text>{chalk.yellow.bold(`POT: $${amount}`)}</Text>
    </Box>
  );
}
