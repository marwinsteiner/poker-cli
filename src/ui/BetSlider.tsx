import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';

interface BetSliderProps {
  minBet: number;
  maxBet: number;
  pot: number;
  bigBlind: number;
  isActive: boolean;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}

export function BetSlider({ minBet, maxBet, pot, bigBlind, isActive, onConfirm, onCancel }: BetSliderProps) {
  const [amount, setAmount] = useState(minBet);
  const step = bigBlind;

  useInput((input, key) => {
    if (!isActive) return;

    if (key.upArrow) {
      setAmount(prev => Math.min(maxBet, prev + step));
    } else if (key.downArrow) {
      setAmount(prev => Math.max(minBet, prev - step));
    } else if (key.return) {
      onConfirm(amount);
    } else if (key.escape) {
      onCancel();
    } else if (input === '1') {
      // Half pot
      setAmount(Math.max(minBet, Math.min(maxBet, Math.round(pot * 0.5))));
    } else if (input === '2') {
      // 3/4 pot
      setAmount(Math.max(minBet, Math.min(maxBet, Math.round(pot * 0.75))));
    } else if (input === '3') {
      // Full pot
      setAmount(Math.max(minBet, Math.min(maxBet, pot)));
    } else if (input === '4') {
      // All-in
      setAmount(maxBet);
    }
  }, { isActive });

  if (!isActive) return null;

  // Visual bar
  const range = maxBet - minBet;
  const barWidth = 20;
  const position = range > 0 ? Math.round(((amount - minBet) / range) * barWidth) : 0;
  const bar = '─'.repeat(position) + chalk.yellow('●') + '─'.repeat(barWidth - position);

  return (
    <Box flexDirection="column" alignItems="center" gap={0}>
      <Text bold color="yellow">Raise Amount: ${amount}</Text>
      <Text>[{bar}]</Text>
      <Text dimColor>
        {`Min: $${minBet}  Max: $${maxBet}`}
      </Text>
      <Text dimColor>
        [1] Half pot  [2] 3/4 pot  [3] Pot  [4] All-in
      </Text>
      <Text dimColor>
        [Enter] Confirm  [Esc] Back
      </Text>
    </Box>
  );
}
